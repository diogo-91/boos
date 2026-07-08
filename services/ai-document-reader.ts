import Anthropic from "@anthropic-ai/sdk";
import mammoth from "mammoth";
import { getGoogleDriveClient, getGoogleDriveRootFolderId } from "@/lib/google/drive";
import { getSupabaseClient } from "@/lib/supabase/client";
import { STATUS_FOLDER_TO_DB_MAP, folderNameToDisplayName } from "@/lib/drive-status-map";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type ExtractedClientFields = {
  nome?: string;
  cpf_cnpj?: string;
  rg_ie?: string;
  data_nascimento_abertura?: string;
  estado_civil?: string;
  endereco?: string;
  nome_fantasia?: string;
  telefone?: string;
  email?: string;
  // Aliases vindos do contrato de honorários
  nome_cliente?: string;
};

export type ExtractedProcessFields = {
  numero_cnj?: string;
  tipo_acao?: string;
  parte_contraria?: string;
  vara_comarca?: string;
  data_protocolo?: string;
  modelo_cobranca?: string;
  valor_entrada?: string;
  percentual_exito?: string;
};

export type DocumentType =
  | "documento_pessoal"
  | "procuracao"
  | "contrato_honorarios"
  | "documento_inicial"
  | "outro";

function detectDocumentType(fileName: string, folderPath: string): DocumentType {
  const name = fileName.toLowerCase();
  const path = folderPath.toLowerCase();

  if (name.includes("procuracao") || name.includes("procuração")) return "procuracao";
  if (name.includes("contrato_honorarios") || name.includes("contrato de honorários") || name.includes("contrato honorarios") || name.includes("contrato honorários")) return "contrato_honorarios";
  if (path.includes("documentos_pessoais")) return "documento_pessoal";
  if (path.includes("inicial")) return "documento_inicial";

  // Detecta documento pessoal pelo nome do arquivo
  const docPessoalKeywords = ["documento pessoal", "doc. pessoal", "rg", "cnh", "cpf", "identidade", "carteira de identidade"];
  if (docPessoalKeywords.some((kw) => name.includes(kw))) return "documento_pessoal";

  // Detecta petição inicial pelo nome do arquivo
  const inicialKeywords = ["inicial", "peticao", "petição", "protocolo"];
  if (inicialKeywords.some((kw) => name.includes(kw))) return "documento_inicial";

  return "outro";
}

// Tipos que o Claude aceita nativamente (PDF e imagens)
const CLAUDE_NATIVE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp"
]);

// Tipos que são binários sem suporte de extração de texto — pular silenciosamente
const BINARY_SKIP_TYPES = new Set([
  "application/zip",
  "application/x-zip-compressed",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
  "application/octet-stream",
  "application/x-msdownload",
  "video/mp4",
  "video/mpeg",
  "audio/mpeg",
  "audio/mp4"
]);

async function extractTextFromBuffer(buffer: Buffer, mimeType: string): Promise<string | null> {
  // .docx
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const { value } = await mammoth.extractRawText({ buffer });
    return value.trim() || null;
  }

  // .doc
  if (mimeType === "application/msword") {
    const WordExtractor = (await import("word-extractor")).default;
    const extractor = new WordExtractor();
    const doc = await extractor.extract(buffer);
    return doc.getBody()?.trim() || null;
  }

  // .odt (OpenDocument Text) — mammoth suporta
  if (mimeType === "application/vnd.oasis.opendocument.text") {
    try {
      const { value } = await mammoth.extractRawText({ buffer });
      return value.trim() || null;
    } catch { return null; }
  }

  // .rtf — texto com markup, extrai removendo comandos RTF
  if (mimeType === "application/rtf" || mimeType === "text/rtf") {
    const raw = buffer.toString("latin1");
    const text = raw
      .replace(/\\\w+\*?[\s]?/g, " ")   // remove comandos RTF
      .replace(/[{}\\]/g, " ")            // remove chaves e barras
      .replace(/\s{2,}/g, " ")
      .trim();
    return text.length > 20 ? text : null;
  }

  // Texto plano: txt, csv, html, xml, json
  if (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "application/xml"
  ) {
    const text = buffer.toString("utf-8").trim();
    return text || null;
  }

  return null;
}

