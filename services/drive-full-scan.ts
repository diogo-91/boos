import type { ClientStatus } from "@/lib/types";
import { getGoogleDriveClient, getGoogleDriveRootFolderId } from "@/lib/google/drive";
import { getSupabaseClient } from "@/lib/supabase/client";
import { readDriveFile } from "@/services/ai-document-reader";
import { FOLDER_MIME, STATUS_FOLDER_MAP, matchStatusFolderKey } from "@/lib/drive-status-map";
import {
  createProcessoFromFolder,
  findClienteByDriveFolderId,
  findProcessoByDriveFolderId,
  linkOrCreateClienteFromFolder
} from "@/services/drive-status-sync";

async function listChildren(parentId: string) {
  const drive = getGoogleDriveClient();
  const items: Array<{ id: string; name: string; mimeType: string }> = [];
  let pageToken: string | undefined;

  do {
    const { data } = await drive.files.list({
      q: `'${parentId}' in parents and trashed = false`,
      fields: "nextPageToken,files(id,name,mimeType)",
      orderBy: "name",
      pageSize: 100,
      pageToken
    });
    for (const f of data.files ?? []) {
      if (f.id && f.name && f.mimeType) {
        items.push({ id: f.id, name: f.name, mimeType: f.mimeType });
      }
    }
    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken);

  return items;
}

type ScanCheckpoint = { statusFolderId: string | null; clienteFolderId: string | null };

async function getCheckpoint(): Promise<ScanCheckpoint> {
  const { data } = await getSupabaseClient()
    .from("drive_scan_checkpoint")
    .select("status_folder_id,cliente_folder_id")
    .eq("id", "singleton")
    .maybeSingle();

  return {
    statusFolderId: data?.status_folder_id ?? null,
    clienteFolderId: data?.cliente_folder_id ?? null
  };
}

async function saveCheckpoint(statusFolderId: string | null, clienteFolderId: string | null) {
  const { error } = await getSupabaseClient().from("drive_scan_checkpoint").upsert({
    id: "singleton",
    status_folder_id: statusFolderId,
    cliente_folder_id: clienteFolderId,
    updated_at: new Date().toISOString()
  });

  if (error) throw error;
}

async function clearCheckpoint() {
  await saveCheckpoint(null, null);
}

async function ensureCliente(
  folderId: string,
  folderName: string,
  status: ClientStatus,
  statusFolderName: string
): Promise<{ id: string; nome: string; drive_path: string; created: boolean }> {
  const existing = await findClienteByDriveFolderId(folderId);
  if (existing) return { ...existing, created: false };

  const { cliente, created } = await linkOrCreateClienteFromFolder(
    folderId,
    folderName,
    status,
    statusFolderName
  );
  return { ...cliente, created };
}

async function ensureProcesso(
  folderId: string,
  folderName: string,
  clienteId: string,
  clienteDrivePath: string
): Promise<boolean> {
  const existing = await findProcessoByDriveFolderId(folderId);
  if (existing) return false;

  await createProcessoFromFolder(folderId, folderName, clienteId, clienteDrivePath);
  return true;
}

export type FileReadDetail = {
  fileName: string;
  documentType: string;
  fieldsExtracted: string[];
  skipped: boolean;
  skipReason?: string;
  clienteNome?: string;
};

export type FullScanResult = {
  clientesFound: number;
  clientesCreated: number;
  processosFound: number;
  processosCreated: number;
  filesRead: number;
  filesSkipped: number;
  fileDetails: FileReadDetail[];
  errors: string[];
  timedOut: boolean;
  resumedFromCheckpoint: boolean;
};

// Deixa margem de segurança para o limite de 5 min (300s) da function.
const MAX_DURATION_MS = 4.5 * 60 * 1000;

// Antes, o corte de tempo só era checado depois de terminar um cliente
// inteiro — um cliente com volume muito grande de arquivos podia estourar o
// maxDuration da plataforma antes de qualquer checkpoint ser salvo. Chamado
// também depois de cada arquivo lido, não só depois de cada cliente.
async function handleTimeoutIfNeeded(
  result: FullScanResult,
  startedAt: number,
  statusFolderId: string,
  clienteFolderId: string
): Promise<boolean> {
  if (Date.now() - startedAt <= MAX_DURATION_MS) return false;

  try {
    await saveCheckpoint(statusFolderId, clienteFolderId);
  } catch (err) {
    result.errors.push(`[checkpoint] Falha ao salvar ponto de retomada: ${err instanceof Error ? err.message : String(err)}`);
  }
  result.timedOut = true;
  return true;
}

