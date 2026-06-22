import type { Client, ClientStatus, LegalProcess } from "@/lib/types";

async function callDriveApi<T>(
  path: string,
  method: "POST" | "PATCH",
  body: unknown
): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const payload = (await response.json().catch(() => ({}))) as {
    message?: string;
  } & T;

  if (!response.ok) {
    throw new Error(payload.message ?? "Falha na integração com Google Drive.");
  }

  return payload;
}

export async function syncClientDriveFolder(client: Client): Promise<Client> {
  try {
    const result = await callDriveApi<{ cliente: Client }>(
      "/api/drive/clientes",
      "POST",
      { cliente: client }
    );
    return result.cliente;
  } catch (error) {
    console.error("[Drive] Criação da pasta do cliente não concluída:", error);
    return client;
  }
}

export async function syncProcessDriveFolder(
  client: Client | undefined,
  process: LegalProcess
): Promise<LegalProcess> {
  if (!client?.driveFolderId) return process;

  try {
    const result = await callDriveApi<{ processo: LegalProcess }>(
      "/api/drive/processos",
      "POST",
      { cliente: client, processo: process }
    );
    return result.processo;
  } catch (error) {
    console.error("[Drive] Criação da pasta do processo não concluída:", error);
    return process;
  }
}

export async function syncClientStatusFolder(
  client: Client,
  novoStatus: ClientStatus
): Promise<Client> {
  if (!client.driveFolderId) return client;

  try {
    const result = await callDriveApi<{ cliente: Client }>(
      "/api/drive/clientes/status",
      "PATCH",
      { cliente: client, novoStatus }
    );
    return result.cliente;
  } catch (error) {
    console.error("[Drive] Movimentação da pasta do cliente não concluída:", error);
    return client;
  }
}