async function downloadFileFromDrive(fileId: string): Promise<{ content: string; mimeType: string } | null> {
  const drive = getGoogleDriveClient();
  const { data: meta } = await drive.files.get({ fileId, fields: "mimeType,name,size" });
  const mimeType = meta.mimeType ?? "";

  // Tipos binários sem extração possível — pula
  if (BINARY_SKIP_TYPES.has(mimeType)) return null;

  // Google Docs → exporta como PDF (Claude lê nativamente)
  if (mimeType.includes("google-apps.document")) {
    const res = await drive.files.export({ fileId, mimeType: "application/pdf" }, { responseType: "arraybuffer" });
    return { content: Buffer.from(res.data as ArrayBuffer).toString("base64"), mimeType: "application/pdf" };
  }

  // Google Sheets → exporta como texto CSV
  if (mimeType.includes("google-apps.spreadsheet")) {
    const res = await drive.files.export({ fileId, mimeType: "text/csv" }, { responseType: "arraybuffer" });
    const text = Buffer.from(res.data as ArrayBuffer).toString("utf-8").trim();
    if (!text) return null;
    return { content: Buffer.from(text).toString("base64"), mimeType: "text/plain" };
  }

  // PDF e imagens — Claude lê nativamente; limite 20 MB
  if (CLAUDE_NATIVE_TYPES.has(mimeType)) {
    if (meta.size && Number(meta.size) > 20 * 1024 * 1024) return null;
    const res = await drive.files.get({ fileId, alt: "media" }, { responseType: "arraybuffer" });
    return { content: Buffer.from(res.data as ArrayBuffer).toString("base64"), mimeType };
  }

  // Tudo o mais: tenta extrair texto do binário
  if (meta.size && Number(meta.size) > 20 * 1024 * 1024) return null;
  const res = await drive.files.get({ fileId, alt: "media" }, { responseType: "arraybuffer" });
  const buffer = Buffer.from(res.data as ArrayBuffer);
  const text = await extractTextFromBuffer(buffer, mimeType);
  if (!text) return null;
  return { content: Buffer.from(text).toString("base64"), mimeType: "text/plain" };
}

