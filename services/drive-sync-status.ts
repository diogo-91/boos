import { getSupabaseClient } from "@/lib/supabase/client";

export async function getLastDriveSyncAt(): Promise<string | null> {
  const { data, error } = await getSupabaseClient()
    .from("drive_sync_tokens")
    .select("updated_at")
    .eq("id", "singleton")
    .maybeSingle();

  if (error) throw error;
  return data?.updated_at ?? null;
}
