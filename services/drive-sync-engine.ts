import type { ClientStatus } from "@/lib/types";
import { getGoogleDriveClient, getGoogleDriveRootFolderId, getGoogleSharedDriveId } from "@/lib/google/drive";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { readDriveFile } from "@/services/ai-document-reader";
import { FOLDER_MIME, STATUS_FOLDER_MAP, isReservedClientSubfolder, matchStatusFolderKey } from "@/lib/drive-status-map";
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
  const { error } = await getSupabaseServiceClient()
    .from("drive_sync_tokens")
    .upsert({ id: "singleton", page_token: token, updated_at: new Date().toISOString() });

  if (error) throw error;
}

async function getStartPageToken(): Promise<string> {
  const driveId = await getGoogleSharedDriveId();
  const { data } = await getGoogleDriveClient().changes.getStartPageToken(
    driveId ? { driveId, supportsAllDrives: true } : {}
  );
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
      pageToken,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true
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
  const { data } = await getGoogleDriveClient().files.get({
    fileId,
    fields: "parents",
    supportsAllDrives: true
  });
  return data.parents?.[0] ?? null;
}

async function criarProcessoAutomatico(folderId: string, folderName: string, clienteFolderId: string) {
  const cliente = await findClienteByDriveFolderId(clienteFolderId);
  if (!cliente) return;

  await createProcessoFromFolder(folderId, folderName, cliente.id, cliente.drive_path || cliente.nome);
}

// O Google invalida o pageToken (400/410) se ele ficar muito tempo sem ser
// consumido — ex.: cron parado, falha de rede persistente. Sem esse check o
// sync ficava travado para sempre reusando o mesmo token quebrado.
function isInvalidPageTokenError(err: unknown): boolean {
  const status = (err as { code?: number; status?: number; response?: { status?: number } })?.code
    ?? (err as { status?: number })?.status
    ?? (err as { response?: { status?: number } })?.response?.status;
  return status === 400 || status === 410;
}

// Deixa margem de segurança para o maxDuration=300s da rota (app/api/drive/sync/route.ts).
// Mesmo padrão do full-scan (MAX_DURATION_MS em drive-full-scan.ts).
const MAX_DURATION_MS = 4 * 60 * 1000;

export type SyncResult = {
  processed: number;
  clientesCreated: number;
  processosCreated: number;
  statusUpdated: number;
  filesRead: number;
  subpastasReservadasPuladas: number;
  errors: string[];
  timedOut: boolean;
};

export async function runDriveSync(): Promise<SyncResult> {
  const startedAt = Date.now();
  const result: SyncResult = {
    processed: 0,
    clientesCreated: 0,
    processosCreated: 0,
    statusUpdated: 0,
    filesRead: 0,
    subpastasReservadasPuladas: 0,
    errors: [],
    timedOut: false
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
  const driveId = await getGoogleSharedDriveId();

  while (nextPageToken) {
    let changesPage;
    try {
      changesPage = await getGoogleDriveClient().changes.list({
        pageToken: nextPageToken,
        fields: "nextPageToken,newStartPageToken,changes(fileId,removed,file(id,name,mimeType,parents,trashed))",
        includeItemsFromAllDrives: Boolean(driveId),
        supportsAllDrives: Boolean(driveId),
        driveId: driveId ?? undefined,
        pageSize: 100
      });
    } catch (err) {
      if (!isInvalidPageTokenError(err)) throw err;

      console.error("[DriveSync] page_token inválido/expirado — resetando cursor.", err);
      const freshToken = await getStartPageToken();
      await saveSyncToken(freshToken);
      result.errors.push(
        "Cursor de sincronização expirado; foi resetado automaticamente. Rode uma varredura completa para capturar o que ficou de fora enquanto o sync estava travado."
      );
      return result;
    }

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
      if (!file?.id || !file.name || file.trashed || change.removed) continue;

      const isFolder = file.mimeType === FOLDER_MIME;
      const parentId = file.parents?.[0];
      if (!parentId) continue;

      result.processed++;

      if (!isFolder) {
        try {
          const readResult = await readDriveFile(file.id, file.name, parentId);
          if (!readResult.skipped && readResult.fieldsExtracted.length > 0) {
            result.filesRead++;
          }
        } catch (err) {
          result.errors.push(`[arquivo] ${file.name}: ${err instanceof Error ? err.message : String(err)}`);
        }

        // Corte de tempo por item: leitura de arquivo por IA custa 2,4s+
        // cada, e uma página de 100 arquivos novos pode sozinha estourar os
        // 300s da rota antes de a página inteira terminar — o corte só
        // entre páginas (abaixo) não protege esse caso. Retorna sem salvar
        // o cursor desta página: ela será reprocessada inteira na próxima
        // chamada, e readDriveFile é idempotente por modifiedTime (arquivo
        // já lido é pulado de novo, rápido).
        if (Date.now() - startedAt > MAX_DURATION_MS) {
          result.timedOut = true;
          return result;
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
              file.name,
              status,
              statusFolderName
            );
            if (created) result.clientesCreated++;
          } else {
            await updateClienteStatusFromFolder(file.id, status, statusFolderName, file.name);
            result.statusUpdated++;
          }
        } else {
          // Subpasta reservada (documentos_pessoais, comunicacao etc.),
          // criada pelo próprio app dentro da pasta de cliente — não é
          // processo. Checa antes de gastar um files.get em getFileParentId:
          // os dois caminhos terminam em continue, então checar primeiro
          // evita a chamada de rede quando o nome já resolve o caso.
          if (isReservedClientSubfolder(file.name)) {
            result.subpastasReservadasPuladas++;
            continue;
          }

          const grandParentId = await getFileParentId(parentId);
          if (!grandParentId || !statusFolderIdSet.has(grandParentId)) continue;

          const existing = await findProcessoByDriveFolderId(file.id);
          if (!existing) {
            await criarProcessoAutomatico(file.id, file.name, parentId);
            result.processosCreated++;
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`${file.name}: ${msg}`);
        console.error(`[DriveSync] Erro ao processar ${file.name}:`, err);
      }
    }

    // Só salva o cursor DEPOIS de processar a página com sucesso (loop de
    // changes acima já terminou) — se a função for interrompida antes
    // disso, a próxima execução reprocessa esta página em vez de perder
    // changes não processados.
    if (changesData.newStartPageToken) {
      await saveSyncToken(changesData.newStartPageToken);
      break;
    }

    if (changesData.nextPageToken) {
      await saveSyncToken(changesData.nextPageToken);
    }

    nextPageToken = changesData.nextPageToken;

    // Corte de tempo entre páginas: com o cursor da página recém-processada
    // já salvo acima, é seguro parar aqui e deixar a próxima execução
    // continuar de onde esta parou, em vez de reprocessar tudo de novo
    // (risco descrito no PRD: milhares de changes de uma migração em massa
    // podem nunca caber nos 300s da function, e sem persistir por página o
    // cursor nunca avançava).
    if (nextPageToken && Date.now() - startedAt > MAX_DURATION_MS) {
      result.timedOut = true;
      break;
    }
  }

  return result;
}
