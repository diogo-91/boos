import { NextResponse } from "next/server";
import { getGoogleDriveClient, isGoogleDriveConfigured } from "@/lib/google/drive";
import { escapeQueryValue } from "@/services/google-drive";
import { FOLDER_MIME, isReservedClientSubfolder } from "@/lib/drive-status-map";

export const runtime = "nodejs";

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  size?: string;
  modifiedTime?: string;
  // Nome da subpasta de origem, presente só quando a listagem usou
  // include=subpastas e o arquivo veio de um nível abaixo do folderId pedido.
  subpasta?: string;
};

async function listChildren(
  drive: ReturnType<typeof getGoogleDriveClient>,
  folderId: string
): Promise<DriveFile[]> {
  const items: DriveFile[] = [];
  let pageToken: string | undefined;

  // Sem paginação, uma pasta com mais de 100 arquivos ficava com o resto
  // fora da listagem em silêncio — mesmo padrão de services/drive-full-scan.ts.
  do {
    const { data } = await drive.files.list({
      q: `'${escapeQueryValue(folderId)}' in parents and trashed = false`,
      fields: "nextPageToken,files(id,name,mimeType,webViewLink,size,modifiedTime)",
      orderBy: "name",
      pageSize: 100,
      pageToken,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true
    });

    for (const file of data.files ?? []) {
      if (!file.id || !file.name) continue;
      items.push({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType ?? "",
        webViewLink: file.webViewLink ?? "",
        size: file.size ?? undefined,
        modifiedTime: file.modifiedTime ?? undefined
      });
    }

    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken);

  return items;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const folderId = searchParams.get("folderId");
  const includeSubpastas = searchParams.get("include") === "subpastas";

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
    const topLevel = await listChildren(drive, folderId);

    if (!includeSubpastas) {
      return NextResponse.json({ files: topLevel });
    }

    // Só expande subpastas reservadas (documentos_pessoais/comunicacao/outros
    // no cliente, inicial/peticoes_subsequentes no processo) — pastas de
    // processo dentro da pasta do cliente ficam de fora, senão a ficha do
    // cliente misturaria arquivos de todos os processos na listagem.
    const remaining: DriveFile[] = [];
    const expanded: DriveFile[] = [];
    for (const item of topLevel) {
      if (item.mimeType === FOLDER_MIME && isReservedClientSubfolder(item.name)) {
        const children = await listChildren(drive, item.id);
        expanded.push(...children.map((child) => ({ ...child, subpasta: item.name })));
      } else {
        remaining.push(item);
      }
    }

    return NextResponse.json({ files: [...remaining, ...expanded] });
  } catch (error) {
    console.error("[Drive] Falha ao listar arquivos:", error);
    return NextResponse.json(
      { message: "Não foi possível listar os arquivos da pasta." },
      { status: 500 }
    );
  }
}
