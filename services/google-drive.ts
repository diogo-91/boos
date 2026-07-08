import type { Client, ClientStatus, LegalProcess } from "@/lib/types";
import {
  getGoogleDriveClient,
  getGoogleDriveRootFolderId
} from "@/lib/google/drive";

const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

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

function escapeQueryValue(value: string) {
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
  const { data } = await drive.files.get({ fileId: folderId, fields: "parents" });
  return data.parents ?? [];
}

async function createFolder(name: string, parentId: string) {
  const drive = getGoogleDriveClient();
  const { data } = await drive.files.create({
    requestBody: { name, mimeType: FOLDER_MIME_TYPE, parents: [parentId] },
    fields: "id,name"
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
      `mimeType = '${FOLDER_MIME_TYPE}'`,
      `'${safeParentId}' in parents`,
      "trashed = false"
    ].join(" and "),
    fields: "files(id,name)",
    spaces: "drive",
    pageSize: 1
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

function buildClientFolderName(client: Client) {
  return sanitizeFolderName(client.legalName || client.name);
}

function buildProcessFolderName(process: LegalProcess) {
  const number = process.number || "processo";
  const action = process.actionType ? `_${sanitizeFolderName(process.actionType)}` : "";
  return `${sanitizeFolderName(number)}${action}`;
}

async function createDefaultClientStructure(clientFolderId: string) {
  await findOrCreateFolder("documentos_pessoais", clientFolderId);
  await findOrCreateFolder("comunicacao", clientFolderId);
}

async function createDefaultProcessStructure(processFolderId: string) {
  await findOrCreateFolder("inicial", processFolderId);
  await findOrCreateFolder("peticoes_subsequentes", processFolderId);
}

export async function criarPastaCliente(client: Client) {
  const parentFolder = await getStatusParentFolder(client.status);
  const folderName = buildClientFolderName(client);
  const folder = await findOrCreateFolder(folderName, parentFolder.id);
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
  const parentFolder = await getStatusParentFolder(novoStatus);
  const previousParents = await getFolderParents(client.driveFolderId);

  await drive.files.update({
    fileId: client.driveFolderId,
    addParents: parentFolder.id,
    removeParents: previousParents.join(",") || undefined,
    fields: "id,parents"
  });

  return {
    driveFolderId: client.driveFolderId,
    drivePath: `${parentFolder.name} › ${buildClientFolderName(client)}`
  };
}
