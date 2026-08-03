import { NextResponse } from "next/server";
import type { Client } from "@/lib/types";
import { isGoogleDriveConfigured } from "@/lib/google/drive";
import { atualizarDriveCliente, buscarClientePorId } from "@/services/clientes";
import { criarPastaCliente } from "@/services/google-drive";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (!isGoogleDriveConfigured()) {
      return NextResponse.json(
        { message: "Google Drive ainda não configurado no ambiente." },
        { status: 503 }
      );
    }

    const body = (await request.json()) as { cliente?: Client };
    const cliente = body.cliente;

    if (!cliente?.id || !cliente.legalName || !cliente.status) {
      return NextResponse.json(
        { message: "Dados mínimos do cliente não informados." },
        { status: 400 }
      );
    }

    // findOrCreateFolder não tem lock (M3) — a criação automática no cadastro
    // e o botão manual de "abrir Drive" podem disparar essa rota quase ao
    // mesmo tempo pro mesmo cliente. Reler o banco bem antes de criar reduz
    // bastante a janela: se outra requisição concorrente já terminou e
    // salvou a pasta, reaproveita em vez de criar uma segunda.
    const freshClient = await buscarClientePorId(cliente.id);
    if (freshClient?.driveFolderId) {
      return NextResponse.json({
        cliente: freshClient,
        driveFolder: {
          driveFolderId: freshClient.driveFolderId,
          drivePath: freshClient.driveFolder
        }
      });
    }

    const driveFolder = await criarPastaCliente(cliente);
    const updatedClient = await atualizarDriveCliente(
      cliente.id,
      driveFolder.driveFolderId,
      driveFolder.drivePath
    );

    return NextResponse.json({ cliente: updatedClient, driveFolder });
  } catch (error) {
    console.error("[Drive] Falha ao criar pasta do cliente:", error);
    return NextResponse.json(
      { message: "Não foi possível criar a pasta do cliente no Google Drive." },
      { status: 500 }
    );
  }
}
