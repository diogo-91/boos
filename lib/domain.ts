import type { ClientStatus, ProcessStatus, Status } from "@/lib/types";

// Lista única de status usada nos formulários de cliente e de processo.
export const STATUS_OPTIONS: Status[] = [
  "Ativo",
  "Contratação",
  "Audiência",
  "Arquivado",
  "Cancelado"
];

export const CLIENT_STATUS_FILTERS = [
  "Todos",
  "Ativos",
  "Contratação",
  "Audiência",
  "Arquivados",
  "Cancelados"
] as const;

export const PROCESS_STATUS_FILTERS = [
  "Todos",
  "Ativo",
  "Contratação",
  "Audiência",
  "Arquivado",
  "Cancelado"
] as const;

export const STATUS_BADGE_CLASSES: Record<ClientStatus | ProcessStatus, string> = {
  Ativo: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Contratação: "bg-amber-50 text-amber-700 ring-amber-200",
  Audiência: "bg-blue-50 text-blue-700 ring-blue-200",
  Arquivado: "bg-slate-100 text-slate-700 ring-slate-200",
  Cancelado: "bg-red-50 text-red-700 ring-red-200",
  // Legados
  Sarandi: "bg-orange-50 text-orange-700 ring-orange-200",
  Dativo: "bg-purple-50 text-purple-700 ring-purple-200",
  Parceiros: "bg-sky-50 text-sky-700 ring-sky-200",
  Andamento: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  "Aguard. documentos": "bg-yellow-100 text-yellow-800 ring-yellow-200",
  "Aguard. audiência": "bg-blue-100 text-blue-800 ring-blue-200",
  Acordado: "bg-violet-100 text-violet-800 ring-violet-200",
  Encerrado: "bg-slate-100 text-slate-700 ring-slate-200"
};

export const CLIENT_STATUS_MAP: Record<string, ClientStatus> = {
  Ativos: "Ativo",
  Contratação: "Contratação",
  Audiência: "Audiência",
  Arquivados: "Arquivado",
  Cancelados: "Cancelado"
};

const TITLE_CASE_LOWERCASE_WORDS = new Set(["de", "da", "do", "das", "dos", "e"]);

// Normaliza nomes digitados TUDO MAIÚSCULO ou tudo minúsculo para Title Case
// (preposições "de/da/do" minúsculas). Nomes que já têm capitalização mista
// (ex.: "Construtora Vega Ltda.") são mantidos como estão, para não estragar
// abreviações de razão social (Ltda., S.A., ME, EPP...).
export function toTitleCase(value: string) {
  if (!value) return value;
  const isShoutingOrFlat = value === value.toUpperCase() || value === value.toLowerCase();
  if (!isShoutingOrFlat) return value;

  return value
    .toLowerCase()
    .split(" ")
    .map((word, index) => {
      if (!word) return word;
      if (index > 0 && TITLE_CASE_LOWERCASE_WORDS.has(word)) return word;
      return word.charAt(0).toLocaleUpperCase("pt-BR") + word.slice(1);
    })
    .join(" ");
}

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
