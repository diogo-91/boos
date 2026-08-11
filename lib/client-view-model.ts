import type { Client, LegalProcess } from "@/lib/types";
import { formatCountLabel, joinNonEmpty } from "@/lib/domain";

export function getPartnerLabel(client: Client) {
  if (client.partner === "Nenhum" || client.partnerFee === "—" || client.partnerFee === "-") {
    return "—";
  }

  return `${client.partner} · ${client.partnerFee}`;
}

export function formatDocument(document: string) {
  const digits = document.replace(/\D/g, "");
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return document;
}

export function getClientSubtitle(client: Client) {
  return joinNonEmpty([client.personType, formatDocument(client.document)]);
}

export function getProcessCountLabel(client: Client) {
  const count = client.processIds.length;
  return count === 0
    ? "Sem processo ainda"
    : formatCountLabel(count, "processo", "processos");
}

export function getProcessesForClient(client: Client, processes: LegalProcess[]) {
  return processes.filter((process) => client.processIds.includes(process.id));
}
