import "server-only";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isSupabaseServiceConfigured = Boolean(supabaseUrl && serviceRoleKey);

const supabaseService = isSupabaseServiceConfigured
  ? createClient(supabaseUrl as string, serviceRoleKey as string, {
      auth: { persistSession: false }
    })
  : null;

// Cliente server-only com a service role key: usado pelas rotas/serviços do
// Drive que rodam inteiramente no servidor (automação por x-sync-secret ou
// gate de login do middleware), nunca a partir de componente client-side —
// a service role key ignora RLS por design e não pode nunca ir pro bundle
// do navegador. O import "server-only" no topo faz o build falhar caso
// algum arquivo client-side importe isso por engano.
export function getSupabaseServiceClient() {
  if (!supabaseService) {
    throw new Error(
      "Supabase (service role) não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return supabaseService;
}
