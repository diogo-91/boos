import { NextResponse } from "next/server";
import { runSheetSync } from "@/services/sheets-sync";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const secret = request.headers.get("x-sync-secret");
  if (secret !== process.env.DRIVE_SYNC_SECRET) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const result = await runSheetSync();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[SheetsSync] Erro:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
