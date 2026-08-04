import { NextResponse } from "next/server";
import { getGoogleDriveClient, isGoogleDriveConfigured } from "@/lib/google/drive";
import { PassThrough } from "stream";
import path from "path";

function sanitizeFileName(name: string): string {
  // Pega só o nome base — remove qualquer path traversal (ex: ../../config.json)
  const base = path.basename(name);
  // Antes era uma lista branca baseada em \w (ASCII-only) — "ç", "ã", "á"
  // etc. viravam "_", quebrando o nome exibido E a detecção de tipo de
  // documento por palavra-chave (ex: "Procuração.pdf" virava "Procura__o.pdf"
  // e nunca mais batia com "procuração" em services/ai-document-reader.ts).
  // \p{L}/\p{N} (Unicode) resolveria, mas exige regex flag "u", que o
  // target es5 do tsconfig não aceita. Em vez disso, bloqueia só os
  // caracteres realmente inválidos em nome de arquivo (Windows + path
  // traversal) e deixa passar acentos e demais pontuação.
  const safe = base.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").trim();
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

  // .doc/.docx liberados porque services/ai-document-reader.ts já sabe ler
  // os dois (mammoth para .docx, word-extractor para .doc) — não fazia
  // sentido bloquear no upload um tipo que o robô processa normalmente
  // depois, e boa parte das petições/peças chega nesse formato.
  const ALLOWED_TYPES = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword"
  ];
  const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { message: `Tipo de arquivo não permitido: ${file.type}. Envie PDF, imagem (JPG, PNG, WEBP) ou Word (.doc/.docx).` },
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
      fields: "id,name,mimeType,size,modifiedTime,webViewLink",
      supportsAllDrives: true
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
