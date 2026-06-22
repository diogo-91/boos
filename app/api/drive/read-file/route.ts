import { NextResponse } from "next/server";
import { readDriveFile } from "@/services/ai-document-reader";

export const runtime = "nodejs";

export async function POST(request: Request) {
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
    console.error("[ReadFile] Erro:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
