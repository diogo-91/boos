import { NextResponse } from "next/server";
import { getGoogleDriveClient, isGoogleDriveConfigured } from "@/lib/google/drive";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isGoogleDriveConfigured()) {
    return NextResponse.json(
      { message: "Google Drive ainda não configurado no ambiente." },
      { status: 503 }
    );
  }

  const body = await request.json() as { name?: string; parentId?: string };
  const { name, parentId } = body;

  if (!name || !parentId) {
    return NextResponse.json(
      { message: "Parâmetros name e parentId são obrigatórios." },
      { status: 400 }
    );
  }

  try {
    const drive = getGoogleDriveClient();
    const { data } = await drive.files.create({
      requestBody: {
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId]
      },
      fields: "id,name,mimeType,modifiedTime"
    });

    return NextResponse.json({ folder: data });
  } catch (error) {
    console.error("[Drive] Falha ao criar pasta:", error);
    return NextResponse.json(
      { message: "Não foi possível criar a pasta." },
      { status: 500 }
    );
  }
}
