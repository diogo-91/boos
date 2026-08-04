import { GoogleGenAI } from "@google/genai";
import mammoth from "mammoth";
import { getGoogleDriveClient, getGoogleDriveRootFolderId } from "@/lib/google/drive";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import {
  FOLDER_MIME,
  STATUS_FOLDER_TO_DB_MAP,
  folderNameToDisplayName,
  matchStatusFolderKey
} from "@/lib/drive-status-map";
import { normalizeDocument, isValidCpfCnpj } from "@/lib/validation";
import { hojeLocalISO } from "@/lib/date-utils";
import { parseMoneyToNumber } from "@/services/mappers";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const GEMINI_MODEL = "gemini-3.5-flash";

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
  localizacao?: string;
  data_protocolo?: string;
  data_encerramento?: string;
  modelo_cobranca?: string;
  valor_entrada?: string;
  percentual_exito?: string;
};

// Mesmas opções do <SelectInput> de "Localização do Processo" no formulário
// (components/forms/ProcessFormModal.tsx) — só aceita um valor exato, senão
// o formulário abriria com esse campo mostrando "—" mesmo tendo um valor
// salvo no banco que não bate com nenhuma das opções do <select>.
const LOCATION_OPTIONS = new Set(["Projudi", "Eproc PR", "Eproc SP", "Outro"]);

export type DocumentType =
  | "documento_pessoal"
  | "procuracao"
  | "contrato_honorarios"
  | "documento_inicial"
  | "outro";

// Únicos tipos de documento cuja finalidade é justamente qualificar a
// pessoa — têm prioridade pra corrigir/preencher os campos de qualificação
// do cliente. Qualquer outro tipo só preenche o que ainda está vazio (ver
// uso em readDriveFile).
const PRIORITY_ID_DOCS = new Set<DocumentType>(["procuracao", "documento_pessoal"]);
const QUALIFICATION_FIELDS = ["nome", "estado_civil", "endereco", "rg_ie", "data_nascimento_abertura"] as const;

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
  const { data: meta } = await drive.files.get({
    fileId,
    fields: "mimeType,name,size",
    supportsAllDrives: true
  });
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
    const res = await drive.files.get({ fileId, alt: "media", supportsAllDrives: true }, { responseType: "arraybuffer" });
    return { content: Buffer.from(res.data as ArrayBuffer).toString("base64"), mimeType };
  }

  // Tudo o mais: tenta extrair texto do binário
  if (meta.size && Number(meta.size) > 20 * 1024 * 1024) return null;
  const res = await drive.files.get({ fileId, alt: "media", supportsAllDrives: true }, { responseType: "arraybuffer" });
  const buffer = Buffer.from(res.data as ArrayBuffer);
  const text = await extractTextFromBuffer(buffer, mimeType);
  if (!text) return null;
  return { content: Buffer.from(text).toString("base64"), mimeType: "text/plain" };
}

// Acha o primeiro objeto JSON balanceado a partir do primeiro "{" no texto,
// contando profundidade de chaves e ignorando as que estão dentro de
// strings (senão um endereço ou citação com "{"/"}" literal quebraria a
// contagem). Se o texto termina com a raiz ainda aberta em 1 nível — caso
// visto do Gemini reportando finishReason "STOP" mas esquecendo o "}"
// final — fecha ela, já que o schema usado aqui é sempre plano (chave→
// string, sem objeto/array aninhado).
function extractBalancedJson(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  if (depth === 1 && !inString) {
    return text.slice(start).replace(/,\s*$/, "") + "}";
  }
  return null;
}

