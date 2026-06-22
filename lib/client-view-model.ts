import type { Client, LegalProcess } from "@/lib/types";
import { formatCountLabel, joinNonEmpty } from "@/lib/domain";

export function getClientProcessCount(client: Client) {
  return client.processIds.length;
}

export function getPartnerLabel(client: Client) {
  if (client.partner === "Nenhum" || client.partnerFee === "—" || client.partnerFee === "-") {
    return "—";
  }

  return `${client.partner} · ${client.partnerFee}`;
}

export function getClientSubtitle(client: Client) {
  return joinNonEmpty([client.personType, client.document]);
}

export function getProcessCountLabel(client: Client) {
  const count = getClientProcessCount(client);
  return count === 0
    ? "Sem processo ainda"
    : formatCountLabel(count, "processo", "processos");
}

export function getProcessesForClient(client: Client, processes: LegalProcess[]) {
  return processes.filter((process) => client.processIds.includes(process.id));
}
