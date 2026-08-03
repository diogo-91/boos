import type { ClientStatus } from "@/lib/types";
import { getGoogleDriveClient, getGoogleDriveRootFolderId } from "@/lib/google/drive";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { readDriveFile } from "@/services/ai-document-reader";
import { FOLDER_MIME, STATUS_FOLDER_MAP, matchStatusFolderKey } from "@/lib/drive-status-map";
import {
  createProcessoFromFolder,
  findClienteByDriveFolderId,
  findProcessoByDriveFolderId,
  linkOrCreateClienteFromFolder,
  updateClienteStatusFromFolder
} from "@/services/drive-status-sync";

async function getSyncToken(): Promise<string | null> {
  const { data } = await getSupabaseServiceClient()
    .from("drive_sync_tokens")
    .select("page_token")
    .eq("id", "singleton")
    .maybeSingle();
  return data?.page_token ?? null;
}

async function saveSyncToken(token: string) {
  await getSupabaseServiceClient()
    .from("drive_sync_tokens")
    .upsert({ id: "singleton", page_token: token, updated_at: new Date().toISOString() });
}

async function getStartPageToken(): Promise<string> {
  const { data } = await getGoogleDriveClient().changes.getStartPageToken({});
  if (!data.startPageToken) throw new Error("Não foi possível obter o startPageToken.");
  return data.startPageToken;
}

async function getStatusFolderIds(): Promise<Record<string, ClientStatus>> {
  const result: Record<string, ClientStatus> = {};
  let pageToken: string | undefined;

  // Sem paginação, mais de 20 subpastas na raiz (pastas de status + qualquer
  // outra coisa manual) deixava pastas de status fora da primeira página de
  // fora do sync incremental, em silêncio.
  do {
    const { data } = await getGoogleDriveClient().files.list({
      q: `'${getGoogleDriveRootFolderId()}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`,
      fields: "nextPageToken,files(id,name)",
      pageSize: 100,
      pageToken
    });

    for (const file of data.files ?? []) {
      if (!file.id || !file.name) continue;
      const key = matchStatusFolderKey(file.name);
      if (key) result[file.id] = STATUS_FOLDER_MAP[key];
    }

    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken);

  return result;
}

async function getFileParentId(fileId: string): Promise<string | null> {
  const { data } = await getGoogleDriveClient().files.get({ fileId, fields: "parents" });
  return data.parents?.[0] ?? null;
}

async function criarProcessoAutomatico(folderId: string, folderName: string, clienteFolderId: string) {
  const cliente = await findClienteByDriveFolderId(clienteFolderId);
  if (!cliente) return;

  await createProcessoFromFolder(folderId, folderName, cliente.id, cliente.drive_path || cliente.nome);
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
    const changesPage = await getGoogleDriveClient().changes.list({
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

          const existing = await findClienteByDriveFolderId(file.id);
          if (!existing) {
            const { created } = await linkOrCreateClienteFromFolder(
              file.id,
              file.name!,
              status,
              statusFolderName
            );
            if (created) result.clientesCreated++;
          } else {
            await updateClienteStatusFromFolder(file.id, status, statusFolderName, file.name!);
            result.statusUpdated++;
          }
        } else {
          const grandParentId = await getFileParentId(parentId);
          if (!grandParentId || !statusFolderIdSet.has(grandParentId)) continue;

          const existing = await findProcessoByDriveFolderId(file.id);
          if (!existing) {
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
