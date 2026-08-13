import type { Client, ClientStatus, LegalProcess } from "@/lib/types";
import {
  getGoogleDriveClient,
  getGoogleDriveRootFolderId
} from "@/lib/google/drive";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { CLIENT_SUBFOLDER_NAMES, FOLDER_MIME, PROCESS_SUBFOLDER_NAMES } from "@/lib/drive-status-map";

const STATUS_FOLDER_NAMES: Record<string, string> = {
  arquivado: "01_arquivados",
  ativo: "02_ativos",
  cancelado: "03_cancelados",
  contratacao: "04_contratacao",
  dativo: "05_dativos",
  parceiros: "06_parceiros",
  sarandi: "07_sarandi"
};

function sanitizeFolderName(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/(^_|_$)/g, "") || "registro"
  );
}

export function escapeQueryValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function statusToFolderKey(status: ClientStatus | string) {
  switch (status) {
    case "Ativo":
    // "Audiência" não tem pasta própria — cliente com audiência marcada
    // continua em andamento, então segue na pasta de ativos.
    case "Audiência":
      return "ativo";
    case "Arquivado":
      return "arquivado";
    case "Cancelado":
      return "cancelado";
    case "Dativo":
      return "dativo";
    case "Sarandi":
      return "sarandi";
    case "Parceiros":
      return "parceiros";
    case "Contratação":
    default:
      return "contratacao";
  }
}

async function getFolderParents(folderId: string) {
  const drive = getGoogleDriveClient();
  const { data } = await drive.files.get({
    fileId: folderId,
    fields: "parents",
    supportsAllDrives: true
  });
  return data.parents ?? [];
}

async function createFolder(name: string, parentId: string) {
  const drive = getGoogleDriveClient();
  const { data } = await drive.files.create({
    requestBody: { name, mimeType: FOLDER_MIME, parents: [parentId] },
    fields: "id,name",
    supportsAllDrives: true
  });

  if (!data.id) {
    throw new Error(`Não foi possível criar a pasta "${name}" no Google Drive.`);
  }

  return { id: data.id, name: data.name ?? name };
}

export async function findOrCreateFolder(name: string, parentId: string) {
  const drive = getGoogleDriveClient();
  const safeName = escapeQueryValue(name);
  const safeParentId = escapeQueryValue(parentId);

  const { data } = await drive.files.list({
    q: [
      `name = '${safeName}'`,
      `mimeType = '${FOLDER_MIME}'`,
      `'${safeParentId}' in parents`,
      "trashed = false"
    ].join(" and "),
    fields: "files(id,name)",
    spaces: "drive",
    pageSize: 1,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true
  });

  const existing = data.files?.[0];
  if (existing?.id) {
    return { id: existing.id, name: existing.name ?? name };
  }

  return createFolder(name, parentId);
}

async function getStatusParentFolder(status: ClientStatus | string) {
  const rootFolderId = getGoogleDriveRootFolderId();
  const key = statusToFolderKey(status);
  const folderName = STATUS_FOLDER_NAMES[key] ?? STATUS_FOLDER_NAMES.contratacao;
  return findOrCreateFolder(folderName, rootFolderId);
}

async function getAllStatusFolderIds(): Promise<Set<string>> {
  const rootFolderId = getGoogleDriveRootFolderId();
  const folders = await Promise.all(
    Object.values(STATUS_FOLDER_NAMES).map((name) => findOrCreateFolder(name, rootFolderId))
  );
  return new Set(folders.map((f) => f.id));
}

function buildClientFolderName(client: Client) {
  return sanitizeFolderName(client.legalName || client.name);
}

function buildProcessFolderName(process: LegalProcess) {
  const number = process.number || "processo";
  const action = process.actionType ? `_${sanitizeFolderName(process.actionType)}` : "";
  return `${sanitizeFolderName(number)}${action}`;
}

