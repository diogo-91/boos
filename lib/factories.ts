import type {
  Client,
  ClientFormValues,
  ClientStatus,
  LegalProcess,
  Parceiro,
  ProcessFormValues
} from "@/lib/types";
import { generateId } from "@/lib/id";
import { formatInputDate, formatTodayBR } from "@/lib/date-utils";

export function attachProcessIds(clients: Client[], processes: LegalProcess[]) {
  return clients.map((client) => ({
    ...client,
    processIds: processes
      .filter((p) => p.clientId === client.id)
      .map((p) => p.id)
  }));
}

export function attachPartnerNames(clients: Client[], partners: Parceiro[]) {
  const partnerMap = new Map(partners.map((p) => [p.id, p.nome]));
  return clients.map((client) => ({
    ...client,
    partner:
      client.partnerId && partnerMap.has(client.partnerId)
        ? (partnerMap.get(client.partnerId) ?? "Nenhum")
        : client.partner || "Nenhum"
  }));
}

export function resolvePartnerId(partners: Parceiro[], partnerName?: string) {
  if (!partnerName) return null;
  const normalized = partnerName.trim().toLowerCase();
  return (
    partners.find((p) => p.nome.trim().toLowerCase() === normalized)?.id ?? null
  );
}

export function makeClient(values: ClientFormValues, existing?: Client): Client {
  return {
    id: existing?.id ?? generateId("cliente", values.legalName),
    name: values.legalName,
    status: values.status,
    personType: values.personType,
    partnerId: existing?.partnerId ?? null,
    legalName: values.legalName,
    tradeName: values.tradeName,
    document: values.document,
    secondaryDocument: values.secondaryDocument,
    birthOrOpeningDate: formatInputDate(values.birthOrOpeningDate),
    maritalStatus: values.maritalStatus,
    registrationDate: existing?.registrationDate ?? formatTodayBR(),
    activationDate: existing?.activationDate || (values.status === "Ativo" ? formatTodayBR() : "—"),
    finalizationDate: existing?.finalizationDate ?? "—",
    phone: values.phone,
    email: values.email,
    address: values.address,
    origin: values.origin,
    partner: values.partner || "Nenhum",
    partnerFee: values.partnerFee || "—",
    driveFolderId: existing?.driveFolderId ?? null,
    driveFolder: existing?.driveFolder ?? "",
    processIds: existing?.processIds ?? []
  };
}

export function makeProcess(values: ProcessFormValues): LegalProcess {
  const number = values.number.trim() || "A definir";
  return {
    id: generateId("processo", number),
    clientId: values.clientId,
    number,
    actionType: values.actionType,
    status: values.status,
    billingModel: values.billingModel,
    location: values.location,
    opposingParty: values.opposingParty,
    court: values.court,
    filingDate: formatInputDate(values.filingDate),
    closingDate: formatInputDate(values.closingDate),
    duration: "—",
    entryValue: values.entryValue || "R$ 0,00",
    successFee: values.successFee || "—",
    driveFolderId: null,
    driveFolder: null,
    documents: [],
    notes: values.notes
  };
}

export function applyClientStatusDates(
  client: Client,
  status: ClientStatus,
  date: string
): Client {
  return {
    ...client,
    status,
    activationDate: status === "Ativo" ? date : client.activationDate,
    finalizationDate:
      status === "Arquivado" || status === "Cancelado"
        ? date
        : status === "Ativo"
          ? "—"
          : client.finalizationDate
  };
}
