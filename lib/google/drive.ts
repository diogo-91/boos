import { google } from "googleapis";

const DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive"];

export function isGoogleDriveConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY &&
      process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
  );
}

function getPrivateKey() {
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!rawKey) return undefined;
  return rawKey.replace(/\\n/g, "\n");
}

export function validateGooglePrivateKey() {
  const privateKey = getPrivateKey();

  if (
    !privateKey ||
    !privateKey.includes("BEGIN PRIVATE KEY") ||
    !privateKey.includes("END PRIVATE KEY")
  ) {
    throw new Error("GOOGLE_PRIVATE_KEY mal formatada.");
  }

  return privateKey;
}

export function getGoogleDriveRootFolderId() {
  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!rootFolderId) {
    throw new Error("GOOGLE_DRIVE_ROOT_FOLDER_ID não configurado.");
  }
  return rootFolderId;
}

export function getGoogleDriveClient() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = validateGooglePrivateKey();

  if (!clientEmail) {
    throw new Error("Credenciais do Google Drive não configuradas.");
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: DRIVE_SCOPES
  });

  return google.drive({ version: "v3", auth });
}

export async function getGoogleDriveRootFolderInfo() {
  const drive = getGoogleDriveClient();
  const rootFolderId = getGoogleDriveRootFolderId();

  const { data } = await drive.files.get({
    fileId: rootFolderId,
    fields: "id,name,mimeType",
    supportsAllDrives: true
  });

  return {
    id: data.id ?? rootFolderId,
    name: data.name ?? "Pasta raiz",
    mimeType: data.mimeType ?? "application/vnd.google-apps.folder"
  };
}

// A pasta raiz configurada pode ser a própria Shared Drive ou uma subpasta
// dentro dela — em ambos os casos o driveId (necessário pra changes.list e
// changes.getStartPageToken) é obtido consultando o campo `driveId` da pasta,
// em vez de assumir que GOOGLE_DRIVE_ROOT_FOLDER_ID já é o driveId.
let cachedSharedDriveId: string | null | undefined;

export async function getGoogleSharedDriveId(): Promise<string | null> {
  if (cachedSharedDriveId !== undefined) return cachedSharedDriveId;

  const drive = getGoogleDriveClient();
  const rootFolderId = getGoogleDriveRootFolderId();

  const { data } = await drive.files.get({
    fileId: rootFolderId,
    fields: "driveId",
    supportsAllDrives: true
  });

  cachedSharedDriveId = data.driveId ?? null;
  return cachedSharedDriveId;
}
