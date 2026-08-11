import { getGoogleAccessToken, getGoogleDriveClient } from "@/lib/google/drive";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

const SHEET_ID = process.env.GOOGLE_SHEETS_ID ?? "";

type SheetRow = {
  cliente: string;
  cnj: string;
  honorariosNathalia: string;
  honorariosTerceiro: string;
  indicacao: string;
};

// Posição das colunas usadas na planilha de honorários (cabeçalho na linha 1,
// ignorado). As colunas 2, 5 e 6 existem na planilha mas não alimentam
// nenhum campo deste sync.
const SHEET_COLUMN = {
  cliente: 0,
  cnj: 1,
  honorariosNathalia: 3,
  honorariosTerceiro: 4,
  indicacao: 7
} as const;

function parsePct(raw: string): number | null {
  const cleaned = raw.trim().replace("%", "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function normalizeCnj(raw: string): string {
  return raw.trim().replace(/\s/g, "");
}

function normalizeName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

// Parse CSV respeitando campos com vírgula entre aspas.
function parseCsvLine(line: string): string[] {
  const cols: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === "," && !inQuotes) { cols.push(current.trim()); current = ""; continue; }
    current += ch;
  }
  cols.push(current.trim());
  return cols;
}

// Maior índice usado em SHEET_COLUMN + 1 — o mínimo de colunas que a
// planilha precisa ter pros índices fixos abaixo ainda fazerem sentido.
const MIN_EXPECTED_COLUMNS = Math.max(...Object.values(SHEET_COLUMN)) + 1;

// Exporta a planilha inteira (aba padrão/primeira) via API do Drive — usado
// pelo sync recorrente da planilha de honorários (GOOGLE_SHEETS_ID).
async function fetchDefaultSheetCsv(spreadsheetId: string): Promise<string> {
  const drive = getGoogleDriveClient();
  const res = await drive.files.export(
    { fileId: spreadsheetId, mimeType: "text/csv" },
    { responseType: "text" }
  );
  return res.data as string;
}

// drive.files.export não suporta escolher uma aba específica (gid) — sempre
// exporta a primeira. Pra planilhas com múltiplas abas (ex: uma aba por
// pasta de status), usa o endpoint de exportação do próprio Sheets, que
// aceita gid e autentica com o mesmo token de acesso da conta de serviço.
async function fetchSheetTabCsv(spreadsheetId: string, gid: string): Promise<string> {
  const token = await getGoogleAccessToken();
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw new Error(`Falha ao exportar aba da planilha (status ${res.status}).`);
  }
  return res.text();
}

export async function readSheetRows(spreadsheetId: string = SHEET_ID, gid?: string): Promise<SheetRow[]> {
  const csv = gid ? await fetchSheetTabCsv(spreadsheetId, gid) : await fetchDefaultSheetCsv(spreadsheetId);

  const [headerLine, ...lines] = csv.trim().split("\n");

  // Sem isso, uma coluna removida da planilha desloca todos os índices
  // fixos abaixo pro lugar errado — sem nenhum erro. Não valida por NOME de
  // cada coluna (exigiria saber o cabeçalho real da planilha em produção),
  // mas pelo menos garante que não faltam colunas antes de gravar qualquer
  // coisa no banco.
  const headerColumns = headerLine ? parseCsvLine(headerLine) : [];
  if (headerColumns.length < MIN_EXPECTED_COLUMNS) {
    throw new Error(
      `Cabeçalho da planilha tem ${headerColumns.length} coluna(s), esperava pelo menos ${MIN_EXPECTED_COLUMNS} — a estrutura da planilha pode ter mudado. Sync abortado antes de gravar dado no campo errado.`
    );
  }

  const rows: SheetRow[] = [];

  for (const line of lines) {
    const cols = parseCsvLine(line);

    const cliente = cols[SHEET_COLUMN.cliente];
    const cnj = cols[SHEET_COLUMN.cnj];
    const honNath = cols[SHEET_COLUMN.honorariosNathalia];
    const honTer = cols[SHEET_COLUMN.honorariosTerceiro];
    const indicacao = cols[SHEET_COLUMN.indicacao];
    if (!cliente?.trim() || !cnj?.trim()) continue;

    rows.push({
      cliente: cliente.trim(),
      cnj: normalizeCnj(cnj),
      honorariosNathalia: honNath?.trim() ?? "",
      honorariosTerceiro: honTer?.trim() ?? "",
      indicacao: indicacao?.trim() ?? ""
    });
  }

  return rows;
}

export type SheetSyncResult = {
  total: number;
  processosAtualizados: number;
  clientesAtualizados: number;
  parceirosEncontrados: number;
  erros: string[];
};

