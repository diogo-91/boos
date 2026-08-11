import { NextResponse } from "next/server";
import { runSheetSync } from "@/services/sheets-sync";
import { isValidSyncSecret } from "@/lib/sync-auth";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  if (!isValidSyncSecret(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  // Corpo opcional — { "spreadsheetId": "...", "gid": "..." } pra rodar o
  // sync contra uma planilha/aba diferente da padrão (GOOGLE_SHEETS_ID).
  // Sem corpo (ou corpo inválido), roda a planilha padrão de sempre.
  let spreadsheetId: string | undefined;
  let gid: string | undefined;
  try {
    const body = await request.json() as { spreadsheetId?: string; gid?: string };
    spreadsheetId = body?.spreadsheetId || undefined;
    gid = body?.gid || undefined;
  } catch {
    // Sem corpo — sync padrão, comportamento de sempre.
  }

  try {
    const result = await runSheetSync(spreadsheetId, gid);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[SheetsSync] Erro:", err);
    return NextResponse.json({ ok: false, error: "Falha no sync da planilha." }, { status: 500 });
  }
}
