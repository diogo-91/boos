import { NextResponse } from "next/server";
import { runFullScan } from "@/services/drive-full-scan";

export const runtime = "nodejs";
// Varredura completa pode demorar — aumenta o timeout para 5 minutos
export const maxDuration = 300;

export async function POST(request: Request) {
  const secret = request.headers.get("x-sync-secret");
  if (secret !== process.env.DRIVE_SYNC_SECRET) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const result = await runFullScan();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[FullScan] Erro:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
