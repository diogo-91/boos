import { NextResponse } from "next/server";

export const runtime = "nodejs";
import type { Client, ClientStatus } from "@/lib/types";
import { isGoogleDriveConfigured } from "@/lib/google/drive";
import { atualizarDriveCliente } from "@/services/clientes";
import { moverPastaClientePorStatus } from "@/services/google-drive";

export async function PATCH(request: Request) {
  try {
    if (!isGoogleDriveConfigured()) {
      return NextResponse.json(
        { message: "Google Drive ainda não configurado no ambiente." },
        { status: 503 }
      );
    }

    const body = (await request.json()) as {
      cliente?: Client;
      novoStatus?: ClientStatus;
    };
    const { cliente, novoStatus } = body;

    if (!cliente?.id || !cliente.driveFolderId || !novoStatus) {
      return NextResponse.json(
        { message: "Dados mínimos para mover a pasta do cliente não informados." },
        { status: 400 }
      );
    }

    const driveFolder = await moverPastaClientePorStatus(cliente, novoStatus);
    const updatedClient = await atualizarDriveCliente(
      cliente.id,
      driveFolder.driveFolderId,
      driveFolder.drivePath
    );

    return NextResponse.json({ cliente: updatedClient, driveFolder });
  } catch (error) {
    console.error("[Drive] Falha ao mover pasta do cliente:", error);
    return NextResponse.json(
      { message: "Não foi possível mover a pasta do cliente no Google Drive." },
      { status: 500 }
    );
  }
}
