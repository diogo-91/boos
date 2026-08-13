import { NextResponse } from "next/server";
import { getGoogleDriveClient, isGoogleDriveConfigured } from "@/lib/google/drive";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

// Confere se o arquivo está dentro da pasta de um cliente ou processo
// gerenciado pelo app (direto na pasta, ou numa subpasta dela, ex:
// documentos_pessoais/comunicacao/inicial/peticoes_subsequentes) — sem isso
// qualquer usuário autenticado podia apagar qualquer fileId que a service
// account alcance, mandando o id direto na URL.
// Teto de níveis a subir a partir do parent direto — acompanha a
// profundidade máxima da estrutura hoje (cliente/processo/subpasta/subpasta).
const MAX_ANCESTOR_LEVELS = 4;

// Tipagem explícita de retorno evita um erro de inferência circular do
// TypeScript (overloads de drive.files.get + variável de loop reatribuída
// no mesmo escopo do call site — "implicitly has type any because it does
// not have a type annotation and is referenced directly or indirectly in
// its own initializer").
async function getParentId(fileId: string): Promise<string | undefined> {
  const { data } = await getGoogleDriveClient().files.get({
    fileId,
    fields: "parents",
    supportsAllDrives: true
  });
  return data.parents?.[0];
}

// Confere se o próprio id é uma pasta gerenciada (drive_folder_id de
// cliente ou processo) — sem isso, DELETE numa pasta de processo/cliente
// apagava a subárvore inteira no Drive e deixava o registro no banco órfão
// (drive_folder_id apontando pra um fileId que não existe mais).
async function isRegisteredFolder(folderId: string): Promise<boolean> {
  const supabase = getSupabaseServiceClient();
  const [{ data: clientes }, { data: processos }] = await Promise.all([
    supabase.from("clientes").select("id").eq("drive_folder_id", folderId).limit(1),
    supabase.from("processos").select("id").eq("drive_folder_id", folderId).limit(1)
  ]);
  return Boolean(clientes?.length || processos?.length);
}

async function isManagedFile(fileId: string): Promise<boolean> {
  let currentId = await getParentId(fileId);
  if (!currentId) return false;

  const supabase = getSupabaseServiceClient();

  for (let level = 0; level < MAX_ANCESTOR_LEVELS && currentId; level++) {
    const [{ data: clientes }, { data: processos }] = await Promise.all([
      supabase.from("clientes").select("id").eq("drive_folder_id", currentId).limit(1),
      supabase.from("processos").select("id").eq("drive_folder_id", currentId).limit(1)
    ]);
    if (clientes?.length || processos?.length) return true;

    currentId = await getParentId(currentId);
  }

  return false;
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
    if (await isRegisteredFolder(id)) {
      return NextResponse.json(
        { message: "Esta pasta é gerenciada pelo sistema (cliente ou processo) e não pode ser excluída por aqui." },
        { status: 403 }
      );
    }

    const managed = await isManagedFile(id);
    if (!managed) {
      return NextResponse.json(
        { message: "Arquivo não pertence a um cliente ou processo gerenciado pelo sistema." },
        { status: 403 }
      );
    }

    const drive = getGoogleDriveClient();
    await drive.files.delete({ fileId: id, supportsAllDrives: true });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Drive] Falha ao deletar arquivo:", error);
    return NextResponse.json(
      { message: "Não foi possível deletar o arquivo." },
      { status: 500 }
    );
  }
}
