export type ClientStatus =
  | "Ativo"
  | "Em contratação"
  | "Sarandi/IPTU"
  | "Dativo"
  | "Parceiros"
  | "Arquivado"
  | "Cancelado";

export type ProcessStatus =
  | "Em andamento"
  | "Aguard. documentos"
  | "Aguard. audiência"
  | "Acordado"
  | "Encerrado";

export type PersonType = "Pessoa Física" | "Pessoa Jurídica";

export type Client = {
  id: string;
  name: string;
  status: ClientStatus;
  personType: PersonType;
  partnerId?: string | null;
  legalName: string;
  tradeName?: string;
  document: string;
  secondaryDocument: string;
  birthOrOpeningDate: string;
  maritalStatus?: string;
  registrationDate: string;
  activationDate: string;
  finalizationDate: string;
  phone: string;
  email: string;
  address: string;
  origin: string;
  partner: string;
  partnerFee: string;
  driveFolderId?: string | null;
  driveFolder: string;
  processIds: string[];
};

export type LegalProcess = {
  id: string;
  clientId: string;
  number: string;
  actionType: string;
  status: ProcessStatus;
  billingModel: string;
  location: string;
  opposingParty: string;
  court: string;
  filingDate: string;
  closingDate: string;
  duration: string;
  entryValue: string;
  successFee: string;
  driveFolderId?: string | null;
  driveFolder?: string | null;
  documents: string[];
  notes: string;
};

export type ClientFormValues = {
  personType: PersonType;
  legalName: string;
  tradeName?: string;
  document: string;
  secondaryDocument: string;
  birthOrOpeningDate: string;
  maritalStatus?: string;
  status: ClientStatus;
  phone: string;
  email: string;
  address: string;
  origin: string;
  partner: string;
  partnerFee: string;
};

export type ProcessFormValues = {
  clientId: string;
  number: string;
  opposingParty: string;
  actionType: string;
  status: ProcessStatus;
  court: string;
  filingDate: string;
  closingDate: string;
  billingModel: string;
  entryValue: string;
  successFee: string;
  location: string;
  notes: string;
};

export type Parceiro = {
  id: string;
  nome: string;
  percentual_honorario?: string | null;
};

export type StatusHistoryEntity = "cliente" | "processo";

export type StatusHistoryEntry = {
  id: string;
  entity: StatusHistoryEntity;
  entityId: string;
  previousStatus: string;
  newStatus: string;
  eventDate: string;
  note?: string;
};
