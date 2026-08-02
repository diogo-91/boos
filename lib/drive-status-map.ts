import type { ClientStatus } from "@/lib/types";

export const FOLDER_MIME = "application/vnd.google-apps.folder";

export const STATUS_FOLDER_MAP: Record<string, ClientStatus> = {
  "01_arquivados": "Arquivado",
  "02_ativos": "Ativo",
  "03_cancelados": "Cancelado",
  "04_contratacao": "Contratação",
  "05_dativos": "Dativo",
  "06_parceiros": "Parceiros",
  "07_sarandi": "Sarandi"
};

export const STATUS_DB_MAP: Record<ClientStatus, string> = {
  Ativo: "ativo",
  // "Audiência" não tem pasta própria — segue no slug de ativo.
  Audiência: "ativo",
  Arquivado: "arquivado",
  Cancelado: "cancelado",
  Contratação: "contratacao",
  Dativo: "dativo",
  Parceiros: "parceiros",
  Sarandi: "sarandi"
};

export const STATUS_FOLDER_TO_DB_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(STATUS_FOLDER_MAP).map(([folder, status]) => [folder, STATUS_DB_MAP[status]])
);

function normalizeFolderKey(value: string) {
  return value.toLowerCase().replace(/\s+/g, "");
}

// Casa o nome de uma pasta do Drive com a chave correspondente em
// STATUS_FOLDER_MAP, ignorando maiúsculas/minúsculas e espaços.
export function matchStatusFolderKey(folderName: string): string | undefined {
  const normalized = normalizeFolderKey(folderName);
  return Object.keys(STATUS_FOLDER_MAP).find((key) => normalizeFolderKey(key) === normalized);
}

export function folderNameToDisplayName(folderName: string): string {
  return folderName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

export function parseProcessFolderName(folderName: string): { number: string; actionType: string } {
  const match = folderName.match(/^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/);
  if (match) {
    const number = match[0];
    const rest = folderName.slice(number.length).replace(/^_/, "");
    return { number, actionType: folderNameToDisplayName(rest) };
  }
  return { number: folderName, actionType: "" };
}
