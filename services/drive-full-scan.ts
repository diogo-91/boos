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

async function listChildren(parentId: string) {
  const drive = getGoogleDriveClient();
  const items: Array<{ id: string; name: string; mimeType: string }> = [];
  let pageToken: string | undefined;

  do {
    const { data } = await drive.files.list({
      q: `'${parentId}' in parents and trashed = false`,
      fields: "nextPageToken,files(id,name,mimeType)",
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

async function findClienteByFolderId(folderId: string) {
  const { data } = await getSupabaseClient()
    .from("clientes")
    .select("id,nome,drive_path")
    .eq("drive_folder_id", folderId)
    .maybeSingle();
  return data ?? null;
}

async function findProcessoByFolderId(folderId: string) {
  const { data } = await getSupabaseClient()
    .from("processos")
    .select("id")
    .eq("drive_folder_id", folderId)
    .maybeSingle();
  return data ?? null;
}

async function ensureCliente(
  folderId: string,
  folderName: string,
  status: ClientStatus,
  statusFolderName: string
): Promise<{ id: string; nome: string; drive_path: string; created: boolean }> {
  const existing = await findClienteByFolderId(folderId);
  if (existing) {
    return { ...existing, drive_path: existing.drive_path ?? "", created: false };
  }

  const nome = folderNameToDisplayName(folderName);
  const drive_path = `${statusFolderName} › ${folderName}`;
  const id = crypto.randomUUID();

  const { error } = await getSupabaseClient().from("clientes").insert({
    id,
    nome,
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
    drive_path
  });

  if (error) throw error;
  return { id, nome, drive_path, created: true };
}

async function ensureProcesso(
  folderId: string,
  folderName: string,
  clienteId: string,
  clienteDrivePath: string
): Promise<boolean> {
  const existing = await findProcessoByFolderId(folderId);
  if (existing) return false;

  const { number, actionType } = parseProcessFolderName(folderName);

  const { error } = await getSupabaseClient().from("processos").insert({
    id: crypto.randomUUID(),
    cliente_id: clienteId,
    numero_cnj: number,
    tipo_acao: actionType || null,
    status: "em_andamento",
    drive_folder_id: folderId,
    drive_path: `${clienteDrivePath} › ${folderName}`
  });

  if (error) throw error;
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
};

export async function runFullScan(): Promise<FullScanResult> {
  const result: FullScanResult = {
    clientesFound: 0,
    clientesCreated: 0,
    processosFound: 0,
    processosCreated: 0,
    filesRead: 0,
    filesSkipped: 0,
    fileDetails: [],
    errors: []
  };

  const rootId = getGoogleDriveRootFolderId();
  const rootChildren = await listChildren(rootId);

  // Identifica as pastas de status na raiz
  const statusFolders: Array<{ id: string; name: string; status: ClientStatus }> = [];
  for (const item of rootChildren) {
    if (item.mimeType !== FOLDER_MIME) continue;
    const normalized = item.name.toLowerCase().replace(/\s+/g, "");
    const matched = Object.entries(STATUS_FOLDER_MAP).find(
      ([key]) => key.toLowerCase().replace(/\s+/g, "") === normalized
    );
    if (matched) statusFolders.push({ id: item.id, name: item.name, status: matched[1] });
  }

  for (const statusFolder of statusFolders) {
    const clienteFolders = await listChildren(statusFolder.id);

    for (const clienteItem of clienteFolders) {
      if (clienteItem.mimeType !== FOLDER_MIME) continue;

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
        }
      }
    }
  }

  return result;
}
