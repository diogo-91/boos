import { NextResponse } from "next/server";

export const runtime = "nodejs";
import type { Client, LegalProcess } from "@/lib/types";
import { isGoogleDriveConfigured } from "@/lib/google/drive";
import { criarPastaProcesso } from "@/services/google-drive";
import { atualizarDriveProcesso } from "@/services/processos";

export async function POST(request: Request) {
  try {
    if (!isGoogleDriveConfigured()) {
      return NextResponse.json(
        { message: "Google Drive ainda não configurado no ambiente." },
        { status: 503 }
      );
    }

    const body = (await request.json()) as {
      cliente?: Client;
      processo?: LegalProcess;
    };
    const { cliente, processo } = body;

    if (!cliente?.id || !cliente.driveFolderId || !processo?.id || !processo.number) {
      return NextResponse.json(
        { message: "Dados mínimos do cliente/processo não informados." },
        { status: 400 }
      );
    }

    const driveFolder = await criarPastaProcesso(cliente, processo);
    const updatedProcess = await atualizarDriveProcesso(
      processo.id,
      driveFolder.driveFolderId,
      driveFolder.drivePath
    );

    return NextResponse.json({ processo: updatedProcess, driveFolder });
  } catch (error) {
    console.error("[Drive] Falha ao criar pasta do processo:", error);
    return NextResponse.json(
      { message: "Não foi possível criar a pasta do processo no Google Drive." },
      { status: 500 }
    );
  }
}
