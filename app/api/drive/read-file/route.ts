import { NextResponse } from "next/server";
import { readDriveFile, type ReadDriveFileRequestBody } from "@/services/ai-document-reader";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let fileId: string | undefined;
  let fileName: string | undefined;
  let parentFolderId: string | undefined;

  try {
    const body = await request.json() as ReadDriveFileRequestBody;
    ({ fileId, fileName, parentFolderId } = body);
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  if (!fileId || !fileName || !parentFolderId) {
    return NextResponse.json(
      { error: "fileId, fileName e parentFolderId são obrigatórios" },
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();

  // Se o cliente fecha a aba/modal no meio do processamento, o runtime
  // chama cancel() — mas readDriveFile continua rodando em background e
  // tentando mandar progresso pra uma conexão que já não existe mais. Sem
  // essa flag compartilhada entre start() e cancel(), cada enqueue/close
  // depois disso lançava "Invalid state: Controller is already closed",
  // virando um erro no log pra algo que nem é um erro de verdade.
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          closed = true;
        }
      };

      try {
        const result = await readDriveFile(fileId, fileName, parentFolderId, (step, status, message) => {
          send({ type: "progress", step, status, message });
        });
        send({ type: "result", ok: true, ...result });
      } catch (err) {
        console.error("[ReadFile] Erro:", err);
        send({ type: "result", ok: false, error: "Não foi possível processar o arquivo." });
      } finally {
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            // Já fechado pelo lado do cliente — nada a fazer.
          }
        }
      }
    },
    cancel() {
      // Cliente desconectou (fechou aba/modal) — marca fechado pra
      // qualquer send() ou controller.close() seguinte virar no-op.
      closed = true;
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
