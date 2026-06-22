import { NextResponse } from "next/server";

export const runtime = "nodejs";
import { readDriveFile } from "@/services/ai-document-reader";

export async function POST(request: Request) {
  const secret = request.headers.get("x-sync-secret");
  if (secret !== process.env.DRIVE_SYNC_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as { fileId?: string; fileName?: string; parentFolderId?: string };
  const { fileId, fileName, parentFolderId } = body;

  if (!fileId || !fileName || !parentFolderId) {
    return NextResponse.json(
      { error: "fileId, fileName e parentFolderId são obrigatórios" },
      { status: 400 }
    );
  }

  try {
    const result = await readDriveFile(fileId, fileName, parentFolderId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[AIRead] Erro:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
