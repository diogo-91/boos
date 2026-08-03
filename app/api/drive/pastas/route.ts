import { NextResponse } from "next/server";
import { getGoogleDriveClient, isGoogleDriveConfigured } from "@/lib/google/drive";
import { FOLDER_MIME } from "@/lib/drive-status-map";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isGoogleDriveConfigured()) {
    return NextResponse.json(
      { message: "Google Drive ainda não configurado no ambiente." },
      { status: 503 }
    );
  }

  let name: string | undefined;
  let parentId: string | undefined;

  try {
    const body = await request.json() as { name?: string; parentId?: string };
    ({ name, parentId } = body);
  } catch {
    return NextResponse.json({ message: "Corpo da requisição inválido." }, { status: 400 });
  }

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
        mimeType: FOLDER_MIME,
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
