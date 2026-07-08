import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase/client";
import { criarPastaProcesso } from "@/services/google-drive";
import type { Client, LegalProcess } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const secret = request.headers.get("x-sync-secret");
  if (secret !== process.env.DRIVE_SYNC_SECRET) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const supabase = getSupabaseClient();

  // Busca todos os processos sem pasta Drive que têm cliente com pasta Drive
  const { data: processos } = await supabase
    .from("processos")
    .select("id, numero_cnj, tipo_acao, cliente_id")
    .is("drive_folder_id", null);

  const { data: clientes } = await supabase
    .from("clientes")
    .select("id, nome, drive_folder_id, drive_path")
    .not("drive_folder_id", "is", null);

  const clienteMap = new Map(clientes?.map(c => [c.id, c]) ?? []);

  const result = { criadas: 0, puladas: 0, erros: [] as string[] };

  for (const proc of processos ?? []) {
    const cliente = clienteMap.get(proc.cliente_id);
    if (!cliente) { result.puladas++; continue; }

    try {
      const fakeClient = {
        id: cliente.id,
        driveFolderId: cliente.drive_folder_id,
        driveFolder: cliente.drive_path ?? "",
        legalName: cliente.nome,
        name: cliente.nome
      } as Client;

      const fakeProcess = {
        id: proc.id,
        number: proc.numero_cnj ?? "A definir",
        actionType: proc.tipo_acao ?? ""
      } as LegalProcess;

      const driveResult = await criarPastaProcesso(fakeClient, fakeProcess);

      await supabase.from("processos").update({
        drive_folder_id: driveResult.driveFolderId,
        drive_path: driveResult.drivePath
      }).eq("id", proc.id);

      result.criadas++;
    } catch (err) {
      result.erros.push(`${proc.numero_cnj}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({ ok: true, ...result });
}
