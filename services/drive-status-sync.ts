import type { ClientStatus } from "@/lib/types";
import { getSupabaseClient } from "@/lib/supabase/client";
import { STATUS_DB_MAP, folderNameToDisplayName, parseProcessFolderName } from "@/lib/drive-status-map";
import { hojeLocalISO } from "@/lib/date-utils";

export type DriveClienteRecord = { id: string; nome: string; drive_path: string };

export async function findClienteByDriveFolderId(folderId: string): Promise<DriveClienteRecord | null> {
  // .limit(1) é essencial aqui: sem ele, .maybeSingle() dá erro se houver mais
  // de uma linha com o mesmo drive_folder_id (cadastro duplicado por bug
  // anterior), o erro não é checado, e o cliente passa a parecer "não
  // encontrado" — criando mais uma duplicata a cada varredura, indefinidamente.
  const { data } = await getSupabaseClient()
    .from("clientes")
    .select("id,nome,drive_path")
    .eq("drive_folder_id", folderId)
    .limit(1)
    .maybeSingle();
  return data ? { ...data, drive_path: data.drive_path ?? "" } : null;
}

async function findClienteByNome(nome: string) {
  const { data } = await getSupabaseClient()
    .from("clientes")
    .select("id,nome,drive_path,drive_folder_id")
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

  await getSupabaseClient()
    .from("clientes")
    .update({ drive_folder_id: folderId, drive_path: drivePath })
    .eq("id", existing.id);

  return { id: existing.id, nome: existing.nome, drive_path: drivePath };
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
  const { error } = await getSupabaseClient().from("clientes").insert({
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
  return { cliente: { id, nome, drive_path }, created: true };
}

export async function updateClienteStatusFromFolder(
  folderId: string,
  status: ClientStatus,
  statusFolderName: string,
  folderName: string
) {
  const { error } = await getSupabaseClient()
    .from("clientes")
    .update({
      status: STATUS_DB_MAP[status],
      drive_path: `${statusFolderName} › ${folderName}`,
      data_ativacao: status === "Ativo" ? hojeLocalISO() : undefined,
      // undefined = "não mexe" pro Supabase — por isso reativar (voltar pra
      // Ativo) precisa mandar null explicitamente pra limpar uma
      // data_finalizacao antiga, senão o registro fica ativo com data de
      // finalização preenchida.
      data_finalizacao:
        status === "Arquivado" || status === "Cancelado"
          ? hojeLocalISO()
          : status === "Ativo"
            ? null
            : undefined
    })
    .eq("drive_folder_id", folderId);

  if (error) throw error;
}

export async function findProcessoByDriveFolderId(folderId: string) {
  const { data } = await getSupabaseClient()
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

  const { error } = await getSupabaseClient().from("processos").insert({
    id,
    cliente_id: clienteId,
    numero_cnj: number,
    tipo_acao: actionType || null,
    status: "em_andamento",
    drive_folder_id: folderId,
    drive_path: `${clienteDrivePath} › ${folderName}`
  });

  if (error) throw error;
  return id;
}
