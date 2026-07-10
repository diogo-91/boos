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

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        const result = await readDriveFile(fileId, fileName, parentFolderId, (step, status, message) => {
          send({ type: "progress", step, status, message });
        });
        send({ type: "result", ok: true, ...result });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[ReadFile] Erro:", err);
        send({ type: "result", ok: false, error: message });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    }
  });
}