export async function runSheetSync(spreadsheetId: string = SHEET_ID, gid?: string): Promise<SheetSyncResult> {
  const result: SheetSyncResult = {
    total: 0,
    processosAtualizados: 0,
    clientesAtualizados: 0,
    parceirosEncontrados: 0,
    erros: []
  };

  const supabase = getSupabaseServiceClient();
  const rows = await readSheetRows(spreadsheetId, gid);
  result.total = rows.length;

  const { data: processos } = await supabase.from("processos").select("id, numero_cnj, cliente_id, percentual_exito");
  const { data: clientes, error: clientesError } = await supabase.from("clientes").select("id, nome");
  if (clientesError) result.erros.push(`Erro clientes: ${clientesError.message}`);

  const processoByCnj = new Map<string, { id: string; cliente_id: string; numero_cnj: string }>();
  for (const p of processos ?? []) {
    if (p.numero_cnj) processoByCnj.set(normalizeCnj(p.numero_cnj), { id: p.id, cliente_id: p.cliente_id, numero_cnj: p.numero_cnj });
  }

  const clienteByNome = new Map<string, string>(); // nome normalizado → id
  for (const c of clientes ?? []) {
    clienteByNome.set(normalizeName(c.nome), c.id);
  }

  for (const row of rows) {
    try {
      let clienteId: string | null = null;

      // 1. Localiza o processo pelo CNJ
      const processo = processoByCnj.get(row.cnj);
      if (processo) {
        clienteId = processo.cliente_id;

        // Atualiza o CNJ se estava como "A definir"
        if (processo.numero_cnj === "A definir") {
          await supabase.from("processos").update({ numero_cnj: row.cnj }).eq("id", processo.id);
          result.processosAtualizados++;
        }

        // Atualiza % de êxito se diferente
        const pct = parsePct(row.honorariosNathalia);
        if (pct !== null) {
          await supabase.from("processos")
            .update({ percentual_exito: pct })
            .eq("id", processo.id);
          result.processosAtualizados++;
        }
      }

      // 2. Se não achou pelo CNJ, tenta pelo nome exato do cliente.
      // Nunca faz match parcial/aproximado — um trecho de "duas primeiras palavras"
      // existiu aqui e vinculava dados financeiros ao cliente errado sempre que
      // nomes eram parciais ou colidiam (ex: "Maria" batendo em "José Maria Santos").
      // O mesmo padrão já tinha sido removido de ai-document-reader.ts por esse motivo.
      if (!clienteId) {
        const nomeNorm = normalizeName(row.cliente);
        clienteId = clienteByNome.get(nomeNorm) ?? null;

        // Se achou o cliente pelo nome e a planilha tem CNJ, atualiza o processo "A definir"
        if (clienteId && row.cnj && row.cnj !== "-") {
          const processoADefinir = (processos ?? []).find(
            p => p.cliente_id === clienteId && p.numero_cnj === "A definir"
          );
          if (processoADefinir) {
            await supabase.from("processos")
              .update({ numero_cnj: row.cnj })
              .eq("id", processoADefinir.id);
            result.processosAtualizados++;
          }

          // Atualiza % de êxito no processo encontrado
          const pct = parsePct(row.honorariosNathalia);
          if (pct !== null && processoADefinir) {
            await supabase.from("processos")
              .update({ percentual_exito: pct })
              .eq("id", processoADefinir.id);
          }
        }
      }

      if (!clienteId) {
        result.erros.push(
          `${row.cliente}: cliente não encontrado (sem CNJ correspondente nem nome exato no cadastro) — verifique manualmente.`
        );
        continue;
      }

      // 3. Atualiza parceiro no cliente
      const parceiroNome = row.indicacao && row.indicacao !== "-" ? row.indicacao.trim() : null;
      const pctTerceiro = parsePct(row.honorariosTerceiro);

      const updateData: Record<string, unknown> = {};

      if (parceiroNome) {
        // Busca ou cria o parceiro
        const { data: parceiroExistente } = await supabase
          .from("parceiros")
          .select("id")
          .eq("nome", parceiroNome)
          .limit(1)
          .maybeSingle();

        let parceiroId = parceiroExistente?.id;
        if (!parceiroId) {
          const { data: novo } = await supabase
            .from("parceiros")
            .insert({ nome: parceiroNome })
            .select("id")
            .single();
          parceiroId = novo?.id;
        }

        if (parceiroId) {
          updateData.parceiro_id = parceiroId;
          result.parceirosEncontrados++;
        }
      }

      if (pctTerceiro !== null && pctTerceiro > 0) {
        updateData.percentual_parceiro = pctTerceiro;
      }

      if (Object.keys(updateData).length > 0) {
        await supabase.from("clientes").update(updateData).eq("id", clienteId);
        result.clientesAtualizados++;
      }
    } catch (err) {
      result.erros.push(`${row.cliente}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return result;
}
