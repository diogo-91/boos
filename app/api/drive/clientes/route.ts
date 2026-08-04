import { NextResponse } from "next/server";
import type { Client } from "@/lib/types";
import { isGoogleDriveConfigured } from "@/lib/google/drive";
import { atualizarDriveCliente, buscarClientePorId } from "@/services/clientes";
import { criarPastaCliente } from "@/services/google-drive";
import { acquireClientFolderLock, releaseClientFolderLock } from "@/services/client-drive-lock";

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

    // findOrCreateFolder não tem lock — a criação automática no cadastro e o
    // botão manual de "abrir Drive" podem disparar essa rota quase ao mesmo
    // tempo pro mesmo cliente. Checagem rápida antes do lock evita até
    // precisar dele no caso comum (pasta já existe).
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

    const lockToken = await acquireClientFolderLock(cliente.id);
    if (!lockToken) {
      return NextResponse.json(
        { message: "Já existe uma criação de pasta em andamento para este cliente — tente novamente em instantes." },
        { status: 409 }
      );
    }

    try {
      // Relê depois do lock — se outra requisição criou a pasta entre a
      // primeira leitura e a aquisição do lock, reaproveita em vez de criar.
      const clientAfterLock = await buscarClientePorId(cliente.id);
      if (clientAfterLock?.driveFolderId) {
        return NextResponse.json({
          cliente: clientAfterLock,
          driveFolder: {
            driveFolderId: clientAfterLock.driveFolderId,
            drivePath: clientAfterLock.driveFolder
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
    } finally {
      await releaseClientFolderLock(cliente.id, lockToken);
    }
  } catch (error) {
    console.error("[Drive] Falha ao criar pasta do cliente:", error);
    return NextResponse.json(
      { message: "Não foi possível criar a pasta do cliente no Google Drive." },
      { status: 500 }
    );
  }
}
