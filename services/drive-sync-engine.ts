import type { ClientStatus } from "@/lib/types";
import { getGoogleDriveClient, getGoogleDriveRootFolderId } from "@/lib/google/drive";
import { getSupabaseClient } from "@/lib/supabase/client";
import { readDriveFile } from "@/services/ai-document-reader";
import {
  FOLDER_MIME,
  STATUS_FOLDER_MAP,
  STATUS_DB_MAP,
  folderNameToDisplayName,
  parseProcessFolderName
} from "@/lib/drive-status-map";

async function getSyncToken(): Promise<string | null> {
  const { data } = await getSupabaseClient()
    .from("drive_sync_tokens")
    .select("page_token")
    .eq("id", "singleton")
    .maybeSingle();
  return data?.page_token ?? null;
}

async function saveSyncToken(token: string) {
  await getSupabaseClient()
    .from("drive_sync_tokens")
    .upsert({ id: "singleton", page_token: token, updated_at: new Date().toISOString() });
}

async function getStartPageToken(): Promise<string> {
  const { data } = await getGoogleDriveClient().changes.getStartPageToken({});
  if (!data.startPageToken) throw new Error("Não foi possível obter o startPageToken.");
  return data.startPageToken;
}

async function getStatusFolderIds(): Promise<Record<string, ClientStatus>> {
  const { data } = await getGoogleDriveClient().files.list({
    q: `'${getGoogleDriveRootFolderId()}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`,
    fields: "files(id,name)",
    pageSize: 20
  });

  const result: Record<string, ClientStatus> = {};
  for (const file of data.files ?? []) {
    if (!file.id || !file.name) continue;
    const normalized = file.name.toLowerCase().replace(/\s+/g, "");
    const matched = Object.entries(STATUS_FOLDER_MAP).find(
      ([key]) => key.toLowerCase().replace(/\s+/g, "") === normalized
    );
    if (matched) result[file.id] = matched[1];
  }
  return result;
}

async function getFileParentId(fileId: string): Promise<string | null> {
  const { data } = await getGoogleDriveClient().files.get({ fileId, fields: "parents" });
  return data.parents?.[0] ?? null;
}

async function clienteExistsByDriveFolderId(folderId: string): Promise<boolean> {
  const { data } = await getSupabaseClient()
    .from("clientes")
    .select("id")
    .eq("drive_folder_id", folderId)
    .maybeSingle();
  return Boolean(data);
}

async function processoExistsByDriveFolderId(folderId: string): Promise<boolean> {
  const { data } = await getSupabaseClient()
    .from("processos")
    .select("id")
    .eq("drive_folder_id", folderId)
    .maybeSingle();
  return Boolean(data);
}

async function getClienteByDriveFolderId(folderId: string) {
  const { data } = await getSupabaseClient()
    .from("clientes")
    .select("id,nome,drive_path")
    .eq("drive_folder_id", folderId)
    .maybeSingle();
  return data ?? null;
}

async function criarClienteAutomatico(
  folderId: string,
  folderName: string,
  status: ClientStatus,
  statusFolderName: string
) {
  const { error } = await getSupabaseClient().from("clientes").insert({
    id: crypto.randomUUID(),
    nome: folderNameToDisplayName(folderName),
    tipo: "PF",
    status: STATUS_DB_MAP[status],
    cpf_cnpj: "",
    rg_ie: "",
    data_cadastro: new Date().toISOString().slice(0, 10),
    data_ativacao: status === "Ativo" ? new Date().toISOString().slice(0, 10) : null,
    data_finalizacao:
      status === "Arquivado" || status === "Cancelado"
        ? new Date().toISOString().slice(0, 10)
        : null,
    drive_folder_id: folderId,
    drive_path: `${statusFolderName} › ${folderName}`
  });

  if (error) throw error;
}

async function criarProcessoAutomatico(
  folderId: string,
  folderName: string,
  clienteFolderId: string
) {
  const cliente = await getClienteByDriveFolderId(clienteFolderId);
  if (!cliente) return;

  const { number, actionType } = parseProcessFolderName(folderName);

  const { error } = await getSupabaseClient().from("processos").insert({
    id: crypto.randomUUID(),
    cliente_id: cliente.id,
    numero_cnj: number,
    tipo_acao: actionType || null,
    status: "em_andamento",
    drive_folder_id: folderId,
    drive_path: `${cliente.drive_path ?? cliente.nome} › ${folderName}`
  });

  if (error) throw error;
}