async function extractDocumentFields(
  base64Content: string,
  mimeType: string,
  documentType: DocumentType,
  fileName: string
): Promise<Record<string, string>> {
  // Sem isso, a IA tendia a escanear só a primeira ocorrência óbvia de cada
  // campo e ignorar variações de redação — ex: estado civil escrito como
  // "casada com Fulano" na qualificação das partes, em vez de num campo
  // isolado "Estado civil: Casado", saía como null mesmo estando no texto.
  const THOROUGHNESS_INSTRUCTION = `REGRA DE LEITURA: Leia o documento INTEIRO com atenção antes de responder — não pule páginas, rodapés, cabeçalhos, assinaturas ou trechos de letra pequena. Dados como estado civil, endereço, RG, CPF e telefone costumam aparecer dentro da qualificação das partes (geralmente um parágrafo corrido logo após o nome, não um campo isolado com rótulo) e podem estar redigidos de formas diferentes — por exemplo, estado civil pode aparecer como "casado(a)", "casada com [nome]", "convivente em união estável", "solteiro(a)", "viúvo(a) de [nome]", sem a palavra exata do rótulo do campo. Antes de retornar null para qualquer campo, releia mentalmente o documento procurando especificamente por esse dado sob essas variações. Só retorne null se, depois dessa checagem cuidadosa, o dado realmente não constar em lugar nenhum do documento.`;

  const NULL_INSTRUCTION = `REGRA OBRIGATÓRIA: Para qualquer campo não encontrado claramente no documento, retorne null. NUNCA retorne strings como "não informado", "não disponível", "N/A", "não identificado", "desconhecido", "-" ou qualquer texto que indique ausência de dado. Se não encontrou, retorne null.`;

  // Documentos de propriedade (IPTU, matrícula etc.) costumam registrar o
  // imóvel em nome de "FULANA E SEU MARIDO" — sem esta regra a IA copiava
  // essa frase literal pro campo "nome", e como cada documento novo
  // sobrescreve o nome do cliente já cadastrado, um IPTU processado por
  // último acabava sujando o nome de um cadastro que já estava correto.
  const NAME_INSTRUCTION = `REGRA PARA NOME: Se o documento mencionar o titular junto com cônjuge ou terceiros (ex: "FULANA E SEU MARIDO", "FULANO E SUA ESPOSA", "FULANA E OUTROS"), retorne no campo de nome apenas o nome da pessoa titular do documento/pasta em análise — nunca inclua cônjuge, marido, esposa ou terceiros junto no mesmo campo.`;

  // A procuração normalmente traz a qualificação completa da parte (nome,
  // estado civil, endereço, RG) redigida pelo próprio advogado — é a fonte
  // mais confiável dessas informações, mais do que um RG (que não tem
  // endereço/estado civil) ou um documento avulso como IPTU (que não é
  // sobre a pessoa, e sim sobre um imóvel). Só a IA lendo a procuração sabe
  // disso — o pipeline reforça essa prioridade não deixando doc tipo
  // "outro" sobrescrever campo já preenchido (ver PRIORITY_ID_DOCS abaixo).
  const PROCURACAO_PRIORITY_INSTRUCTION = `PRIORIDADE: Este documento é uma procuração — normalmente é a fonte mais completa e confiável da qualificação da parte (nome completo, estado civil, endereço, RG). Dedique atenção máxima a extrair esses campos de qualificação com precisão e completude, pois eles serão usados para preencher ou corrigir o cadastro do cliente.`;

  const prompts: Record<DocumentType, string> = {
    documento_pessoal: `Analise este documento (pode ser RG, CNH, CPF, cartão CNPJ ou contrato social).
Extraia e retorne APENAS um objeto JSON com os campos encontrados:
{
  "nome": "nome completo da pessoa ou razão social da empresa, ou null",
  "cpf_cnpj": "CPF no formato 000.000.000-00 ou CNPJ no formato 00.000.000/0000-00, ou null",
  "cpf_cnpj_citacao": "copie aqui, literalmente, o trecho exato do documento onde você leu esse CPF/CNPJ, ou null",
  "rg_ie": "número do RG ou Inscrição Estadual, ou null",
  "data_nascimento_abertura": "data no formato AAAA-MM-DD, ou null",
  "estado_civil": "estado civil se disponível (ex: Solteiro, Casado, Divorciado, Viúvo), ou null",
  "endereco": "endereço completo incluindo rua, número, bairro, cidade e estado, ou null",
  "telefone": "telefone com DDD no formato (00) 00000-0000, ou null",
  "nome_fantasia": "nome fantasia se for CNPJ, ou null"
}
${THOROUGHNESS_INSTRUCTION}
${NULL_INSTRUCTION}
${NAME_INSTRUCTION}
Retorne SOMENTE o JSON, sem texto adicional.`,

    procuracao: `Analise esta procuração.
Extraia e retorne APENAS um objeto JSON com os dados do OUTORGANTE (cliente que assinou):
{
  "nome": "nome completo do outorgante, ou null",
  "cpf_cnpj": "CPF do outorgante no formato 000.000.000-00, ou null",
  "cpf_cnpj_citacao": "copie aqui, literalmente, o trecho exato do documento onde você leu esse CPF, ou null",
  "rg_ie": "RG do outorgante, ou null",
  "estado_civil": "estado civil do outorgante (ex: Solteiro, Casado, Divorciado, Viúvo), ou null",
  "endereco": "endereço completo do outorgante, ou null",
  "telefone": "telefone do outorgante com DDD, ou null",
  "email": "e-mail do outorgante, ou null",
  "data_nascimento_abertura": "data de nascimento no formato AAAA-MM-DD, ou null"
}
${PROCURACAO_PRIORITY_INSTRUCTION}
${THOROUGHNESS_INSTRUCTION}
${NULL_INSTRUCTION}
${NAME_INSTRUCTION}
Retorne SOMENTE o JSON, sem texto adicional.`,

    contrato_honorarios: `Analise este contrato de honorários advocatícios.
Extraia e retorne APENAS um objeto JSON:
{
  "modelo_cobranca": "um de: Indefinido / Entrada / Êxito / Entrada + Êxito / Recorrente, ou null",
  "valor_entrada": "valor de entrada em formato R$ 0.000,00, ou null",
  "percentual_exito": "porcentagem de êxito como número apenas (ex: 20), ou null",
  "nome_cliente": "nome completo do cliente contratante, ou null",
  "cpf_cnpj": "CPF/CNPJ do cliente, ou null",
  "cpf_cnpj_citacao": "copie aqui, literalmente, o trecho exato do documento onde você leu esse CPF/CNPJ, ou null",
  "telefone": "telefone do cliente com DDD, ou null",
  "email": "e-mail do cliente, ou null",
  "endereco": "endereço completo do cliente, ou null"
}
${THOROUGHNESS_INSTRUCTION}
${NULL_INSTRUCTION}
${NAME_INSTRUCTION}
Retorne SOMENTE o JSON, sem texto adicional.`,

    documento_inicial: `Analise este documento de petição inicial ou protocolo processual.
Extraia e retorne APENAS um objeto JSON:
{
  "numero_cnj": "número do processo EXATAMENTE no formato CNJ: 0000000-00.0000.0.00.0000 — se não encontrar esse padrão exato, retorne null",
  "tipo_acao": "tipo/natureza da ação (ex: Acidente de trabalho, Indenização por danos morais), ou null",
  "parte_contraria": "nome da parte contrária (réu/reclamado), ou null",
  "vara_comarca": "vara e comarca onde tramita, ou null",
  "localizacao": "sistema eletrônico onde o processo tramita — EXATAMENTE um de: Projudi / Eproc PR / Eproc SP / Outro, ou null se não conseguir identificar com certeza",
  "data_protocolo": "data do protocolo no formato AAAA-MM-DD, ou null",
  "data_encerramento": "data de encerramento/arquivamento do processo, se este documento indicar que o processo já foi encerrado, no formato AAAA-MM-DD, ou null",
  "nome": "nome completo do autor/cliente, ou null",
  "cpf_cnpj": "CPF do autor/cliente, ou null",
  "cpf_cnpj_citacao": "copie aqui, literalmente, o trecho exato do documento onde você leu esse CPF, ou null",
  "telefone": "telefone do autor/cliente com DDD, ou null",
  "email": "e-mail do autor/cliente, ou null",
  "endereco": "endereço completo do autor/cliente, ou null"
}
${THOROUGHNESS_INSTRUCTION}
${NULL_INSTRUCTION}
${NAME_INSTRUCTION}
Retorne SOMENTE o JSON, sem texto adicional.`,

    // Cobre qualquer peça processual avulsa que não seja procuração,
    // documento pessoal, petição inicial nem contrato de honorários —
    // contrarrazões, cumprimento de sentença, impugnação, expedição de
    // RPV, resposta a impugnação, declaração de hipossuficiência etc. Pede
    // TODOS os campos que o sistema sabe guardar (não só numero_cnj/nome/
    // cpf), porque qualquer uma dessas peças pode citar número do processo,
    // parte contrária, vara/comarca ou valores — sem isso essas peças
    // caíam aqui e nada delas era aproveitado.
    outro: `Analise este documento jurídico e extraia qualquer informação relevante sobre o cliente ou processo.
Retorne APENAS um objeto JSON com os campos que conseguir identificar com certeza:
{
  "numero_cnj": "número do processo EXATAMENTE no formato CNJ: 0000000-00.0000.0.00.0000 — se não encontrar esse padrão exato, retorne null",
  "tipo_acao": "tipo/natureza da ação (ex: Acidente de trabalho, Indenização por danos morais), ou null",
  "parte_contraria": "nome da parte contrária (réu/reclamado), ou null",
  "vara_comarca": "vara e comarca onde tramita, ou null",
  "localizacao": "sistema eletrônico onde o processo tramita — EXATAMENTE um de: Projudi / Eproc PR / Eproc SP / Outro, ou null se não conseguir identificar com certeza",
  "data_protocolo": "data de protocolo/distribuição citada no documento, no formato AAAA-MM-DD, ou null",
  "data_encerramento": "data de encerramento/arquivamento do processo, se este documento indicar isso (ex: sentença transitada em julgado, cumprimento de sentença quitado, acordo homologado), no formato AAAA-MM-DD, ou null",
  "modelo_cobranca": "um de: Indefinido / Entrada / Êxito / Entrada + Êxito / Recorrente, ou null",
  "valor_entrada": "valor de entrada em formato R$ 0.000,00, ou null",
  "percentual_exito": "porcentagem de êxito como número apenas (ex: 20), ou null",
  "nome": "nome do cliente, ou null",
  "cpf_cnpj": "CPF/CNPJ, ou null",
  "cpf_cnpj_citacao": "copie aqui, literalmente, o trecho exato do documento onde você leu esse CPF/CNPJ, ou null",
  "rg_ie": "número do RG ou Inscrição Estadual, ou null",
  "estado_civil": "estado civil se disponível (ex: Solteiro, Casado, Divorciado, Viúvo), ou null",
  "endereco": "endereço completo, ou null",
  "telefone": "telefone com DDD, ou null",
  "email": "e-mail, ou null"
}
${THOROUGHNESS_INSTRUCTION}
${NULL_INSTRUCTION}
${NAME_INSTRUCTION}
Retorne SOMENTE o JSON, sem texto adicional.`
  };

  const isImage = mimeType.startsWith("image/");
  const isPdf = mimeType === "application/pdf";
  const isText = mimeType.startsWith("text/") || mimeType === "text/plain";

  if (!isImage && !isPdf && !isText) return {};

  // Para texto puro (extraído de .docx via mammoth), manda como texto direto.
  // Imagem/PDF vão como inlineData nativo — o Gemini lê os dois formatos
  // pelo mesmo mecanismo, ao contrário do Claude que separava image/document.
  const parts = isText
    ? [{ text: `Arquivo: ${fileName}\n\nConteúdo do documento:\n${Buffer.from(base64Content, "base64").toString("utf-8")}\n\n${prompts[documentType]}` }]
    : [
        { inlineData: { mimeType, data: base64Content } },
        { text: `Arquivo: ${fileName}\n\n${prompts[documentType]}` }
      ];

  const response = await genAI.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: "user", parts }],
    config: {
      // gemini-3.5-flash aceita desligar o "pensamento" (thinkingBudget 0)
      // — modelos "pro" (gemini-pro-latest) REJEITAM esse valor com erro
      // ("This model only works in thinking mode"), então se o modelo for
      // trocado de volta pra um "pro", remova esta linha. Sem desligar,
      // os tokens de raciocínio saem do mesmo orçamento de maxOutputTokens
      // e cortavam o JSON antes de fechar em documentos mais complexos
      // (ver histórico de commits) — desligado, o orçamento inteiro vira
      // JSON de verdade, mais rápido e mais barato também.
      thinkingConfig: { thinkingBudget: 0 },
      maxOutputTokens: 8192,
      // Modo JSON estruturado do Gemini — o modelo é forçado a responder só
      // com JSON válido, o que já elimina boa parte dos casos de resposta em
      // prosa/truncada que o regex abaixo existia pra pegar com o Claude.
      responseMimeType: "application/json"
    }
  });

  const text = response.text ?? "";

  // Extrai o primeiro objeto JSON balanceado a partir do primeiro "{",
  // respeitando strings (chave dentro de um valor de texto não conta).
  // O Gemini às vezes reporta finishReason "STOP" (não é corte por limite
  // de tokens — candidatesTokenCount fica bem abaixo do maxOutputTokens)
  // mas esquece de fechar o "}" final mesmo em modo JSON estruturado; e
  // às vezes deixa sobrar texto depois do objeto. Uma regex gulosa
  // (/\{[\s\S]*\}/) tanto falhava no primeiro caso quanto podia incluir
  // lixo do segundo — contar profundidade de chaves resolve os dois.
  const jsonCandidate = extractBalancedJson(text);

  // Resposta truncada de verdade, em prosa, ou recusa do modelo — antes
  // virava {} silenciosamente e o arquivo era marcado como processado pra
  // sempre, sem nenhum sinal em lugar nenhum. Lançar aqui deixa o chamador
  // decidir não marcar o arquivo como lido, pra tentar de novo na próxima
  // varredura.
  if (!jsonCandidate) {
    throw new Error(`Resposta da IA sem JSON reconhecível: "${text.slice(0, 200)}"`);
  }

  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(jsonCandidate) as Record<string, string>;
  } catch (err) {
    throw new Error(`JSON retornado pela IA é inválido: ${err instanceof Error ? err.message : String(err)}`);
  }

  // A IA pode "alucinar" um CPF/CNPJ que passa no dígito verificador (ver
  // lib/validation.ts) mas não existe de fato no documento. Pra texto puro
  // (já extraído localmente antes de chegar aqui), confirma contra o
  // próprio texto — garantia real. Pra imagem/PDF (vão nativos pra IA, sem
  // texto local nenhum, sem OCR no pipeline) não tem como provar de forma
  // independente; em vez disso exige que a IA cite o trecho onde leu, e
  // confere se os dígitos batem — reduz alucinação silenciosa, não é prova.
  if (parsed.cpf_cnpj) {
    const verified = isText
      ? verifyCpfCnpjInText(parsed.cpf_cnpj, Buffer.from(base64Content, "base64").toString("utf-8"))
      : verifyCpfCnpjCitation(parsed.cpf_cnpj, parsed.cpf_cnpj_citacao);

    if (!verified) delete parsed.cpf_cnpj;
  }
  delete parsed.cpf_cnpj_citacao;

  return parsed;
}

