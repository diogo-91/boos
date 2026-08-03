import { NextResponse } from "next/server";
import { runDriveSync } from "@/services/drive-sync-engine";
import { acquireScanLock, releaseScanLock } from "@/services/drive-scan-lock";
import { isValidSyncSecret } from "@/lib/sync-auth";

export const runtime = "nodejs";
// Sem isso, o sync incremental não tinha corte de tempo (diferente do
// scan-full), e um lock preso por mais de 10 minutos era plausível.
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!isValidSyncSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lockToken = await acquireScanLock();
  if (!lockToken) {
    return NextResponse.json(
      { ok: false, error: "Já existe uma varredura em andamento no Google Drive." },
      { status: 409 }
    );
  }

  try {
    const result = await runDriveSync();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[DriveSync] Erro crítico:", err);
    return NextResponse.json({ ok: false, error: "Falha no sync incremental do Drive." }, { status: 500 });
  } finally {
    await releaseScanLock(lockToken);
  }
}

export async function GET() {
  return NextResponse.json({ message: "Use POST para acionar o sync." }, { status: 405 });
}
