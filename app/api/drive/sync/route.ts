import { NextResponse } from "next/server";
import { runDriveSync } from "@/services/drive-sync-engine";
import { acquireScanLock, releaseScanLock } from "@/services/drive-scan-lock";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = request.headers.get("x-sync-secret");
  if (secret !== process.env.DRIVE_SYNC_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const acquired = await acquireScanLock();
  if (!acquired) {
    return NextResponse.json(
      { ok: false, error: "Já existe uma varredura em andamento no Google Drive." },
      { status: 409 }
    );
  }

  try {
    const result = await runDriveSync();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[DriveSync] Erro crítico:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  } finally {
    await releaseScanLock();
  }
}

export async function GET() {
  return NextResponse.json({ message: "Use POST para acionar o sync." }, { status: 405 });
}
