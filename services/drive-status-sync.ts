import type { ClientStatus } from "@/lib/types";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { STATUS_DB_MAP, datasDeTransicao, folderNameToDisplayName, parseProcessFolderName } from "@/lib/drive-status-map";
import { hojeLocalISO } from "@/lib/date-utils";

export type DriveClienteRecord = { id: string; nome: string; drive_path: string; status: string };

export async function findClienteByDriveFolderId(folderId: string): Promise<DriveClienteRecord | null> {
  // .limit(1) é essencial aqui: sem ele, .maybeSingle() dá erro se houver mais
  // de uma linha com o mesmo drive_folder_id (cadastro duplicado por bug
  // anterior), o erro não é checado, e o cliente passa a parecer "não
  // encontrado" — criando mais uma duplicata a cada varredura, indefinidamente.
  const { data } = await getSupabaseServiceClient()
    .from("clientes")
    .select("id,nome,drive_path,status")
    .eq("drive_folder_id", folderId)
    .limit(1)
    .maybeSingle();
  return data ? { ...data, drive_path: data.drive_path ?? "" } : null;
}

async function findClienteByNome(nome: string) {
  const { data } = await getSupabaseServiceClient()
    .from("clientes")
    .select("id,nome,drive_path,drive_folder_id,status")
    .eq("nome", nome);

  const candidates = data ?? [];

  // Mais de um cliente cadastrado com o mesmo nome (homônimos reais) — não dá
  // pra saber qual pasta pertence a qual sem ambiguidade. Melhor sinalizar e
  // não vincular ninguém do que vincular a pasta de uma pessoa ao cadastro
  // de outra (mesmo risco do C2, aqui pelo caminho da varredura completa).
  if (candidates.length > 1) return { ambiguous: true as const, cliente: null };

  return { ambiguous: false as const, cliente: candidates[0] ?? null };
}

// Pasta recriada/duplicada no Drive para um cliente que já existe no
// sistema — vincula em vez de criar um cadastro duplicado.
async function linkExistingClienteToFolder(
  folderId: string,
  drivePath: string,
  nome: string
): Promise<DriveClienteRecord | null> {
  const { ambiguous, cliente: existing } = await findClienteByNome(nome);

  if (ambiguous) {
    throw new Error(
      `Mais de um cliente cadastrado com o nome "${nome}" — vínculo da pasta não pôde ser feito automaticamente, verifique manualmente.`
    );
  }

  if (!existing) return null;

  // Esta função só roda quando findClienteByDriveFolderId(folderId) já não
  // achou ninguém pra ESTA pasta — então, se o cliente achado por nome já
  // tem uma pasta vinculada, ela necessariamente é OUTRA pasta. Isso não é
  // o caso legítimo de "pasta recriada" (aquele cliente já tem a dele) — é
  // homônimo: nome igual, pessoa diferente. Não vincula a pasta errada.
  if (existing.drive_folder_id) {
    throw new Error(
      `Cliente "${nome}" já possui outra pasta vinculada — a pasta ${folderId} parece ser de um homônimo, verifique manualmente.`
    );
  }

  await getSupabaseServiceClient()
    .from("clientes")
    .update({ drive_folder_id: folderId, drive_path: drivePath })
    .eq("id", existing.id);

  return { id: existing.id, nome: existing.nome, drive_path: drivePath, status: existing.status };
}

export async function linkOrCreateClienteFromFolder(
  folderId: string,
  folderName: string,
  status: ClientStatus,
  statusFolderName: string
): Promise<{ cliente: DriveClienteRecord; created: boolean }> {
  const nome = folderNameToDisplayName(folderName);
  const drive_path = `${statusFolderName} › ${folderName}`;

  const linked = await linkExistingClienteToFolder(folderId, drive_path, nome);
  if (linked) return { cliente: linked, created: false };

  const id = crypto.randomUUID();
  const { error } = await getSupabaseServiceClient().from("clientes").insert({
    id,
    nome,
    tipo: "PF",
    status: STATUS_DB_MAP[status],
    cpf_cnpj: "",
    rg_ie: "",
    data_cadastro: hojeLocalISO(),
    data_ativacao: status === "Ativo" ? hojeLocalISO() : null,
    data_finalizacao:
      status === "Arquivado" || status === "Cancelado"
        ? hojeLocalISO()
        : null,
    drive_folder_id: folderId,
    drive_path
  });

  if (error) throw error;
  return { cliente: { id, nome, drive_path, status: STATUS_DB_MAP[status] }, created: true };
}

export async function updateClienteStatusFromFolder(
  folderId: string,
  status: ClientStatus,
  statusFolderName: string,
  folderName: string
) {
  // Qualquer mudança na pasta (inclusive rename) chega aqui — as datas de
  // ciclo de vida só podem ser gravadas quando o STATUS de fato mudou,
  // senão renomear a pasta de um ativo reseta a data_ativacao pra hoje.
  // A decisão mora em datasDeTransicao (lib), que também trata "audiencia"
  // como subestado de ativo para o eco do Drive não reverter a marcação.
  const existing = await findClienteByDriveFolderId(folderId);
  if (!existing) return;

  const datas = datasDeTransicao(existing.status, status, hojeLocalISO());
  const houveTransicao = Object.keys(datas).length > 0;

  const { error } = await getSupabaseServiceClient()
    .from("clientes")
    .update({
      // Status só em transição real (datasDeTransicao já normaliza
      // "audiencia" como subestado de ativo) — senão o eco de um rename
      // reverteria a marcação de Audiência para "ativo".
      status: houveTransicao ? STATUS_DB_MAP[status] : undefined,
      drive_path: `${statusFolderName} › ${folderName}`,
      ...datas
    })
    .eq("drive_folder_id", folderId);

  if (error) throw error;
}

export async function findProcessoByDriveFolderId(folderId: string) {
  const { data } = await getSupabaseServiceClient()
    .from("processos")
    .select("id,cliente_id")
    .eq("drive_folder_id", folderId)
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export async function createProcessoFromFolder(
  folderId: string,
  folderName: string,
  clienteId: string,
  clienteDrivePath: string
): Promise<string> {
  const { number, actionType } = parseProcessFolderName(folderName);
  const id = crypto.randomUUID();

  const { error } = await getSupabaseServiceClient().from("processos").insert({
    id,
    cliente_id: clienteId,
    numero_cnj: number,
    tipo_acao: actionType || null,
    status: "em_andamento",
    data_cadastro: hojeLocalISO(),
    drive_folder_id: folderId,
    drive_path: `${clienteDrivePath} › ${folderName}`
  });

  if (error) throw error;
  return id;
}
