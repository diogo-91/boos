import type { Client } from "@/lib/types";
import { getSupabaseClient } from "@/lib/supabase/client";
import { mapClienteFromDb, mapClienteToDb } from "@/services/mappers";

const CLIENTES_SELECT = "*, parceiros(nome)";

export async function listarClientes() {
  const { data, error } = await getSupabaseClient()
    .from("clientes")
    .select(CLIENTES_SELECT)
    .order("nome", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapClienteFromDb);
}

export async function buscarClientePorId(id: string) {
  const { data, error } = await getSupabaseClient()
    .from("clientes")
    .select(CLIENTES_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? mapClienteFromDb(data) : undefined;
}

export async function criarCliente(client: Client, partnerId?: string | null) {
  const { data, error } = await getSupabaseClient()
    .from("clientes")
    .insert(mapClienteToDb(client, false, partnerId))
    .select(CLIENTES_SELECT)
    .single();

  if (error) throw error;
  return mapClienteFromDb(data);
}

export async function atualizarCliente(client: Client, partnerId?: string | null) {
  const { data, error } = await getSupabaseClient()
    .from("clientes")
    .update(mapClienteToDb(client, true, partnerId))
    .eq("id", client.id)
    .select(CLIENTES_SELECT)
    .single();

  if (error) throw error;
  return mapClienteFromDb(data);
}

export async function atualizarDriveCliente(
  clienteId: string,
  driveFolderId: string,
  drivePath: string
) {
  const { data, error } = await getSupabaseClient()
    .from("clientes")
    .update({ drive_folder_id: driveFolderId, drive_path: drivePath })
    .eq("id", clienteId)
    .select("*")
    .single();

  if (error) throw error;
  return mapClienteFromDb(data);
}
