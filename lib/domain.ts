import type { ClientStatus, ProcessStatus } from "@/lib/types";

export const CLIENT_STATUS_FILTERS = [
  "Todos",
  "Ativos",
  "Sarandi",
  "Em contratação",
  "Dativos",
  "Parceiros",
  "Arquivados",
  "Cancelados"
] as const;

export const PROCESS_STATUS_FILTERS = [
  "Todos",
  "Em andamento",
  "Aguard. documentos",
  "Aguard. audiência",
  "Acordado",
  "Encerrado"
] as const;

export const STATUS_BADGE_CLASSES: Record<ClientStatus | ProcessStatus, string> = {
  Ativo: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "Em contratação": "bg-amber-50 text-amber-700 ring-amber-200",
  "Sarandi/IPTU": "bg-orange-50 text-orange-700 ring-orange-200",
  Dativo: "bg-purple-50 text-purple-700 ring-purple-200",
  Parceiros: "bg-sky-50 text-sky-700 ring-sky-200",
  Arquivado: "bg-slate-100 text-slate-700 ring-slate-200",
  Cancelado: "bg-red-50 text-red-700 ring-red-200",
  "Em andamento": "bg-emerald-100 text-emerald-800 ring-emerald-200",
  "Aguard. documentos": "bg-yellow-100 text-yellow-800 ring-yellow-200",
  "Aguard. audiência": "bg-blue-100 text-blue-800 ring-blue-200",
  Acordado: "bg-violet-100 text-violet-800 ring-violet-200",
  Encerrado: "bg-slate-100 text-slate-700 ring-slate-200"
};

export const CLIENT_STATUS_MAP: Record<string, ClientStatus> = {
  Ativos: "Ativo",
  Sarandi: "Sarandi/IPTU",
  "Em contratação": "Em contratação",
  Dativos: "Dativo",
  Parceiros: "Parceiros",
  Arquivados: "Arquivado",
  Cancelados: "Cancelado"
};

export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function formatCountLabel(count: number, singular: string, plural: string) {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

export function joinNonEmpty(values: Array<string | undefined | null>) {
  return values.filter(Boolean).join(" ");
}
