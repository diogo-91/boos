import type { Client } from "@/lib/types";
import { getSupabaseClient } from "@/lib/supabase/client";
import { mapClienteFromDb, mapClienteToDb } from "@/services/mappers";
import { isValidCpfCnpj, normalizeDocument } from "@/lib/validation";

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
  // O formulário só exigia o campo não-vazio, não um CPF/CNPJ válido — dava
  // pra criar cliente com "123" ou qualquer texto no documento. Valida aqui
  // também (não só no form) porque esse é o único caminho de criação manual
  // — clientes descobertos pelo Drive entram por outra rota, com cpf_cnpj
  // vazio de propósito até a IA ler algum documento.
  if (!isValidCpfCnpj(normalizeDocument(client.document))) {
    throw new Error("CPF/CNPJ inválido — confira o número informado.");
  }

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
