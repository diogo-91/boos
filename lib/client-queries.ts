import type { Client, LegalProcess } from "@/lib/types";
import { CLIENT_STATUS_MAP, normalizeText } from "@/lib/domain";
import { normalizeDocument } from "@/lib/validation";

// Quando a busca só bate no texto livre da observação, o resultado aparece
// na lista sem nenhum indício do motivo (nome/CPF/parceiro não mudam) — o
// usuário vê o cliente mas não sabe por quê. Isso extrai um trecho ao redor
// do termo encontrado pra mostrar esse contexto junto do resultado.
export function getNotesMatchSnippet(notes: string, search: string, radius = 36): string | null {
  const trimmedNotes = notes.trim();
  const trimmedSearch = search.trim();
  if (!trimmedNotes || !trimmedSearch) return null;

  const normalizedNotes = normalizeText(trimmedNotes);
  const normalizedSearch = normalizeText(trimmedSearch);
  const index = normalizedNotes.indexOf(normalizedSearch);
  if (index === -1) return null;

  const start = Math.max(0, index - radius);
  const end = Math.min(trimmedNotes.length, index + normalizedSearch.length + radius);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < trimmedNotes.length ? "…" : "";
  return `${prefix}${trimmedNotes.slice(start, end).trim()}${suffix}`;
}

export type ClientFilterState = {
  search: string;
  clientStatus: string;
  processStatus: string;
  billingModel: string;
  partner: string;
};

function getClientSearchIndex(client: Client, processes: LegalProcess[]) {
  const linked = processes.filter((process) => client.processIds.includes(process.id));

  const text = normalizeText(
    [
      client.name,
      client.legalName,
      client.tradeName,
      client.document,
      client.secondaryDocument,
      client.partner,
      client.origin,
      client.notes,
      ...linked.flatMap((process) => [
        process.number,
        process.opposingParty,
        process.actionType,
        process.location,
        process.billingModel
      ])
    ]
      .filter(Boolean)
      .join(" ")
  );

  // client.document guarda o CPF/CNPJ formatado ("123.456.789-01"). Buscar
  // só pelos dígitos (o jeito mais comum de digitar/colar um CPF) não batia
  // contra esse texto formatado — dependendo do que mais aparecesse no
  // restante do índice, a busca podia não achar o cliente certo ou casar
  // com outro por coincidência de dígitos soltos em outro campo.
  const digits = normalizeDocument(
    [client.document, client.secondaryDocument].filter(Boolean).join(" ")
  );

  return { text, digits };
}

function matchesClientStatus(client: Client, filter: string) {
  if (filter === "Todos") return true;
  const mapped = CLIENT_STATUS_MAP[filter] ?? filter;
  return client.status === mapped;
}

function matchesProcessStatus(client: Client, filter: string, processes: LegalProcess[]) {
  if (filter === "Todos") return true;
  return processes.some(
    (process) => client.processIds.includes(process.id) && process.status === filter
  );
}

function matchesBillingModel(client: Client, filter: string, processes: LegalProcess[]) {
  if (filter === "Todos") return true;
  return processes.some(
    (process) => client.processIds.includes(process.id) && process.billingModel === filter
  );
}

export function filterClients(
  clients: Client[],
  processes: LegalProcess[],
  filters: ClientFilterState
) {
  const normalizedSearch = normalizeText(filters.search);
  const searchDigits = normalizeDocument(filters.search);

  return clients.filter((client) => {
    if (normalizedSearch) {
      const index = getClientSearchIndex(client, processes);
      const matchesText = index.text.includes(normalizedSearch);
      const matchesDigits = searchDigits.length > 0 && index.digits.includes(searchDigits);
      if (!matchesText && !matchesDigits) return false;
    }
    if (!matchesClientStatus(client, filters.clientStatus)) return false;
    if (!matchesProcessStatus(client, filters.processStatus, processes)) return false;
    if (!matchesBillingModel(client, filters.billingModel, processes)) return false;
    if (filters.partner !== "Todos" && client.partner !== filters.partner) return false;
    if (client.processIds.length === 0 && filters.processStatus !== "Todos") return false;
    if (client.processIds.length === 0 && filters.billingModel !== "Todos") return false;
    return true;
  });
}

export function findDuplicateClient(
  clients: Client[],
  values: { legalName: string; document: string },
  excludeId?: string
): { byDocument?: Client; byName?: Client } {
  const document = normalizeDocument(values.document);
  const name = normalizeText(values.legalName);

  const others = clients.filter((client) => client.id !== excludeId);

  const byDocument = document
    ? others.find((client) => normalizeDocument(client.document) === document)
    : undefined;
  const byName = others.find((client) => normalizeText(client.legalName) === name);

  return { byDocument, byName };
}

export function uniqueBillingModels(processes: LegalProcess[]) {
  return Array.from(
    new Set(processes.map((process) => process.billingModel).filter(Boolean))
  ).sort();
}

export function uniquePartners(clients: Client[]) {
  return Array.from(
    new Set(
      clients
        .map((client) => client.partner)
        .filter((partner) => partner !== "-" && partner !== "—" && partner !== "Nenhum")
    )
  ).sort();
}
