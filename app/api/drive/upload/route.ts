import { NextResponse } from "next/server";
import { getGoogleDriveClient, isGoogleDriveConfigured } from "@/lib/google/drive";
import { PassThrough } from "stream";
import path from "path";

function sanitizeFileName(name: string): string {
  // Pega só o nome base — remove qualquer path traversal (ex: ../../config.json)
  const base = path.basename(name);
  // Remove caracteres perigosos, mantém letras, números, espaço, ponto, hífen e underscore
  const safe = base.replace(/[^\w\s.\-]/g, "_").trim();
  // Garante que não ficou vazio após sanitização
  return safe || "arquivo";
}

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isGoogleDriveConfigured()) {
    return NextResponse.json(
      { message: "Google Drive ainda não configurado no ambiente." },
      { status: 503 }
    );
  }

  let file: File | null;
  let parentId: string | null;

  try {
    const formData = await request.formData();
    file = formData.get("file") as File | null;
    parentId = formData.get("parentId") as string | null;
  } catch {
    return NextResponse.json({ message: "Corpo da requisição inválido." }, { status: 400 });
  }

  if (!file || !parentId) {
    return NextResponse.json(
      { message: "Parâmetros file e parentId são obrigatórios." },
      { status: 400 }
    );
  }

  const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif"];
  const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { message: `Tipo de arquivo não permitido: ${file.type}. Envie PDF ou imagem (JPG, PNG, WEBP).` },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { message: "Arquivo muito grande. O limite é 20MB." },
      { status: 400 }
    );
  }

  const safeName = sanitizeFileName(file.name);

  try {
    const drive = getGoogleDriveClient();
    const buffer = Buffer.from(await file.arrayBuffer());

    const stream = new PassThrough();
    stream.end(buffer);

    const { data } = await drive.files.create({
      requestBody: {
        name: safeName,
        parents: [parentId]
      },
      media: {
        mimeType: file.type || "application/octet-stream",
        body: stream
      },
      fields: "id,name,mimeType,size,modifiedTime,webViewLink"
    });

    return NextResponse.json({ file: data });
  } catch (error) {
    console.error("[Drive] Falha ao fazer upload:", error);
    return NextResponse.json(
      { message: "Não foi possível fazer o upload do arquivo." },
      { status: 500 }
    );
  }
}
