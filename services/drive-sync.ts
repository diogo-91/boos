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

export type DriveSyncResult<T> = { data: T; error: string | null };

// As três funções abaixo nunca lançam — a operação principal (cadastro do
// cliente/processo, mudança de status) já foi salva no banco antes de
// chegar aqui, e uma falha no Drive não deve desfazer isso. Mas o erro
// precisa chegar em quem chama, pra parar de mostrar toast de sucesso
// quando a pasta não foi criada/movida — um registro sem driveFolderId é
// justamente o candidato ao match ambíguo por nome do A3.

export async function syncClientDriveFolder(client: Client): Promise<DriveSyncResult<Client>> {
  try {
    const result = await callDriveApi<{ cliente: Client }>(
      "/api/drive/clientes",
      "POST",
      { cliente: client }
    );
    return { data: result.cliente, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao criar a pasta no Google Drive.";
    console.error("[Drive] Criação da pasta do cliente não concluída:", error);
    return { data: client, error: message };
  }
}

export async function syncProcessDriveFolder(
  client: Client | undefined,
  process: LegalProcess
): Promise<DriveSyncResult<LegalProcess>> {
  if (!client?.driveFolderId) return { data: process, error: null };

  try {
    const result = await callDriveApi<{ processo: LegalProcess }>(
      "/api/drive/processos",
      "POST",
      { cliente: client, processo: process }
    );
    return { data: result.processo, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao criar a pasta do processo no Google Drive.";
    console.error("[Drive] Criação da pasta do processo não concluída:", error);
    return { data: process, error: message };
  }
}

export async function syncClientStatusFolder(
  client: Client,
  novoStatus: ClientStatus
): Promise<DriveSyncResult<Client>> {
  if (!client.driveFolderId) return { data: client, error: null };

  try {
    const result = await callDriveApi<{ cliente: Client }>(
      "/api/drive/clientes/status",
      "PATCH",
      { cliente: client, novoStatus }
    );
    return { data: result.cliente, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao mover a pasta do cliente no Google Drive.";
    console.error("[Drive] Movimentação da pasta do cliente não concluída:", error);
    return { data: client, error: message };
  }
}