async function extractWithClaude(
  base64Content: string,
  mimeType: string,
  documentType: DocumentType,
  fileName: string
): Promise<Record<string, string>> {
  const NULL_INSTRUCTION = `REGRA OBRIGATÓRIA: Para qualquer campo não encontrado claramente no documento, retorne null. NUNCA retorne strings como "não informado", "não disponível", "N/A", "não identificado", "desconhecido", "-" ou qualquer texto que indique ausência de dado. Se não encontrou, retorne null.`;

  const prompts: Record<DocumentType, string> = {
    documento_pessoal: `Analise este documento (pode ser RG, CNH, CPF, cartão CNPJ ou contrato social).
Extraia e retorne APENAS um objeto JSON com os campos encontrados:
{
  "nome": "nome completo da pessoa ou razão social da empresa, ou null",
  "cpf_cnpj": "CPF no formato 000.000.000-00 ou CNPJ no formato 00.000.000/0000-00, ou null",
  "rg_ie": "número do RG ou Inscrição Estadual, ou null",
  "data_nascimento_abertura": "data no formato AAAA-MM-DD, ou null",
  "estado_civil": "estado civil se disponível (ex: Solteiro, Casado, Divorciado, Viúvo), ou null",
  "endereco": "endereço completo incluindo rua, número, bairro, cidade e estado, ou null",
  "telefone": "telefone com DDD no formato (00) 00000-0000, ou null",
  "nome_fantasia": "nome fantasia se for CNPJ, ou null"
}
${NULL_INSTRUCTION}
Retorne SOMENTE o JSON, sem texto adicional.`,

    procuracao: `Analise esta procuração.
Extraia e retorne APENAS um objeto JSON com os dados do OUTORGANTE (cliente que assinou):
{
  "nome": "nome completo do outorgante, ou null",
  "cpf_cnpj": "CPF do outorgante no formato 000.000.000-00, ou null",
  "rg_ie": "RG do outorgante, ou null",
  "estado_civil": "estado civil do outorgante (ex: Solteiro, Casado, Divorciado, Viúvo), ou null",
  "endereco": "endereço completo do outorgante, ou null",
  "telefone": "telefone do outorgante com DDD, ou null",
  "email": "e-mail do outorgante, ou null",
  "data_nascimento_abertura": "data de nascimento no formato AAAA-MM-DD, ou null"
}
${NULL_INSTRUCTION}
Retorne SOMENTE o JSON, sem texto adicional.`,

    contrato_honorarios: `Analise este contrato de honorários advocatícios.
Extraia e retorne APENAS um objeto JSON:
{
  "modelo_cobranca": "um de: Indefinido / Entrada / Êxito / Entrada + Êxito / Recorrente, ou null",
  "valor_entrada": "valor de entrada em formato R$ 0.000,00, ou null",
  "percentual_exito": "porcentagem de êxito como número apenas (ex: 20), ou null",
  "nome_cliente": "nome completo do cliente contratante, ou null",
  "cpf_cnpj": "CPF/CNPJ do cliente, ou null",
  "telefone": "telefone do cliente com DDD, ou null",
  "email": "e-mail do cliente, ou null",
  "endereco": "endereço completo do cliente, ou null"
}
${NULL_INSTRUCTION}
Retorne SOMENTE o JSON, sem texto adicional.`,

    documento_inicial: `Analise este documento de petição inicial ou protocolo processual.
Extraia e retorne APENAS um objeto JSON:
{
  "numero_cnj": "número do processo EXATAMENTE no formato CNJ: 0000000-00.0000.0.00.0000 — se não encontrar esse padrão exato, retorne null",
  "tipo_acao": "tipo/natureza da ação (ex: Acidente de trabalho, Indenização por danos morais), ou null",
  "parte_contraria": "nome da parte contrária (réu/reclamado), ou null",
  "vara_comarca": "vara e comarca onde tramita, ou null",
  "data_protocolo": "data do protocolo no formato AAAA-MM-DD, ou null",
  "nome": "nome completo do autor/cliente, ou null",
  "cpf_cnpj": "CPF do autor/cliente, ou null",
  "telefone": "telefone do autor/cliente com DDD, ou null",
  "email": "e-mail do autor/cliente, ou null",
  "endereco": "endereço completo do autor/cliente, ou null"
}
${NULL_INSTRUCTION}
Retorne SOMENTE o JSON, sem texto adicional.`,

    outro: `Analise este documento jurídico e extraia qualquer informação relevante sobre o cliente ou processo.
Retorne APENAS um objeto JSON com os campos que conseguir identificar com certeza:
{
  "numero_cnj": "número CNJ exato no formato 0000000-00.0000.0.00.0000, ou null",
  "nome": "nome do cliente, ou null",
  "cpf_cnpj": "CPF/CNPJ, ou null"
}
${NULL_INSTRUCTION}
Retorne SOMENTE o JSON, sem texto adicional.`
  };

  const isImage = mimeType.startsWith("image/");
  const isPdf = mimeType === "application/pdf";
  const isText = mimeType.startsWith("text/") || mimeType === "text/plain";

  if (!isImage && !isPdf && !isText) return {};

  // Para texto puro (extraído de .docx via mammoth), manda como texto direto
  const content = isText
    ? [{ type: "text" as const, text: `Arquivo: ${fileName}\n\nConteúdo do documento:\n${Buffer.from(base64Content, "base64").toString("utf-8")}\n\n${prompts[documentType]}` }]
    : [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { type: "document", source: { type: "base64", media_type: isImage ? (mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp") : "application/pdf", data: base64Content } } as any,
        { type: "text" as const, text: `Arquivo: ${fileName}\n\n${prompts[documentType]}` }
      ];

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [{ role: "user", content }]
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return {};

  try {
    return JSON.parse(jsonMatch[0]) as Record<string, string>;
  } catch {
    return {};
  }
}

// Campos de data que devem estar no formato YYYY-MM-DD para o Postgres
const DATE_FIELDS = new Set(["data_nascimento_abertura", "data_protocolo", "data_encerramento"]);

// Regex para detectar qualquer variação de "não encontrado" que o AI possa retornar
const PLACEHOLDER_PATTERN = /^(n[aã]o\s|sem\s|s\/|n\/|nenhum|indefinid|desconhecid|ausente|indisp|n[aã]o\s+consta|n[aã]o\s+localiz|n[aã]o\s+identific|n[aã]o\s+inform|n[aã]o\s+dispon|\?+|-+)|\b(n\/a|n\.a\.|null|undefined|none)\b/i;

function sanitizeValue(key: string, raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const v = String(raw).trim();
  if (v === "" || v === "null" || v === "undefined") return null;

  // Descarta qualquer variação de placeholder
  if (PLACEHOLDER_PATTERN.test(v)) return null;

  // Campos de data: aceita DD/MM/YYYY e converte para YYYY-MM-DD; rejeita qualquer outra coisa que não seja data
  if (DATE_FIELDS.has(key)) {
    // Já no formato ISO
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    // Formato BR DD/MM/YYYY ou DD/MM/AAAA
    const br = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (br) return `${br[3]}-${br[2]}-${br[1]}`;
    // Não reconhecido — descarta para não quebrar o banco
    return null;
  }

  return v;
}

function sanitizeClientFields(fields: ExtractedClientFields): ExtractedClientFields {
  const result: ExtractedClientFields = {};
  for (const [k, v] of Object.entries(fields)) {
    const clean = sanitizeValue(k, v);
    if (clean !== null) result[k as keyof ExtractedClientFields] = clean;
  }
  return result;
}

function sanitizeProcessFields(fields: ExtractedProcessFields): ExtractedProcessFields {
  const result: ExtractedProcessFields = {};
  for (const [k, v] of Object.entries(fields)) {
    const clean = sanitizeValue(k, v);
    if (clean !== null) result[k as keyof ExtractedProcessFields] = clean;
  }
  return result;
}

async function updateClientFields(clientId: string, fields: ExtractedClientFields) {
  const updateData = Object.fromEntries(
    Object.entries(sanitizeClientFields(fields))
  );
  if (Object.keys(updateData).length === 0) return;

  const { error } = await getSupabaseClient().from("clientes").update(updateData).eq("id", clientId);
  if (error) throw new Error(`Supabase clientes update: ${error.message} (${error.code}) — dados: ${JSON.stringify(updateData)}`);
}

async function updateProcessFields(processId: string, fields: ExtractedProcessFields) {
  const sanitized = sanitizeProcessFields(fields);
  const updateData: Record<string, unknown> = { ...sanitized };

  if (Object.keys(updateData).length === 0) return;

  const { error } = await getSupabaseClient().from("processos").update(updateData).eq("id", processId);
  if (error) throw new Error(`Supabase processos update: ${error.message} (${error.code}) — dados: ${JSON.stringify(updateData)}`);
}

async function findClientByDriveFolderId(folderId: string) {
  const { data } = await getSupabaseClient()
    .from("clientes")
    .select("id")
    .eq("drive_folder_id", folderId)
    .maybeSingle();
  return data?.id ?? null;
}

async function getFolderName(folderId: string): Promise<string | null> {
  const drive = getGoogleDriveClient();
  const { data } = await drive.files.get({ fileId: folderId, fields: "name" });
  return data.name ?? null;
}

async function findClientByFolderName(folderId: string): Promise<string | null> {
  const folderName = await getFolderName(folderId);
  if (!folderName) return null;

  const displayName = folderNameToDisplayName(folderName);

  const { data: exact } = await getSupabaseClient()
    .from("clientes")
    .select("id")
    .ilike("nome", displayName)
    .maybeSingle();

  let found = exact;
  if (!found) {
    const tokens = displayName.split(" ");
    const first = tokens[0];
    const last = tokens[tokens.length - 1];
    const { data } = await getSupabaseClient()
      .from("clientes")
      .select("id")
      .ilike("nome", `%${first}%${last}%`)
      .maybeSingle();
    found = data;
  }

  if (found?.id) {
    await getSupabaseClient()
      .from("clientes")
      .update({ drive_folder_id: folderId })
      .eq("id", found.id);
  }

  return found?.id ?? null;
}

async function findProcessByDriveFolderId(folderId: string) {
  const { data } = await getSupabaseClient()
    .from("processos")
    .select("id,cliente_id")
    .eq("drive_folder_id", folderId)
    .maybeSingle();
  return data ?? null;
}

async function getParentFolderId(folderId: string): Promise<string | null> {
  const drive = getGoogleDriveClient();
  const { data } = await drive.files.get({ fileId: folderId, fields: "parents" });
  return data.parents?.[0] ?? null;
}

async function getStatusFolderMap(): Promise<Record<string, string>> {
  const drive = getGoogleDriveClient();
  const { data } = await drive.files.list({
    q: `'${getGoogleDriveRootFolderId()}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id,name)",
    pageSize: 30
  });

  const map: Record<string, string> = {};
  for (const f of data.files ?? []) {
    if (!f.id || !f.name) continue;
    const normalized = f.name.toLowerCase().replace(/\s+/g, "");
    const matched = Object.entries(STATUS_FOLDER_TO_DB_MAP).find(
      ([key]) => key.toLowerCase().replace(/\s+/g, "") === normalized
    );
    if (matched) map[f.id] = matched[1];
  }
  return map;
}

export type ReadResult = {
  fileId: string;
  fileName: string;
  documentType: DocumentType;
  fieldsExtracted: string[];
  clientId: string | null;
  processId: string | null;
  skipped: boolean;
  skipReason?: string;
};

export async function readDriveFile(
  fileId: string,
  fileName: string,
  parentFolderId: string
): Promise<ReadResult> {
  const result: ReadResult = {
    fileId,
    fileName,
    documentType: "outro",
    fieldsExtracted: [],
    clientId: null,
    processId: null,
    skipped: false
  };

  const grandParentId = await getParentFolderId(parentFolderId);
  const statusMap = await getStatusFolderMap();

  let clientFolderId: string | null = null;
  let folderContext = fileName;

  if (statusMap[parentFolderId]) {
    result.skipped = true;
    result.skipReason = "Arquivo na pasta de status, não dentro de um cliente";
    return result;
  } else if (grandParentId && statusMap[grandParentId]) {
    clientFolderId = parentFolderId;
  } else if (grandParentId) {
    clientFolderId = grandParentId;
    folderContext = `documentos_pessoais/${fileName}`;
  }

  const processRecord = await findProcessByDriveFolderId(parentFolderId);
  if (processRecord) {
    result.processId = processRecord.id;
    result.clientId = processRecord.cliente_id;
    folderContext = `inicial/${fileName}`;
  }

  const docType = detectDocumentType(fileName, folderContext);
  result.documentType = docType;

  const fileData = await downloadFileFromDrive(fileId);
  if (!fileData) {
    result.skipped = true;
    result.skipReason = "Arquivo muito grande para leitura automática";
    return result;
  }

  const extracted = await extractWithClaude(fileData.content, fileData.mimeType, docType, fileName);

  if (result.processId) {
    if (docType === "contrato_honorarios" || docType === "documento_inicial") {
      const processFields: ExtractedProcessFields = {
        numero_cnj: extracted.numero_cnj,
        tipo_acao: extracted.tipo_acao,
        parte_contraria: extracted.parte_contraria,
        vara_comarca: extracted.vara_comarca,
        data_protocolo: extracted.data_protocolo,
        modelo_cobranca: extracted.modelo_cobranca,
        valor_entrada: extracted.valor_entrada,
        percentual_exito: extracted.percentual_exito
      };
      await updateProcessFields(result.processId, processFields);
      result.fieldsExtracted = Object.keys(processFields).filter(
        (k) => processFields[k as keyof ExtractedProcessFields]
      );
    }
    return result;
  }

  if (!clientFolderId) {
    result.skipped = true;
    result.skipReason = "Não foi possível determinar a pasta do cliente";
    return result;
  }

  let clientId =
    (await findClientByDriveFolderId(clientFolderId)) ??
    (await findClientByFolderName(clientFolderId));

  if (!clientId) {
    const folderName = await getFolderName(clientFolderId);
    const parentOfClient = await getParentFolderId(clientFolderId);
    const dbStatus = parentOfClient ? statusMap[parentOfClient] : null;

    if (!dbStatus) {
      result.skipped = true;
      result.skipReason = "Pasta do cliente não está dentro de uma pasta de status conhecida";
      return result;
    }

    const displayName =
      extracted.nome ||
      extracted.nome_cliente ||
      (folderName ? folderNameToDisplayName(folderName) : null);

    if (!displayName) {
      result.skipped = true;
      result.skipReason = "Não foi possível determinar o nome do cliente";
      return result;
    }

    const safe = sanitizeClientFields({
      cpf_cnpj: extracted.cpf_cnpj,
      rg_ie: extracted.rg_ie,
      data_nascimento_abertura: extracted.data_nascimento_abertura,
      estado_civil: extracted.estado_civil,
      endereco: extracted.endereco,
      nome_fantasia: extracted.nome_fantasia,
      telefone: extracted.telefone,
      email: extracted.email
    });

    const newId = crypto.randomUUID();
    const { error } = await getSupabaseClient().from("clientes").insert({
      id: newId,
      nome: displayName,
      tipo: "PF",
      status: dbStatus,
      cpf_cnpj: safe.cpf_cnpj ?? "",
      rg_ie: safe.rg_ie ?? "",
      data_nascimento_abertura: safe.data_nascimento_abertura ?? null,
      estado_civil: safe.estado_civil ?? null,
      endereco: safe.endereco ?? null,
      nome_fantasia: safe.nome_fantasia ?? null,
      telefone: safe.telefone ?? null,
      email: safe.email ?? null,
      data_cadastro: new Date().toISOString().slice(0, 10),
      drive_folder_id: clientFolderId
    });

    if (error) {
      console.error("[AIReader] Erro ao criar cliente:", error);
      result.skipped = true;
      result.skipReason = `Erro ao criar cliente: ${error.message}`;
      return result;
    }

    clientId = newId;
    result.fieldsExtracted = [
      "nome", "status", "drive_folder_id",
      ...(extracted.cpf_cnpj ? ["cpf_cnpj"] : []),
      ...(extracted.rg_ie ? ["rg_ie"] : []),
      ...(extracted.data_nascimento_abertura ? ["data_nascimento_abertura"] : []),
      ...(extracted.estado_civil ? ["estado_civil"] : []),
      ...(extracted.endereco ? ["endereco"] : []),
      ...(extracted.telefone ? ["telefone"] : []),
      ...(extracted.email ? ["email"] : [])
    ];
  } else {
    const clientFields: ExtractedClientFields = {
      nome: extracted.nome || extracted.nome_cliente,
      cpf_cnpj: extracted.cpf_cnpj,
      rg_ie: extracted.rg_ie,
      data_nascimento_abertura: extracted.data_nascimento_abertura,
      estado_civil: extracted.estado_civil,
      endereco: extracted.endereco,
      nome_fantasia: extracted.nome_fantasia,
      telefone: extracted.telefone,
      email: extracted.email
    };
    await updateClientFields(clientId, clientFields);
    result.fieldsExtracted = Object.keys(clientFields).filter(
      (k) => clientFields[k as keyof ExtractedClientFields]
    );

    // Arquivo solto na pasta do cliente com dados de processo → cria/atualiza processo
    if (docType === "documento_inicial" || docType === "contrato_honorarios") {
      const processId = await ensureProcessoFromClienteFile(clientId, extracted, docType);
      if (processId) {
        result.processId = processId;
        const processFieldNames = ["numero_cnj", "tipo_acao", "parte_contraria", "vara_comarca", "data_protocolo", "modelo_cobranca", "valor_entrada", "percentual_exito"];
        result.fieldsExtracted = [
          ...result.fieldsExtracted,
          ...processFieldNames.filter((k) => extracted[k])
        ];
      }
    }
  }

  result.clientId = clientId;
  return result;
}

const CNJ_REGEX = /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/;

function parseCnj(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const cleaned = raw.trim();
  return CNJ_REGEX.test(cleaned) ? cleaned : undefined;
}

async function ensureProcessoFromClienteFile(
  clienteId: string,
  extracted: Record<string, string>,
  docType: DocumentType
): Promise<string | null> {
  const numeroCnj = parseCnj(extracted.numero_cnj);
  const tipoAcao = extracted.tipo_acao;
  const modeloCobranca = extracted.modelo_cobranca;

  const supabase = getSupabaseClient();
  const fields: ExtractedProcessFields = {
    numero_cnj: numeroCnj,
    tipo_acao: tipoAcao,
    parte_contraria: extracted.parte_contraria,
    vara_comarca: extracted.vara_comarca,
    data_protocolo: extracted.data_protocolo,
    modelo_cobranca: modeloCobranca,
    valor_entrada: extracted.valor_entrada,
    percentual_exito: extracted.percentual_exito
  };

  // 1. Se tem CNJ, procura processo existente por número
  if (numeroCnj) {
    const { data: byCnj } = await supabase
      .from("processos")
      .select("id")
      .eq("cliente_id", clienteId)
      .eq("numero_cnj", numeroCnj)
      .maybeSingle();

    if (byCnj?.id) {
      await updateProcessFields(byCnj.id, fields);
      return byCnj.id;
    }
  }

  // 2. Sem CNJ: procura processo existente para atualizar
  //    (prefere um sem cobrança; senão pega qualquer um)
  const { data: semCobranca } = await supabase
    .from("processos")
    .select("id")
    .eq("cliente_id", clienteId)
    .is("modelo_cobranca", null)
    .limit(1)
    .maybeSingle();

  const { data: qualquer } = semCobranca?.id
    ? { data: semCobranca }
    : await supabase.from("processos").select("id").eq("cliente_id", clienteId).limit(1).maybeSingle();

  if (qualquer?.id) {
    await updateProcessFields(qualquer.id, fields);
    return qualquer.id;
  }

  // 3. Nenhum processo existente.
  //    Contrato de honorários sozinho não cria processo — espera a inicial.
  //    Petição inicial cria processo mesmo sem CNJ.
  if (docType !== "documento_inicial") return null;

  const safeProc = sanitizeProcessFields(fields);
  const newId = crypto.randomUUID();
  const { error } = await supabase.from("processos").insert({
    id: newId,
    cliente_id: clienteId,
    numero_cnj: numeroCnj ?? "A definir",
    tipo_acao: safeProc.tipo_acao ?? null,
    parte_contraria: safeProc.parte_contraria ?? null,
    vara_comarca: safeProc.vara_comarca ?? null,
    data_protocolo: safeProc.data_protocolo ?? null,
    modelo_cobranca: safeProc.modelo_cobranca ?? null,
    valor_entrada: safeProc.valor_entrada
      ? Number(safeProc.valor_entrada.replace(/[^\d,]/g, "").replace(",", ".")) || null
      : null,
    percentual_exito: safeProc.percentual_exito
      ? Number(safeProc.percentual_exito) || null
      : null,
    status: "ativo"
  });

  if (error) {
    console.error("[AIReader] Erro ao criar processo a partir de arquivo solto:", error);
    return null;
  }

  // Cria pasta no Drive (inicial/ + peticoes_subsequentes/) se o cliente já tiver pasta
  try {
    const { data: clienteRow } = await supabase
      .from("clientes")
      .select("drive_folder_id, drive_path, nome")
      .eq("id", clienteId)
      .single();

    if (clienteRow?.drive_folder_id) {
      const { criarPastaProcesso } = await import("@/services/google-drive");
      const fakeClient = {
        id: clienteId,
        driveFolderId: clienteRow.drive_folder_id,
        driveFolder: clienteRow.drive_path ?? "",
        legalName: clienteRow.nome,
        name: clienteRow.nome
      } as import("@/lib/types").Client;

      const fakeProcess = {
        id: newId,
        number: numeroCnj ?? "A definir",
        actionType: safeProc.tipo_acao ?? ""
      } as import("@/lib/types").LegalProcess;

      const driveResult = await criarPastaProcesso(fakeClient, fakeProcess);
      await supabase.from("processos").update({
        drive_folder_id: driveResult.driveFolderId,
        drive_path: driveResult.drivePath
      }).eq("id", newId);
    }
  } catch (driveErr) {
    console.error("[AIReader] Pasta do processo não criada no Drive:", driveErr);
    // Não bloqueia — processo continua salvo sem pasta Drive
  }

  return newId;
}
