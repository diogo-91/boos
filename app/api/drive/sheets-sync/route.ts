import { NextResponse } from "next/server";
import { runSheetSync } from "@/services/sheets-sync";
import { isValidSyncSecret } from "@/lib/sync-auth";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  if (!isValidSyncSecret(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const result = await runSheetSync();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[SheetsSync] Erro:", err);
    return NextResponse.json({ ok: false, error: "Falha no sync da planilha." }, { status: 500 });
  }
}
