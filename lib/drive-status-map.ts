import type { ClientStatus } from "@/lib/types";

export const FOLDER_MIME = "application/vnd.google-apps.folder";

export const STATUS_FOLDER_MAP: Record<string, ClientStatus> = {
  "01_arquivados": "Arquivado",
  "02_ativos": "Ativo",
  "03_cancelados": "Cancelado",
  "04_contratacao": "Contratação",
  "05_dativos": "Dativo",
  "06_parceiros": "Parceiros",
  "07_sarandi": "Sarandi",
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
  Sarandi: "sarandi",
};

export const STATUS_FOLDER_TO_DB_MAP: Record<string, string> =
  Object.fromEntries(
    Object.entries(STATUS_FOLDER_MAP).map(([folder, status]) => [
      folder,
      STATUS_DB_MAP[status],
    ]),
  );

function normalizeFolderKey(value: string) {
  return value.toLowerCase().replace(/\s+/g, "");
}

// Normalizador dedicado às subpastas reservadas: remove diacríticos (ex:
// "Comunicação" → "comunicacao") e trata espaço/underscore como
// equivalentes (ex: "Petições Subsequentes" → "peticoessubsequentes",
// batendo com a chave interna "peticoes_subsequentes"). Precisa ser mais
// permissivo que normalizeFolderKey (usado por matchStatusFolderKey), cujo
// contrato original não trata underscore como espaço.
// A remoção de diacríticos usa a faixa Unicode de marcas combinantes
// (U+0300–U+036F) em vez de \p{Diacritic}: o tsconfig do projeto tem
// target "es5", e esse regex property escape só é aceito pelo TypeScript
// a partir de target es2018+ — \p{Diacritic} quebrava `next build` no
// typecheck. A faixa cobre os mesmos diacríticos latinos (ç, ã, é etc.)
// depois de normalize("NFD").
export function normalizeReservedFolderKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s_]+/g, "");
}

export const CLIENT_SUBFOLDER_NAMES = [
  "documentos_pessoais",
  "comunicacao",
] as const;
export const PROCESS_SUBFOLDER_NAMES = [
  "inicial",
  "peticoes_subsequentes",
] as const;

// Subpastas fixas da estrutura padrão de cliente/processo (criadas pelo
// app ou pela migração) — nunca representam um processo em si, mesmo
// aparecendo no mesmo nível que as pastas de processo.
const RESERVED_CLIENT_SUBFOLDERS = [
  ...CLIENT_SUBFOLDER_NAMES,
  "outros",
  ...PROCESS_SUBFOLDER_NAMES,
] as const;

export function isReservedClientSubfolder(name: string): boolean {
  const normalized = normalizeReservedFolderKey(name);
  return RESERVED_CLIENT_SUBFOLDERS.some(
    (reserved) => normalizeReservedFolderKey(reserved) === normalized,
  );
}

// Decide quais datas de ciclo de vida gravar quando um evento de pasta
// chega para um cliente. Retorna {} quando não houve transição de status —
// rename e re-varredura não podem resetar data histórica. "audiencia" é
// subestado de ativo (não tem pasta própria), então não conta como transição.
export function datasDeTransicao(
  statusAtual: string | undefined,
  status: ClientStatus,
  hoje: string
): { data_ativacao?: string; data_finalizacao?: string | null } {
  const novo = STATUS_DB_MAP[status];
  const atual = statusAtual === "audiencia" ? "ativo" : statusAtual;
  if (atual === novo) return {};
  return {
    data_ativacao: status === "Ativo" ? hoje : undefined,
    data_finalizacao:
      status === "Arquivado" || status === "Cancelado" ? hoje : status === "Ativo" ? null : undefined
  };
}

// Casa o nome de uma pasta do Drive com a chave correspondente em
// STATUS_FOLDER_MAP, ignorando maiúsculas/minúsculas e espaços.
export function matchStatusFolderKey(folderName: string): string | undefined {
  const normalized = normalizeFolderKey(folderName);
  return Object.keys(STATUS_FOLDER_MAP).find(
    (key) => normalizeFolderKey(key) === normalized,
  );
}

export function folderNameToDisplayName(folderName: string): string {
  return folderName
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export function parseProcessFolderName(folderName: string): {
  number: string;
  actionType: string;
} {
  const match = folderName.match(/^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/);
  if (match) {
    const number = match[0];
    const rest = folderName.slice(number.length).replace(/^_/, "");
    return { number, actionType: folderNameToDisplayName(rest) };
  }
  return { number: folderName, actionType: "" };
}
