import type { Client, LegalProcess } from "@/lib/types";

type AnyRecord = Record<string, unknown>;

function asString(value: unknown, fallback = "—") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function asOptionalString(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  return String(value);
}

function asDisplayDate(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";

  const text = String(value).split("T")[0];

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) return text;

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split("-");
    return `${day}/${month}/${year}`;
  }

  return String(value);
}

function asDbDate(value: unknown) {
  if (value === null || value === undefined || value === "" || value === "—") {
    return null;
  }

  const text = String(value).split("T")[0];

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
    const [day, month, year] = text.split("/");
    return `${year}-${month}-${day}`;
  }

  return text;
}

function mapPersonTypeFromDb(value: unknown): Client["personType"] {
  return String(value).toUpperCase() === "PJ" ? "Pessoa Jurídica" : "Pessoa Física";
}

function mapPersonTypeToDb(value: Client["personType"]) {
  return value === "Pessoa Jurídica" ? "PJ" : "PF";
}

function mapClientStatusFromDb(value: unknown): Client["status"] {
  switch (String(value)) {
    case "ativo":
      return "Ativo";
    case "arquivado":
      return "Arquivado";
    case "cancelado":
      return "Cancelado";
    case "dativo":
      return "Dativo";
    case "sarandi":
      return "Sarandi/IPTU";
    case "parceiros":
      return "Parceiros";
    case "contratacao":
    default:
      return "Em contratação";
  }
}

function mapClientStatusToDb(value: Client["status"]) {
  switch (value) {
    case "Ativo":
      return "ativo";
    case "Arquivado":
      return "arquivado";
    case "Cancelado":
      return "cancelado";
    case "Dativo":
      return "dativo";
    case "Sarandi/IPTU":
      return "sarandi";
    case "Parceiros":
      return "parceiros";
    case "Em contratação":
    default:
      return "contratacao";
  }
}

function mapProcessStatusFromDb(value: unknown): LegalProcess["status"] {
  switch (String(value)) {
    case "aguard_documentos":
      return "Aguard. documentos";
    case "aguard_audiencia":
      return "Aguard. audiência";
    case "acordado":
      return "Acordado";
    case "encerrado":
      return "Encerrado";
    case "em_andamento":
    default:
      return "Em andamento";
  }
}

function mapProcessStatusToDb(value: LegalProcess["status"]) {
  switch (value) {
    case "Aguard. documentos":
      return "aguard_documentos";
    case "Aguard. audiência":
      return "aguard_audiencia";
    case "Acordado":
      return "acordado";
    case "Encerrado":
      return "encerrado";
    case "Em andamento":
    default:
      return "em_andamento";
  }
}

function parsePercentToNumber(value: string) {
  if (!value) return null;
  const cleaned = value.replace("%", "").replace(",", ".").trim();
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

export function mapClienteFromDb(row: AnyRecord): Client {
  return {
    id: asString(row.id),
    name: asString(row.nome),
    status: mapClientStatusFromDb(row.status),
    personType: mapPersonTypeFromDb(row.tipo),
    partnerId: asOptionalString(row.parceiro_id),
    legalName: asString(row.nome),
    tradeName: asOptionalString(row.nome_fantasia),
    document: asString(row.cpf_cnpj),
    secondaryDocument: asString(row.rg_ie),
    birthOrOpeningDate: asDisplayDate(row.data_nascimento_abertura),
    maritalStatus: asOptionalString(row.estado_civil),
    registrationDate: asDisplayDate(row.data_cadastro),
    activationDate: asDisplayDate(row.data_ativacao),
    finalizationDate: asDisplayDate(row.data_finalizacao),
    phone: asString(row.telefone, ""),
    email: asString(row.email, ""),
    address: asString(row.endereco, ""),
    origin: asString(row.origem, ""),
    partner: asString((row.parceiros as { nome?: string } | null)?.nome ?? row.parceiro_nome ?? "Nenhum", "Nenhum"),
    partnerFee:
      row.percentual_parceiro === null || row.percentual_parceiro === undefined
        ? "—"
        : `${String(row.percentual_parceiro)}%`,
    driveFolderId: asOptionalString(row.drive_folder_id),
    driveFolder: asString(row.drive_path ?? row.drive_folder_id, ""),
    processIds: []
  };
}

export function mapClienteToDb(
  client: Client,
  includeId = true,
  partnerId?: string | null
) {
  return {
    ...(includeId ? { id: client.id } : {}),
    tipo: mapPersonTypeToDb(client.personType),
    nome: client.legalName,
    nome_fantasia: client.tradeName ?? null,
    cpf_cnpj: client.document,
    rg_ie: client.secondaryDocument,
    data_nascimento_abertura: asDbDate(client.birthOrOpeningDate),
    estado_civil: client.maritalStatus ?? null,
    status: mapClientStatusToDb(client.status),
    telefone: client.phone || null,
    email: client.email || null,
    endereco: client.address || null,
    origem: client.origin || null,
    parceiro_id: partnerId ?? client.partnerId ?? null,
    percentual_parceiro: parsePercentToNumber(client.partnerFee),
    data_cadastro: asDbDate(client.registrationDate),
    data_ativacao: asDbDate(client.activationDate),
    data_finalizacao: asDbDate(client.finalizationDate),
    drive_folder_id: client.driveFolderId ?? null,
    drive_path: client.driveFolder || null
  };
}

export function mapProcessoFromDb(row: AnyRecord): LegalProcess {
  return {
    id: asString(row.id),
    clientId: asString(row.cliente_id),
    number: asString(row.numero_cnj),
    actionType: asString(row.tipo_acao, ""),
    status: mapProcessStatusFromDb(row.status),
    billingModel: asString(row.modelo_cobranca, ""),
    location: asString(row.localizacao, ""),
    opposingParty: asString(row.parte_contraria, ""),
    court: asString(row.vara_comarca, ""),
    filingDate: asDisplayDate(row.data_protocolo),
    closingDate: asDisplayDate(row.data_encerramento),
    duration: asString(row.duracao, "—"),
    entryValue:
      row.valor_entrada === null || row.valor_entrada === undefined || Number(row.valor_entrada) === 0
        ? "—"
        : `R$ ${Number(row.valor_entrada).toFixed(2).replace(".", ",")}`,
    successFee:
      row.percentual_exito === null || row.percentual_exito === undefined
        ? "—"
        : `${String(row.percentual_exito)}%`,
    driveFolderId: asOptionalString(row.drive_folder_id),
    driveFolder: asOptionalString(row.drive_path),
    documents: [],
    notes: asString(row.anotacoes, "")
  };
}

export function mapProcessoToDb(process: LegalProcess, includeId = true) {
  return {
    ...(includeId ? { id: process.id } : {}),
    cliente_id: process.clientId,
    numero_cnj: process.number || "A definir",
    parte_contraria: process.opposingParty || null,
    tipo_acao: process.actionType || null,
    status: mapProcessStatusToDb(process.status),
    vara_comarca: process.court || null,
    data_protocolo: asDbDate(process.filingDate),
    data_encerramento: asDbDate(process.closingDate),
    modelo_cobranca: process.billingModel || null,
    valor_entrada: process.entryValue
      ? Number(
          process.entryValue
            .replace("R$", "")
            .replace(/\./g, "")
            .replace(",", ".")
            .trim()
        )
      : null,
    percentual_exito: parsePercentToNumber(process.successFee),
    localizacao: process.location || null,
    anotacoes: process.notes || null,
    drive_folder_id: process.driveFolderId ?? null,
    drive_path: process.driveFolder ?? null
  };
}