function findCpfCnpjCandidates(text: string): Set<string> {
  const matches = text.match(/\d[\d.\-/]{8,18}\d/g) ?? [];
  const result = new Set<string>();
  for (const m of matches) {
    const digits = m.replace(/\D/g, "");
    if (digits.length === 11 || digits.length === 14) result.add(digits);
  }
  return result;
}

function verifyCpfCnpjInText(candidate: string, rawText: string): boolean {
  const digits = candidate.replace(/\D/g, "");
  return digits.length > 0 && findCpfCnpjCandidates(rawText).has(digits);
}

function verifyCpfCnpjCitation(candidate: string, citation: string | undefined): boolean {
  const digits = candidate.replace(/\D/g, "");
  const citationDigits = (citation ?? "").replace(/\D/g, "");
  return digits.length > 0 && digits === citationDigits;
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

  // CPF/CNPJ: guarda só os dígitos, sem pontuação, para bater com
  // qualquer outro cadastro do mesmo documento independente de formatação.
  // Valida o dígito verificador — a IA pode ler um número errado do
  // documento, e sem essa checagem ele ia direto pro banco (e podia colidir
  // por acaso com o CPF de outra pessoa, disparando o merge do A5).
  if (key === "cpf_cnpj") {
    const digits = normalizeDocument(v);
    return digits && isValidCpfCnpj(digits) ? digits : null;
  }

  // Só aceita um dos valores exatos do <select> — qualquer outra coisa
  // (variação de escrita, sigla diferente) fica de fora em vez de gravar
  // um valor que o formulário não sabe mostrar.
  if (key === "localizacao") {
    return LOCATION_OPTIONS.has(v) ? v : null;
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

  const { error } = await getSupabaseServiceClient().from("clientes").update(updateData).eq("id", clientId);
  if (error) throw new Error(`Supabase clientes update: ${error.message} (${error.code}) — dados: ${JSON.stringify(updateData)}`);
}

async function updateProcessFields(processId: string, fields: ExtractedProcessFields) {
  const sanitized = sanitizeProcessFields(fields);
  const updateData: Record<string, unknown> = { ...sanitized };

  // sanitizeValue devolve valor_entrada como string formatada ("R$ 1.000,00")
  // — igual ao que a IA extraiu. O caminho de criação de processo já
  // converte pra número antes de gravar; esse update ia direto pra uma
  // coluna numeric com a string crua, e Postgres rejeitava a query inteira
  // sempre que um contrato de honorários chegava vinculado a um processo já
  // existente.
  if (sanitized.valor_entrada !== undefined) {
    updateData.valor_entrada = parseMoneyToNumber(sanitized.valor_entrada);
  }

  if (Object.keys(updateData).length === 0) return;

  const { error } = await getSupabaseServiceClient().from("processos").update(updateData).eq("id", processId);
  if (error) throw new Error(`Supabase processos update: ${error.message} (${error.code}) — dados: ${JSON.stringify(updateData)}`);
}

async function findClientByDriveFolderId(folderId: string) {
  const { data } = await getSupabaseServiceClient()
    .from("clientes")
    .select("id")
    .eq("drive_folder_id", folderId)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function getFolderName(folderId: string): Promise<string | null> {
  const drive = getGoogleDriveClient();
  const { data } = await drive.files.get({
    fileId: folderId,
    fields: "name",
    supportsAllDrives: true
  });
  return data.name ?? null;
}

type FolderNameMatch = { clientId: string | null; ambiguous: boolean };

async function findClientByFolderName(folderId: string): Promise<FolderNameMatch> {
  const folderName = await getFolderName(folderId);
  if (!folderName) return { clientId: null, ambiguous: false };

  const displayName = folderNameToDisplayName(folderName);

  // Só nome exato (ignorando maiúsculas/minúsculas). Um match por aproximação
  // de "contém o primeiro e o último nome" já existiu aqui e vinculou clientes
  // errados a pastas de outras pessoas — com nomes curtos ou comuns, o
  // trecho bate em qualquer um. Não vale o risco.
  const { data: found } = await getSupabaseServiceClient()
    .from("clientes")
    .select("id,drive_folder_id")
    .ilike("nome", displayName);

  const candidates = found ?? [];

  // Mais de um cliente cadastrado com o mesmo nome (homônimos reais) — não dá
  // pra saber qual pasta pertence a qual sem ambiguidade. Melhor não vincular
  // ninguém do que vincular a pasta de uma pessoa ao cadastro de outra.
  if (candidates.length > 1) {
    return { clientId: null, ambiguous: true };
  }

  const match = candidates[0];

  // Esta função só roda quando findClientByDriveFolderId(folderId) já não
  // achou ninguém pra ESTA pasta — então, se o cliente achado por nome já
  // tem uma pasta vinculada, ela necessariamente é OUTRA pasta. Não é o
  // caso de "pasta recriada" pro mesmo cliente — é homônimo, pessoa
  // diferente. Trata como ambíguo: não vincula, não sobrescreve nada.
  if (match?.drive_folder_id) {
    return { clientId: null, ambiguous: true };
  }

  if (match?.id) {
    await getSupabaseServiceClient()
      .from("clientes")
      .update({ drive_folder_id: folderId })
      .eq("id", match.id);
  }

  return { clientId: match?.id ?? null, ambiguous: false };
}

async function findClientByCpfCnpj(
  cpfCnpj: string | undefined
): Promise<{ id: string; driveFolderId: string | null } | null> {
  if (!cpfCnpj) return null;
  const { data } = await getSupabaseServiceClient()
    .from("clientes")
    .select("id,drive_folder_id")
    .eq("cpf_cnpj", cpfCnpj)
    .limit(1)
    .maybeSingle();
  return data ? { id: data.id, driveFolderId: data.drive_folder_id ?? null } : null;
}

async function findProcessByDriveFolderId(folderId: string) {
  const { data } = await getSupabaseServiceClient()
    .from("processos")
    .select("id,cliente_id")
    .eq("drive_folder_id", folderId)
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

async function getParentFolderId(folderId: string): Promise<string | null> {
  const drive = getGoogleDriveClient();
  const { data } = await drive.files.get({
    fileId: folderId,
    fields: "parents",
    supportsAllDrives: true
  });
  return data.parents?.[0] ?? null;
}

async function getFileModifiedTime(fileId: string): Promise<string | null> {
  const drive = getGoogleDriveClient();
  const { data } = await drive.files.get({
    fileId,
    fields: "modifiedTime",
    supportsAllDrives: true
  });
  return data.modifiedTime ?? null;
}

async function getProcessedFileModifiedTime(fileId: string): Promise<string | null> {
  const { data } = await getSupabaseServiceClient()
    .from("documentos_processados")
    .select("modified_time")
    .eq("file_id", fileId)
    .maybeSingle();
  return data?.modified_time ?? null;
}

async function markFileProcessed(fileId: string, modifiedTime: string | null): Promise<void> {
  const { error } = await getSupabaseServiceClient()
    .from("documentos_processados")
    .upsert({ file_id: fileId, modified_time: modifiedTime, processed_at: new Date().toISOString() });

  if (error) throw error;
}

// markFileProcessed já roda logo após a leitura por IA, antes de sabermos se
// o vínculo com cliente/processo vai dar certo — de propósito, pra uma falha
// transitória de gravação no banco não forçar reler o arquivo com IA de novo
// (custo). Mas pra pulos que só um humano resolve (homônimo ambíguo, CPF que
// bate com o de outro contexto, pasta sem estrutura reconhecida), isso deixa
// o arquivo travado pra sempre: ele só seria relido se o modifiedTime no
// Drive mudasse, o que normalmente não acontece. Essas chamadas desfazem a
// marca nesses casos específicos, pra a próxima varredura tentar de novo.
async function unmarkFileProcessed(fileId: string): Promise<void> {
  const { error } = await getSupabaseServiceClient()
    .from("documentos_processados")
    .delete()
    .eq("file_id", fileId);

  if (error) console.error("[AIReader] Falha ao desfazer marca de processado:", error);
}

async function getStatusFolderMap(): Promise<Record<string, string>> {
  const drive = getGoogleDriveClient();
  const { data } = await drive.files.list({
    q: `'${getGoogleDriveRootFolderId()}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`,
    fields: "files(id,name)",
    pageSize: 30,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true
  });

  const map: Record<string, string> = {};
  for (const f of data.files ?? []) {
    if (!f.id || !f.name) continue;
    const key = matchStatusFolderKey(f.name);
    if (key) map[f.id] = STATUS_FOLDER_TO_DB_MAP[key];
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

export type ProgressStep = "context" | "download" | "ai" | "match" | "save";
export type ProgressStatus = "active" | "done" | "skip" | "error";
export type ProgressEmitter = (step: ProgressStep, status: ProgressStatus, message?: string) => void;

export async function readDriveFile(
  fileId: string,
  fileName: string,
  parentFolderId: string,
  emit: ProgressEmitter = () => {}
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

  emit("context", "active", "Identificando pasta e tipo de documento");

  const modifiedTime = await getFileModifiedTime(fileId);
  const processedModifiedTime = await getProcessedFileModifiedTime(fileId);
  if (
    processedModifiedTime &&
    modifiedTime &&
    new Date(processedModifiedTime).getTime() === new Date(modifiedTime).getTime()
  ) {
    result.skipped = true;
    result.skipReason = "Arquivo já processado, sem alterações desde a última leitura";
    emit("context", "skip", result.skipReason);
    return result;
  }

  // Nunca confia cegamente no parentFolderId que o chamador informa — sem
  // isso, qualquer usuário autenticado podia mandar um fileId arbitrário
  // (qualquer arquivo que a service account alcance) junto com o
  // parentFolderId de um cliente real, e o conteúdo lido pela IA seria
  // atribuído a esse cliente mesmo o arquivo não sendo dele de verdade.
  // Busca o parent real no Drive e ignora o valor recebido.
  const realParentId = await getParentFolderId(fileId);
  if (!realParentId) {
    result.skipped = true;
    result.skipReason = "Não foi possível determinar a pasta do arquivo no Drive";
    emit("context", "skip", result.skipReason);
    return result;
  }
  parentFolderId = realParentId;

  const grandParentId = await getParentFolderId(parentFolderId);
  const statusMap = await getStatusFolderMap();

  let clientFolderId: string | null = null;
  let folderContext = fileName;

  if (statusMap[parentFolderId]) {
    result.skipped = true;
    result.skipReason = "Arquivo na pasta de status, não dentro de um cliente";
    emit("context", "skip", result.skipReason);
    return result;
  }

  // Arquivo direto na raiz da pasta do processo, ou dentro de uma subpasta
  // dela (inicial/, peticoes_subsequentes/, ou qualquer outra criada
  // manualmente). Usa o nome real da subpasta em vez de assumir "inicial"
  // pra tudo — senão uma petição subsequente é classificada como documento
  // inicial e dispara a lógica de criação/atualização de processo por CNJ
  // pro tipo errado.
  const processFromParent = await findProcessByDriveFolderId(parentFolderId);
  const processFromGrandparent =
    !processFromParent && grandParentId ? await findProcessByDriveFolderId(grandParentId) : null;
  const processRecord = processFromParent ?? processFromGrandparent;

  if (processRecord) {
    result.processId = processRecord.id;
    result.clientId = processRecord.cliente_id;
    folderContext = processFromParent
      ? fileName
      : `${(await getFolderName(parentFolderId)) ?? "processo"}/${fileName}`;
  } else if (grandParentId && statusMap[grandParentId]) {
    clientFolderId = parentFolderId;
  } else if (grandParentId) {
    clientFolderId = grandParentId;
    // Nome real da subpasta do cliente (documentos_pessoais, comunicacao, ou
    // qualquer outra) em vez de assumir sempre "documentos_pessoais".
    const realSubfolderName = (await getFolderName(parentFolderId)) ?? "documentos_pessoais";
    folderContext = `${realSubfolderName}/${fileName}`;
  }

  // Nem processo nem pasta de cliente reconhecidos — não gasta download nem
  // chamada de IA (custo real) num arquivo fora da estrutura gerenciada
  // pelo app. Checar isso só depois da IA rodar, como era antes, permitia
  // qualquer usuário autenticado forçar leitura por IA de arquivo arbitrário.
  if (!processRecord && !clientFolderId) {
    result.skipped = true;
    result.skipReason = "Não foi possível determinar a pasta do cliente";
    emit("context", "skip", result.skipReason);
    return result;
  }

  const docType = detectDocumentType(fileName, folderContext);
  result.documentType = docType;
  emit("context", "done", `Tipo detectado: ${docType}`);

  emit("download", "active", "Baixando conteúdo do arquivo");
  const fileData = await downloadFileFromDrive(fileId);
  if (!fileData) {
    result.skipped = true;
    result.skipReason = "Arquivo muito grande para leitura automática";
    emit("download", "skip", result.skipReason);
    await markFileProcessed(fileId, modifiedTime);
    return result;
  }
  emit("download", "done");

  emit("ai", "active", "Lendo documento com IA");
  let extracted: Record<string, string>;
  try {
    extracted = await extractDocumentFields(fileData.content, fileData.mimeType, docType, fileName);
  } catch (err) {
    // Não marca como processado — markFileProcessed só roda depois deste
    // ponto, então uma falha aqui já sai sem marcar nada, e a próxima
    // varredura tenta ler o arquivo de novo.
    result.skipped = true;
    result.skipReason = `Falha ao ler resposta da IA: ${err instanceof Error ? err.message : String(err)}`;
    emit("ai", "error", result.skipReason);
    return result;
  }
  emit("ai", "done", `${Object.keys(extracted).length} campo(s) identificado(s)`);

  // Não deixa uma falha aqui abortar o salvamento dos dados extraídos abaixo —
  // a marca de "já lido" é só controle interno, o dado extraído é o que importa.
  try {
    await markFileProcessed(fileId, modifiedTime);
  } catch (err) {
    console.error("[AIReader] Falha ao marcar arquivo como processado:", err);
  }

  if (result.processId) {
    emit("match", "done", "Processo já vinculado a esta pasta");
    emit("save", "active", "Salvando dados no processo");
    // Antes só rodava para contrato_honorarios/documento_inicial — qualquer
    // outra peça (contrarrazões, cumprimento de sentença, impugnação,
    // expedição de RPV etc.) caía como "outro" e era marcada como lida sem
    // salvar nada, mesmo tendo campos do processo no texto. updateProcessFields
    // já ignora campos vazios, então rodar sempre é seguro mesmo se a IA não
    // achar nenhum dado extra num documento_pessoal/procuração perdido aqui.
    const processFields: ExtractedProcessFields = {
      numero_cnj: extracted.numero_cnj,
      tipo_acao: extracted.tipo_acao,
      parte_contraria: extracted.parte_contraria,
      vara_comarca: extracted.vara_comarca,
      localizacao: extracted.localizacao,
      data_protocolo: extracted.data_protocolo,
      data_encerramento: extracted.data_encerramento,
      modelo_cobranca: extracted.modelo_cobranca,
      valor_entrada: extracted.valor_entrada,
      percentual_exito: extracted.percentual_exito
    };
    await updateProcessFields(result.processId, processFields);
    result.fieldsExtracted = Object.keys(processFields).filter(
      (k) => processFields[k as keyof ExtractedProcessFields]
    );
    emit("save", "done", `${result.fieldsExtracted.length} campo(s) salvo(s)`);
    return result;
  }

  emit("match", "active", "Localizando cliente no cadastro");

  if (!clientFolderId) {
    // Não deveria acontecer — já validado logo após a determinação de pasta,
    // antes do download/IA. Guarda defensiva só pro TypeScript estreitar o
    // tipo com segurança daqui em diante.
    result.skipped = true;
    result.skipReason = "Não foi possível determinar a pasta do cliente";
    emit("match", "skip", result.skipReason);
    await unmarkFileProcessed(fileId);
    return result;
  }

  let clientId = await findClientByDriveFolderId(clientFolderId);
  if (!clientId) {
    const byName = await findClientByFolderName(clientFolderId);
    if (byName.ambiguous) {
      result.skipped = true;
      result.skipReason = "Nome da pasta do cliente é ambíguo (mais de um cadastro com esse nome) — vínculo não foi feito automaticamente, verifique manualmente";
      emit("match", "skip", result.skipReason);
      await unmarkFileProcessed(fileId);
      return result;
    }
    clientId = byName.clientId;
  }

  emit("match", "done", clientId ? "Cliente já cadastrado localizado" : "Novo cliente será cadastrado");
  emit("save", "active", "Salvando dados no cadastro");

  if (!clientId) {
    const folderName = await getFolderName(clientFolderId);
    const parentOfClient = await getParentFolderId(clientFolderId);
    const dbStatus = parentOfClient ? statusMap[parentOfClient] : null;

    if (!dbStatus) {
      result.skipped = true;
      result.skipReason = "Pasta do cliente não está dentro de uma pasta de status conhecida";
      emit("save", "skip", result.skipReason);
      return result;
    }

    const displayName =
      extracted.nome ||
      extracted.nome_cliente ||
      (folderName ? folderNameToDisplayName(folderName) : null);

    if (!displayName) {
      result.skipped = true;
      result.skipReason = "Não foi possível determinar o nome do cliente";
      emit("save", "skip", result.skipReason);
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
    // safe.cpf_cnpj já passou por sanitizeValue, que só deixa passar CPF/CNPJ
    // com dígito verificador válido e guarda só os dígitos — 14 dígitos é
    // CNPJ (PJ), 11 é CPF (PF). Sem essa inferência, todo cliente virava "PF"
    // fixo, mesmo quando o documento claramente era de uma empresa (CNPJ,
    // nome fantasia extraído etc.).
    const tipoPessoa = safe.cpf_cnpj && safe.cpf_cnpj.length === 14 ? "PJ" : "PF";
    const { error } = await getSupabaseServiceClient().from("clientes").insert({
      id: newId,
      nome: displayName,
      tipo: tipoPessoa,
      status: dbStatus,
      cpf_cnpj: safe.cpf_cnpj ?? "",
      rg_ie: safe.rg_ie ?? "",
      data_nascimento_abertura: safe.data_nascimento_abertura ?? null,
      estado_civil: safe.estado_civil ?? null,
      endereco: safe.endereco ?? null,
      nome_fantasia: safe.nome_fantasia ?? null,
      telefone: safe.telefone ?? null,
      email: safe.email ?? null,
      data_cadastro: hojeLocalISO(),
      drive_folder_id: clientFolderId
    });

    if (error) {
      // CPF/CNPJ já cadastrado em outro cliente — provavelmente o mesmo cliente
      // com um documento chegando por uma pasta diferente. Atualiza o existente
      // em vez de falhar, sem sobrescrever a pasta já vinculada a ele.
      if (error.code === "23505" && safe.cpf_cnpj) {
        const existing = await findClientByCpfCnpj(safe.cpf_cnpj);

        // Só mescla se o cliente existente ainda não tem pasta (primeira vez
        // que aparece um documento dele) ou se a pasta dele já É esta que
        // estamos processando agora. Se ele já tem uma pasta DIFERENTE
        // vinculada, o CPF pode ter sido mal lido pela IA e coincidir por
        // acaso com o de outra pessoa — sobrescrever nome/endereço/telefone
        // de um terceiro é pior do que simplesmente não gravar este documento.
        const sameContext =
          existing && (!existing.driveFolderId || existing.driveFolderId === clientFolderId);

        if (existing && sameContext) {
          await updateClientFields(existing.id, {
            nome: displayName,
            rg_ie: safe.rg_ie,
            data_nascimento_abertura: safe.data_nascimento_abertura,
            estado_civil: safe.estado_civil,
            endereco: safe.endereco,
            nome_fantasia: safe.nome_fantasia,
            telefone: safe.telefone,
            email: safe.email
          });
          clientId = existing.id;
          result.fieldsExtracted = [
            ...(extracted.rg_ie ? ["rg_ie"] : []),
            ...(extracted.data_nascimento_abertura ? ["data_nascimento_abertura"] : []),
            ...(extracted.estado_civil ? ["estado_civil"] : []),
            ...(extracted.endereco ? ["endereco"] : []),
            ...(extracted.telefone ? ["telefone"] : []),
            ...(extracted.email ? ["email"] : [])
          ];
          emit("save", "done", "CPF/CNPJ já cadastrado — cliente existente atualizado");
          result.clientId = clientId;
          return result;
        }

        if (existing && !sameContext) {
          result.skipped = true;
          result.skipReason = "CPF/CNPJ já cadastrado para outro cliente com uma pasta diferente vinculada — verifique manualmente, pode ser erro de extração ou documento na pasta errada";
          emit("save", "skip", result.skipReason);
          await unmarkFileProcessed(fileId);
          return result;
        }
      }

      console.error("[AIReader] Erro ao criar cliente:", error);
      result.skipped = true;
      result.skipReason = `Erro ao criar cliente: ${error.message}`;
      emit("save", "error", result.skipReason);
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

    // Procuração e documento pessoal são a fonte confiável da qualificação
    // da parte — podem corrigir o que já está cadastrado. Qualquer outro
    // tipo (IPTU, petição, contrato) não é sobre a qualificação da pessoa
    // em si, então só preenche esses campos se ainda estiverem vazios,
    // nunca sobrescreve um dado bom que já veio de um documento oficial.
    if (!PRIORITY_ID_DOCS.has(docType)) {
      const { data: current } = await getSupabaseServiceClient()
        .from("clientes")
        .select(QUALIFICATION_FIELDS.join(","))
        .eq("id", clientId)
        .maybeSingle<Record<(typeof QUALIFICATION_FIELDS)[number], string | null>>();

      for (const field of QUALIFICATION_FIELDS) {
        if (current?.[field]) delete clientFields[field];
      }
    }

    await updateClientFields(clientId, clientFields);
    result.fieldsExtracted = Object.keys(clientFields).filter(
      (k) => clientFields[k as keyof ExtractedClientFields]
    );

    // Arquivo solto na pasta do cliente com dados de processo → cria/atualiza processo.
    // Inclui "outro" porque uma peça avulsa (contrarrazões, cumprimento de
    // sentença etc.) pode citar o número CNJ e precisa achar/atualizar o
    // processo certo — ensureProcessoFromClienteFile só CRIA processo novo
    // para documento_inicial (ver função), então incluir "outro" aqui não
    // arrisca criar processo a partir de um documento qualquer.
    if (docType === "documento_inicial" || docType === "contrato_honorarios" || docType === "outro") {
      const processId = await ensureProcessoFromClienteFile(clientId, extracted, docType);
      if (processId) {
        result.processId = processId;
        const processFieldNames = ["numero_cnj", "tipo_acao", "parte_contraria", "vara_comarca", "localizacao", "data_protocolo", "data_encerramento", "modelo_cobranca", "valor_entrada", "percentual_exito"];
        result.fieldsExtracted = [
          ...result.fieldsExtracted,
          ...processFieldNames.filter((k) => extracted[k])
        ];
      }
    }
  }

  result.clientId = clientId;
  emit("save", "done", `${result.fieldsExtracted.length} campo(s) salvo(s)`);
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

  const supabase = getSupabaseServiceClient();
  const fields: ExtractedProcessFields = {
    numero_cnj: numeroCnj,
    tipo_acao: tipoAcao,
    parte_contraria: extracted.parte_contraria,
    vara_comarca: extracted.vara_comarca,
    localizacao: extracted.localizacao,
    data_protocolo: extracted.data_protocolo,
    data_encerramento: extracted.data_encerramento,
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
      .limit(1)
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
    localizacao: safeProc.localizacao ?? null,
    data_cadastro: hojeLocalISO(),
    data_protocolo: safeProc.data_protocolo ?? null,
    data_encerramento: safeProc.data_encerramento ?? null,
    modelo_cobranca: safeProc.modelo_cobranca ?? null,
    valor_entrada: safeProc.valor_entrada ? parseMoneyToNumber(safeProc.valor_entrada) : null,
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
