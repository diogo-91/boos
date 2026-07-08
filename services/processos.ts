import type { LegalProcess } from "@/lib/types";
import { getSupabaseClient } from "@/lib/supabase/client";
import { mapProcessoFromDb, mapProcessoToDb } from "@/services/mappers";

export async function listarProcessos() {
  const { data, error } = await getSupabaseClient()
    .from("processos")
    .select("*")
    .order("numero_cnj", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapProcessoFromDb);
}

export async function buscarProcessoPorId(id: string) {
  const { data, error } = await getSupabaseClient()
    .from("processos")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? mapProcessoFromDb(data) : undefined;
}

export async function criarProcesso(process: LegalProcess) {
  const { data, error } = await getSupabaseClient()
    .from("processos")
    .insert(mapProcessoToDb(process, false))
    .select("*")
    .single();

  if (error) throw error;
  return mapProcessoFromDb(data);
}

export async function atualizarProcesso(process: LegalProcess) {
  const { data, error } = await getSupabaseClient()
    .from("processos")
    .update(mapProcessoToDb(process))
    .eq("id", process.id)
    .select("*")
    .single();

  if (error) throw error;
  return mapProcessoFromDb(data);
}

export async function atualizarDriveProcesso(
  processoId: string,
  driveFolderId: string,
  drivePath: string
) {
  const { data, error } = await getSupabaseClient()
    .from("processos")
    .update({ drive_folder_id: driveFolderId, drive_path: drivePath })
    .eq("id", processoId)
    .select("*")
    .single();

  if (error) throw error;
  return mapProcessoFromDb(data);
}
