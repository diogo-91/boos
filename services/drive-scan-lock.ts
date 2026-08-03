import { getSupabaseClient } from "@/lib/supabase/client";

const LOCK_ID = "singleton";
const STALE_AFTER_MS = 10 * 60 * 1000;

// acquireScanLock devolve um token (o próprio locked_at gravado) que a
// chamada de release precisa apresentar de volta. Sem isso, um processo
// cujo lock ficou stale (>10min) e foi "roubado" por um segundo processo
// ainda derrubava o lock do segundo quando o primeiro finalmente terminava
// no finally — abrindo espaço pra um terceiro entrar e rodar em cima dos
// mesmos registros.
export async function acquireScanLock(): Promise<string | null> {
  const staleBefore = new Date(Date.now() - STALE_AFTER_MS).toISOString();
  const token = new Date().toISOString();

  const { data, error } = await getSupabaseClient()
    .from("drive_scan_lock")
    .update({ locked: true, locked_at: token })
    .eq("id", LOCK_ID)
    .or(`locked.eq.false,locked_at.lt.${staleBefore}`)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  return data ? token : null;
}

export async function releaseScanLock(token: string): Promise<void> {
  // Só libera se o lock ainda pertence a quem pediu (locked_at bate com o
  // token recebido na aquisição) — se não bate, alguém já roubou o lock
  // depois que ele ficou stale, e não é papel deste processo derrubá-lo.
  await getSupabaseClient()
    .from("drive_scan_lock")
    .update({ locked: false })
    .eq("id", LOCK_ID)
    .eq("locked_at", token);
}
