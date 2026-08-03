import { NextResponse } from "next/server";
import { getGoogleDriveClient, isGoogleDriveConfigured } from "@/lib/google/drive";
import { getSupabaseClient } from "@/lib/supabase/client";

export const runtime = "nodejs";

// Confere se o arquivo está dentro da pasta de um cliente ou processo
// gerenciado pelo app (direto na pasta, ou numa subpasta dela, ex:
// documentos_pessoais/comunicacao/inicial/peticoes_subsequentes) — sem isso
// qualquer usuário autenticado podia apagar qualquer fileId que a service
// account alcance, mandando o id direto na URL.
async function isManagedFile(fileId: string): Promise<boolean> {
  const drive = getGoogleDriveClient();
  const { data } = await drive.files.get({ fileId, fields: "parents" });
  const parentId = data.parents?.[0];
  if (!parentId) return false;

  const { data: parentData } = await drive.files.get({ fileId: parentId, fields: "parents" });
  const grandParentId = parentData.parents?.[0];

  const candidateIds = [parentId, grandParentId].filter((v): v is string => Boolean(v));
  if (candidateIds.length === 0) return false;

  const supabase = getSupabaseClient();
  const [{ data: clientes }, { data: processos }] = await Promise.all([
    supabase.from("clientes").select("id").in("drive_folder_id", candidateIds).limit(1),
    supabase.from("processos").select("id").in("drive_folder_id", candidateIds).limit(1)
  ]);

  return Boolean(clientes?.length || processos?.length);
}

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
    const managed = await isManagedFile(id);
    if (!managed) {
      return NextResponse.json(
        { message: "Arquivo não pertence a um cliente ou processo gerenciado pelo sistema." },
        { status: 403 }
      );
    }

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
