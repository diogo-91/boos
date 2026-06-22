import { NextResponse } from "next/server";

export const runtime = "nodejs";
import {
  getGoogleDriveRootFolderId,
  getGoogleDriveRootFolderInfo,
  isGoogleDriveConfigured,
  validateGooglePrivateKey
} from "@/lib/google/drive";

function getFriendlyErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const code =
    typeof error === "object" && error && "code" in error
      ? Number((error as { code?: unknown }).code)
      : undefined;

  if (message.includes("GOOGLE_DRIVE_ROOT_FOLDER_ID")) {
    return "GOOGLE_DRIVE_ROOT_FOLDER_ID inválido.";
  }
  if (message.includes("GOOGLE_PRIVATE_KEY mal formatada")) {
    return "GOOGLE_PRIVATE_KEY mal formatada.";
  }
  if (code === 403 || message.includes("The user does not have sufficient permissions")) {
    return "A service account não tem acesso à pasta raiz do Drive.";
  }
  if (code === 404) {
    return "GOOGLE_DRIVE_ROOT_FOLDER_ID inválido.";
  }

  return "Não foi possível conectar ao Google Drive.";
}

export async function GET() {
  try {
    if (!isGoogleDriveConfigured()) {
      return NextResponse.json(
        {
          ok: false,
          message: "As variáveis do Google Drive não estão configuradas no ambiente."
        },
        { status: 503 }
      );
    }

    validateGooglePrivateKey();
    const rootFolderId = getGoogleDriveRootFolderId();
    const rootFolder = await getGoogleDriveRootFolderInfo();

    return NextResponse.json({
      ok: true,
      rootFolderId,
      rootFolderName: rootFolder.name,
      mimeType: rootFolder.mimeType
    });
  } catch (error) {
    console.error("[Drive] Health check falhou:", error);
    return NextResponse.json(
      { ok: false, message: getFriendlyErrorMessage(error) },
      { status: 500 }
    );
  }
}
