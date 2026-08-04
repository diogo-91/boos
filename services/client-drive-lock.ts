import { getSupabaseClient } from "@/lib/supabase/client";

// Mesmo padrão do drive-scan-lock.ts (token de posse + recuperação de lock
// stale), só que por cliente em vez de singleton — fecha o M3 de verdade
// (findOrCreateFolder sem lock permitia duas requisições concorrentes
// criarem pasta duplicada pro mesmo cliente) em vez de só reduzir a janela.
const STALE_AFTER_MS = 2 * 60 * 1000;
const TABLE_MISSING = "42P01";

export async function acquireClientFolderLock(clienteId: string): Promise<string | null> {
  const token = new Date().toISOString();
  const supabase = getSupabaseClient();

  const { error: insertError } = await supabase
    .from("client_drive_folder_lock")
    .insert({ cliente_id: clienteId, locked_at: token });

  if (!insertError) return token;

  if (insertError.code === TABLE_MISSING) {
    // Migration ainda não rodada — não bloqueia a criação de pasta por
    // causa disso (só não há lock real pra disputar até ela existir).
    console.error(
      "[client-drive-lock] Tabela client_drive_folder_lock não existe — rode a migration. Prosseguindo sem lock."
    );
    return token;
  }

  // Já existe lock pra esse cliente — só consegue se tiver ficado stale.
  const staleBefore = new Date(Date.now() - STALE_AFTER_MS).toISOString();
  const { data, error } = await supabase
    .from("client_drive_folder_lock")
    .update({ locked_at: token })
    .eq("cliente_id", clienteId)
    .lt("locked_at", staleBefore)
    .select("cliente_id")
    .maybeSingle();

  if (error) throw error;
  return data ? token : null;
}

export async function releaseClientFolderLock(clienteId: string, token: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("client_drive_folder_lock")
    .delete()
    .eq("cliente_id", clienteId)
    .eq("locked_at", token);

  if (error && error.code !== TABLE_MISSING) {
    console.error("[client-drive-lock] Falha ao liberar lock:", error);
  }
}