export async function runFullScan(): Promise<FullScanResult> {
  const startedAt = Date.now();

  const result: FullScanResult = {
    clientesFound: 0,
    clientesCreated: 0,
    processosFound: 0,
    processosCreated: 0,
    filesRead: 0,
    filesSkipped: 0,
    fileDetails: [],
    errors: [],
    timedOut: false,
    resumedFromCheckpoint: false
  };

  const checkpoint = await getCheckpoint();
  result.resumedFromCheckpoint = Boolean(checkpoint.statusFolderId);
  let skipUntilStatusFolder = Boolean(checkpoint.statusFolderId);
  let skipUntilClienteFolder = Boolean(checkpoint.clienteFolderId);

  const rootId = getGoogleDriveRootFolderId();
  const rootChildren = await listChildren(rootId);

  // Identifica as pastas de status na raiz
  const statusFolders: Array<{ id: string; name: string; status: ClientStatus }> = [];
  for (const item of rootChildren) {
    if (item.mimeType !== FOLDER_MIME) continue;
    const key = matchStatusFolderKey(item.name);
    if (key) statusFolders.push({ id: item.id, name: item.name, status: STATUS_FOLDER_MAP[key] });
  }

  statusLoop: for (const statusFolder of statusFolders) {
    if (skipUntilStatusFolder) {
      if (statusFolder.id !== checkpoint.statusFolderId) continue;
      skipUntilStatusFolder = false;
    }

    const clienteFolders = await listChildren(statusFolder.id);

    for (const clienteItem of clienteFolders) {
      if (clienteItem.mimeType !== FOLDER_MIME) continue;

      if (skipUntilClienteFolder) {
        if (clienteItem.id !== checkpoint.clienteFolderId) continue;
        // Esse cliente já foi totalmente processado antes da última parada — pula ele também.
        skipUntilClienteFolder = false;
        continue;
      }

      result.clientesFound++;

      let cliente: { id: string; nome: string; drive_path: string; created: boolean };
      try {
        cliente = await ensureCliente(
          clienteItem.id,
          clienteItem.name,
          statusFolder.status,
          statusFolder.name
        );
        if (cliente.created) result.clientesCreated++;
      } catch (err) {
        result.errors.push(`[cliente] ${clienteItem.name}: ${err instanceof Error ? err.message : String(err)}`);
        continue;
      }

      // Percorre conteúdo da pasta do cliente
      const clienteChildren = await listChildren(clienteItem.id);

      for (const child of clienteChildren) {
        if (child.mimeType === FOLDER_MIME) {
          // Subpasta = processo
          result.processosFound++;
          try {
            const created = await ensureProcesso(
              child.id,
              child.name,
              cliente.id,
              cliente.drive_path
            );
            if (created) result.processosCreated++;
          } catch (err) {
            result.errors.push(`[processo] ${child.name}: ${err instanceof Error ? err.message : String(err)}`);
          }

          // Lê arquivos dentro da pasta do processo
          const processoChildren = await listChildren(child.id);
          for (const file of processoChildren) {
            if (file.mimeType === FOLDER_MIME) continue;
            try {
              const read = await readDriveFile(file.id, file.name, child.id);
              result.fileDetails.push({
                fileName: file.name,
                documentType: read.documentType,
                fieldsExtracted: read.fieldsExtracted,
                skipped: read.skipped,
                skipReason: read.skipReason,
                clienteNome: cliente.nome
              });
              if (!read.skipped && read.fieldsExtracted.length > 0) result.filesRead++;
              else if (read.skipped) result.filesSkipped++;
            } catch (err) {
              result.errors.push(`[arquivo] ${file.name}: ${err instanceof Error ? err.message : JSON.stringify(err)}`);
            }

            if (await handleTimeoutIfNeeded(result, startedAt, statusFolder.id, clienteItem.id)) {
              break statusLoop;
            }
          }
        } else {
          // Arquivo direto na pasta do cliente
          try {
            const read = await readDriveFile(child.id, child.name, clienteItem.id);
            result.fileDetails.push({
              fileName: child.name,
              documentType: read.documentType,
              fieldsExtracted: read.fieldsExtracted,
              skipped: read.skipped,
              skipReason: read.skipReason,
              clienteNome: cliente.nome
            });
            if (!read.skipped && read.fieldsExtracted.length > 0) result.filesRead++;
            else if (read.skipped) result.filesSkipped++;
          } catch (err) {
            result.errors.push(`[arquivo] ${child.name}: ${err instanceof Error ? err.message : JSON.stringify(err)}`);
          }

          if (await handleTimeoutIfNeeded(result, startedAt, statusFolder.id, clienteItem.id)) {
            break statusLoop;
          }
        }
      }

      if (await handleTimeoutIfNeeded(result, startedAt, statusFolder.id, clienteItem.id)) {
        break statusLoop;
      }
    }

    // A pasta do cliente do checkpoint não apareceu nesta pasta de status —
    // provavelmente mudou de status (e de pasta física) entre a execução que
    // salvou o checkpoint e esta retomada. Sem este reset, skipUntilClienteFolder
    // continuaria true para as pastas de status seguintes e todo o resto da
    // varredura seria pulado em silêncio.
    if (skipUntilClienteFolder) {
      result.errors.push(
        `[checkpoint] Cliente do ponto de retomada não encontrado na pasta "${statusFolder.name}" (pode ter mudado de status entre execuções). Retomando normalmente a partir daqui.`
      );
      skipUntilClienteFolder = false;
    }
  }

  if (!result.timedOut) {
    try {
      await clearCheckpoint();
    } catch (err) {
      result.errors.push(`[checkpoint] Falha ao limpar ponto de retomada: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return result;
}
