import type { Parceiro } from "@/lib/types";
import { getSupabaseClient } from "@/lib/supabase/client";

export type { Parceiro };

export async function listarParceiros() {
  const { data, error } = await getSupabaseClient()
    .from("parceiros")
    .select("*")
    .order("nome", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Parceiro[];
}
