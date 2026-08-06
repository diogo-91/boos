import { NextResponse } from "next/server";
import { runFullScan } from "@/services/drive-full-scan";
import { acquireScanLock, releaseScanLock } from "@/services/drive-scan-lock";
import { isValidSyncSecret } from "@/lib/sync-auth";

export const runtime = "nodejs";
// Varredura completa pode demorar — aumenta o timeout para 5 minutos
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!isValidSyncSecret(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const lockToken = await acquireScanLock();
  if (!lockToken) {
    return NextResponse.json(
      { ok: false, error: "Já existe uma varredura em andamento no Google Drive." },
      { status: 409 }
    );
  }

  // Corpo opcional — { "onlyProcuracao": true } pra cadastrar um lote
  // grande de clientes rápido, lendo só a procuração de cada pasta em vez
  // de todos os arquivos; { "onlyStatusFolder": "02_ativos" } (ou "Ativo")
  // pra restringir a varredura a uma única pasta de status. Sem corpo
  // (ou corpo inválido), roda normal.
  let onlyProcuracao = false;
  let onlyStatusFolder: string | undefined;
  try {
    const body = await request.json() as { onlyProcuracao?: boolean; onlyStatusFolder?: string };
    onlyProcuracao = Boolean(body?.onlyProcuracao);
    onlyStatusFolder = body?.onlyStatusFolder || undefined;
  } catch {
    // Sem corpo — varredura normal, comportamento de sempre.
  }

  try {
    const result = await runFullScan({ onlyProcuracao, onlyStatusFolder });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[FullScan] Erro:", err);
    return NextResponse.json({ ok: false, error: "Falha na varredura completa do Drive." }, { status: 500 });
  } finally {
    await releaseScanLock(lockToken);
  }
}
