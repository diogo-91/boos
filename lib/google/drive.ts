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
    fields: "id,name,mimeType"
  });

  return {
    id: data.id ?? rootFolderId,
    name: data.name ?? "Pasta raiz",
    mimeType: data.mimeType ?? "application/vnd.google-apps.folder"
  };
}