async function atualizarStatusClientePorPasta(
  folderId: string,
  novoStatus: ClientStatus,
  statusFolderName: string,
  folderName: string
) {
  const { error } = await getSupabaseClient()
    .from("clientes")
    .update({
      status: STATUS_DB_MAP[novoStatus],
      drive_path: `${statusFolderName} › ${folderName}`,
      data_ativacao: novoStatus === "Ativo" ? new Date().toISOString().slice(0, 10) : undefined,
      data_finalizacao:
        novoStatus === "Arquivado" || novoStatus === "Cancelado"
          ? new Date().toISOString().slice(0, 10)
          : undefined
    })
    .eq("drive_folder_id", folderId);

  if (error) throw error;
}

export type SyncResult = {
  processed: number;
  clientesCreated: number;
  processosCreated: number;
  statusUpdated: number;
  filesRead: number;
  errors: string[];
};

export async function runDriveSync(): Promise<SyncResult> {
  const result: SyncResult = {
    processed: 0,
    clientesCreated: 0,
    processosCreated: 0,
    statusUpdated: 0,
    filesRead: 0,
    errors: []
  };

  let pageToken = await getSyncToken();
  if (!pageToken) {
    pageToken = await getStartPageToken();
    await saveSyncToken(pageToken);
    return result;
  }

  const statusFolderIds = await getStatusFolderIds();
  const statusFolderIdSet = new Set(Object.keys(statusFolderIds));

  let nextPageToken: string | null | undefined = pageToken;

  while (nextPageToken) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const changesPage: any = await getGoogleDriveClient().changes.list({
      pageToken: nextPageToken,
      fields: "nextPageToken,newStartPageToken,changes(fileId,removed,file(id,name,mimeType,parents,trashed))",
      includeItemsFromAllDrives: false,
      supportsAllDrives: false,
      pageSize: 100
    });

    const changesData = changesPage.data as {
      changes?: Array<{
        fileId?: string;
        removed?: boolean;
        file?: { id?: string; name?: string; mimeType?: string; parents?: string[]; trashed?: boolean };
      }>;
      nextPageToken?: string;
      newStartPageToken?: string;
    };

    for (const change of changesData.changes ?? []) {
      const file = change.file;
      if (!file?.id || file.trashed || change.removed) continue;

      const isFolder = file.mimeType === FOLDER_MIME;
      const parentId = file.parents?.[0];
      if (!parentId) continue;

      result.processed++;

      if (!isFolder) {
        try {
          const readResult = await readDriveFile(file.id, file.name!, parentId);
          if (!readResult.skipped && readResult.fieldsExtracted.length > 0) {
            result.filesRead++;
          }
        } catch (err) {
          result.errors.push(`[arquivo] ${file.name}: ${err instanceof Error ? err.message : String(err)}`);
        }
        continue;
      }

      try {
        if (statusFolderIdSet.has(parentId)) {
          const status = statusFolderIds[parentId];
          const statusFolderName =
            Object.entries(STATUS_FOLDER_MAP).find(([, v]) => v === status)?.[0] ?? "";

          const exists = await clienteExistsByDriveFolderId(file.id);
          if (!exists) {
            await criarClienteAutomatico(file.id, file.name!, status, statusFolderName);
            result.clientesCreated++;
          } else {
            await atualizarStatusClientePorPasta(file.id, status, statusFolderName, file.name!);
            result.statusUpdated++;
          }
        } else {
          const grandParentId = await getFileParentId(parentId);
          if (!grandParentId || !statusFolderIdSet.has(grandParentId)) continue;

          const exists = await processoExistsByDriveFolderId(file.id);
          if (!exists) {
            await criarProcessoAutomatico(file.id, file.name!, parentId);
            result.processosCreated++;
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`${file.name}: ${msg}`);
        console.error(`[DriveSync] Erro ao processar ${file.name}:`, err);
      }
    }

    if (changesData.newStartPageToken) {
      await saveSyncToken(changesData.newStartPageToken);
      break;
    }

    nextPageToken = changesData.nextPageToken;
  }

  return result;
}
