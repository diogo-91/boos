import type { Client, LegalProcess } from "@/lib/types";
import { CLIENT_STATUS_MAP, normalizeText } from "@/lib/domain";

export type ClientFilterState = {
  search: string;
  clientStatus: string;
  processStatus: string;
  billingModel: string;
  partner: string;
};

function getClientSearchIndex(client: Client, processes: LegalProcess[]) {
  const linked = processes.filter((process) => client.processIds.includes(process.id));

  return normalizeText(
    [
      client.name,
      client.legalName,
      client.tradeName,
      client.document,
      client.secondaryDocument,
      client.partner,
      client.origin,
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

  return clients.filter((client) => {
    if (normalizedSearch && !getClientSearchIndex(client, processes).includes(normalizedSearch)) {
      return false;
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
