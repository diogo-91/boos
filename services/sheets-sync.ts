import { getGoogleDriveClient } from "@/lib/google/drive";
import { getSupabaseClient } from "@/lib/supabase/client";

const SHEET_ID = "1ZviC141NY47Xge4ntZFg3E2WngeIMTZGt_WOPz_771Q";

type SheetRow = {
  cliente: string;
  cnj: string;
  honorariosNathalia: string;
  honorariosTerceiro: string;
  indicacao: string;
};

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

export async function readSheetRows(): Promise<SheetRow[]> {
  const drive = getGoogleDriveClient();

  const res = await drive.files.export(
    { fileId: SHEET_ID, mimeType: "text/csv" },
    { responseType: "text" }
  );

  const lines = (res.data as string).trim().split("\n").slice(1); // pula cabeçalho
  const rows: SheetRow[] = [];

  for (const line of lines) {
    // Parse CSV respeitando campos com vírgula entre aspas
    const cols: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === "," && !inQuotes) { cols.push(current.trim()); current = ""; continue; }
      current += ch;
    }
    cols.push(current.trim());

    const [cliente, cnj, , honNath, honTer, , , indicacao] = cols;
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

export async function runSheetSync(): Promise<SheetSyncResult> {
  const result: SheetSyncResult = {
    total: 0,
    processosAtualizados: 0,
    clientesAtualizados: 0,
    parceirosEncontrados: 0,
    erros: []
  };

  const supabase = getSupabaseClient();
  const rows = await readSheetRows();
  result.total = rows.length;

  // Carrega todos os processos e clientes do banco de uma vez
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

      // 2. Se não achou pelo CNJ, tenta pelo nome do cliente
      if (!clienteId) {
        const nomeNorm = normalizeName(row.cliente);
        clienteId = clienteByNome.get(nomeNorm) ?? null;

        // Tenta match parcial (primeiras 2 palavras)
        if (!clienteId) {
          const palavras = nomeNorm.split(" ").slice(0, 2).join(" ");
          const entries = Array.from(clienteByNome.entries());
          for (const [nome, id] of entries) {
            if (nome.includes(palavras)) { clienteId = id; break; }
          }
        }

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

      if (!clienteId) continue;

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