async function createDefaultClientStructure(clientFolderId: string) {
  for (const name of CLIENT_SUBFOLDER_NAMES) {
    await findOrCreateFolder(name, clientFolderId);
  }
}

async function findClienteOwningFolder(folderId: string): Promise<string | null> {
  const { data } = await getSupabaseServiceClient()
    .from("clientes")
    .select("id")
    .eq("drive_folder_id", folderId)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function createDefaultProcessStructure(processFolderId: string) {
  for (const name of PROCESS_SUBFOLDER_NAMES) {
    await findOrCreateFolder(name, processFolderId);
  }
}

export async function criarPastaCliente(client: Client) {
  const parentFolder = await getStatusParentFolder(client.status);
  const folderName = buildClientFolderName(client);
  let folder = await findOrCreateFolder(folderName, parentFolder.id);

  // Nomes sanitizados podem colidir entre clientes diferentes (acentos, hífen
  // vs espaço, nomes muito curtos etc. viram o mesmo slug). Reaproveitar a
  // pasta encontrada sem checar o dono misturaria documentos e dados
  // pessoais extraídos pela IA de um cliente no cadastro de outro — nunca
  // reusa uma pasta que já pertence a outro cliente no banco.
  const ownerId = await findClienteOwningFolder(folder.id);
  if (ownerId && ownerId !== client.id) {
    // findOrCreateFolder (não createFolder) é essencial aqui: numa nova
    // tentativa após falha de rede, ou na race entre a criação automática do
    // cadastro e o botão manual de abrir o Drive (M3), esse branch roda de
    // novo — sem isso, cada retentativa criaria mais uma pasta duplicada em
    // vez de reaproveitar a que já foi desambiguada da vez anterior.
    folder = await findOrCreateFolder(`${folderName}_${client.id.slice(0, 8)}`, parentFolder.id);
  }

  const drivePath = `${parentFolder.name} › ${folder.name}`;

  await createDefaultClientStructure(folder.id);

  return { driveFolderId: folder.id, drivePath };
}

export async function criarPastaProcesso(client: Client, process: LegalProcess) {
  if (!client.driveFolderId) {
    throw new Error("Cliente ainda não possui pasta no Google Drive.");
  }

  const folderName = buildProcessFolderName(process);
  const folder = await findOrCreateFolder(folderName, client.driveFolderId);
  const drivePath = `${client.driveFolder || buildClientFolderName(client)} › ${folder.name}`;

  await createDefaultProcessStructure(folder.id);

  return { driveFolderId: folder.id, drivePath };
}

export async function moverPastaClientePorStatus(
  client: Client,
  novoStatus: ClientStatus | string
) {
  if (!client.driveFolderId) {
    throw new Error("Cliente ainda não possui pasta no Google Drive.");
  }

  const drive = getGoogleDriveClient();
  const [parentFolder, currentParents, statusFolderIds] = await Promise.all([
    getStatusParentFolder(novoStatus),
    getFolderParents(client.driveFolderId),
    getAllStatusFolderIds()
  ]);

  // Remove só os parents atuais que SÃO pasta de status (normalmente um só:
  // a do status anterior) — nunca todos os parents. Se a pasta do cliente
  // foi adicionada manualmente a um segundo lugar do Drive fora da
  // estrutura de status, ela permanece lá em vez de ser removida sem aviso.
  //
  // Não dá pra usar client.status pra achar a pasta anterior: por causa da
  // ordem das chamadas (atualizarCliente roda antes de mover a pasta),
  // client.status já chega aqui como o status NOVO, não o antigo.
  const removeParents = currentParents.filter((id) => statusFolderIds.has(id));

  await drive.files.update({
    fileId: client.driveFolderId,
    addParents: parentFolder.id,
    removeParents: removeParents.length > 0 ? removeParents.join(",") : undefined,
    fields: "id,parents",
    supportsAllDrives: true
  });

  return {
    driveFolderId: client.driveFolderId,
    drivePath: `${parentFolder.name} › ${buildClientFolderName(client)}`
  };
}
