import { NextResponse } from "next/server";
import { getGoogleDriveClient, isGoogleDriveConfigured } from "@/lib/google/drive";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isGoogleDriveConfigured()) {
    return NextResponse.json(
      { message: "Google Drive ainda não configurado no ambiente." },
      { status: 503 }
    );
  }

  const { id } = await params;

  try {
    const drive = getGoogleDriveClient();
    await drive.files.delete({ fileId: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Drive] Falha ao deletar arquivo:", error);
    return NextResponse.json(
      { message: "Não foi possível deletar o arquivo." },
      { status: 500 }
    );
  }
}
