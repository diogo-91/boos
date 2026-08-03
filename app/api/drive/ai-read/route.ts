import { NextResponse } from "next/server";
import { readDriveFile } from "@/services/ai-document-reader";
import { isValidSyncSecret } from "@/lib/sync-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isValidSyncSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json() as { fileId?: string; fileName?: string; parentFolderId?: string };
    const { fileId, fileName, parentFolderId } = body;

    if (!fileId || !fileName || !parentFolderId) {
      return NextResponse.json(
        { error: "fileId, fileName e parentFolderId são obrigatórios" },
        { status: 400 }
      );
    }

    const result = await readDriveFile(fileId, fileName, parentFolderId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[AIRead] Erro:", err);
    return NextResponse.json({ ok: false, error: "Não foi possível processar o arquivo." }, { status: 500 });
  }
}
