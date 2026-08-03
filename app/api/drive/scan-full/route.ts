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

  try {
    const result = await runFullScan();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[FullScan] Erro:", err);
    return NextResponse.json({ ok: false, error: "Falha na varredura completa do Drive." }, { status: 500 });
  } finally {
    await releaseScanLock(lockToken);
  }
}
