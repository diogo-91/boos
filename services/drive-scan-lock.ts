import { getSupabaseClient } from "@/lib/supabase/client";

const LOCK_ID = "singleton";
const STALE_AFTER_MS = 10 * 60 * 1000;

export async function acquireScanLock(): Promise<boolean> {
  const staleBefore = new Date(Date.now() - STALE_AFTER_MS).toISOString();

  const { data, error } = await getSupabaseClient()
    .from("drive_scan_lock")
    .update({ locked: true, locked_at: new Date().toISOString() })
    .eq("id", LOCK_ID)
    .or(`locked.eq.false,locked_at.lt.${staleBefore}`)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

export async function releaseScanLock(): Promise<void> {
  await getSupabaseClient()
    .from("drive_scan_lock")
    .update({ locked: false })
    .eq("id", LOCK_ID);
}
