import { NextResponse } from "next/server";
import { getGoogleDriveClient, isGoogleDriveConfigured } from "@/lib/google/drive";

export const runtime = "nodejs";

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  size?: string;
  modifiedTime?: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const folderId = searchParams.get("folderId");

  if (!folderId) {
    return NextResponse.json(
      { message: "Parâmetro folderId é obrigatório." },
      { status: 400 }
    );
  }

  if (!isGoogleDriveConfigured()) {
    return NextResponse.json(
      { message: "Google Drive ainda não configurado no ambiente." },
      { status: 503 }
    );
  }

  try {
    const drive = getGoogleDriveClient();
    const { data } = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "files(id,name,mimeType,webViewLink,size,modifiedTime)",
      orderBy: "name",
      pageSize: 100
    });

    const files: DriveFile[] = (data.files ?? [])
      .filter((file) => file.id && file.name)
      .map((file) => ({
        id: file.id as string,
        name: file.name as string,
        mimeType: file.mimeType ?? "",
        webViewLink: file.webViewLink ?? "",
        size: file.size ?? undefined,
        modifiedTime: file.modifiedTime ?? undefined
      }));

    return NextResponse.json({ files });
  } catch (error) {
    console.error("[Drive] Falha ao listar arquivos:", error);
    return NextResponse.json(
      { message: "Não foi possível listar os arquivos da pasta." },
      { status: 500 }
    );
  }
}
