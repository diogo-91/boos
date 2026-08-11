import type { ClientStatus } from "@/lib/types";
import { getGoogleDriveClient, getGoogleDriveRootFolderId } from "@/lib/google/drive";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { readDriveFile, getProcessedFileModifiedTimeMap } from "@/services/ai-document-reader";
import { FOLDER_MIME, STATUS_DB_MAP, STATUS_FOLDER_MAP, matchStatusFolderKey } from "@/lib/drive-status-map";
import {
  createProcessoFromFolder,
  findClienteByDriveFolderId,
  findProcessoByDriveFolderId,
  linkOrCreateClienteFromFolder,
  updateClienteStatusFromFolder
} from "@/services/drive-status-sync";

// Mesmo critério de nome usado em detectDocumentType (ai-document-reader.ts)
// pra reconhecer procuração — duplicado aqui de propósito, é só um filtro
// de nome de arquivo (sem custo de rede) usado pelo modo "só procuração"
// abaixo, não vale importar o módulo inteiro só por isso.
function looksLikeProcuracao(fileName: string): boolean {
  const name = fileName.toLowerCase();
  return name.includes("procuracao") || name.includes("procuração");
}

async function listChildren(parentId: string) {
  const drive = getGoogleDriveClient();
  const items: Array<{ id: string; name: string; mimeType: string; modifiedTime: string | null }> = [];
  let pageToken: string | undefined;

  do {
    const { data } = await drive.files.list({
      q: `'${parentId}' in parents and trashed = false`,
      fields: "nextPageToken,files(id,name,mimeType,modifiedTime)",
      orderBy: "name",
      pageSize: 100,
      pageToken,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true
    });
    for (const f of data.files ?? []) {
      if (f.id && f.name && f.mimeType) {
        items.push({ id: f.id, name: f.name, mimeType: f.mimeType, modifiedTime: f.modifiedTime ?? null });
      }
    }
    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken);

  return items;
}

type ScanCheckpoint = { statusFolderId: string | null; clienteFolderId: string | null };

async function getCheckpoint(): Promise<ScanCheckpoint> {
  const { data } = await getSupabaseServiceClient()
    .from("drive_scan_checkpoint")
    .select("status_folder_id,cliente_folder_id")
    .eq("id", "singleton")
    .maybeSingle();

  return {
    statusFolderId: data?.status_folder_id ?? null,
    clienteFolderId: data?.cliente_folder_id ?? null
  };
}

async function saveCheckpoint(statusFolderId: string | null, clienteFolderId: string | null) {
  const { error } = await getSupabaseServiceClient().from("drive_scan_checkpoint").upsert({
    id: "singleton",
    status_folder_id: statusFolderId,
    cliente_folder_id: clienteFolderId,
    updated_at: new Date().toISOString()
  });

  if (error) throw error;
}

async function clearCheckpoint() {
  await saveCheckpoint(null, null);
}

async function ensureCliente(
  folderId: string,
  folderName: string,
  status: ClientStatus,
  statusFolderName: string
): Promise<{ id: string; nome: string; drive_path: string; created: boolean }> {
  const existing = await findClienteByDriveFolderId(folderId);
  if (existing) {
    // A varredura completa só criava clientes novos — se a pasta de um
    // cliente já cadastrado for movida manualmente pro Drive pra outra
    // pasta de status, o status no banco ficava desatualizado até a
    // sincronização incremental (que roda de tempos em tempos) passar por
    // ali. Reconcilia aqui também, do mesmo jeito que
    // updateClienteStatusFromFolder já faz pro caminho incremental.
    const expectedDbStatus = STATUS_DB_MAP[status];
    if (existing.status !== expectedDbStatus) {
      await updateClienteStatusFromFolder(folderId, status, statusFolderName, folderName);
      return {
        id: existing.id,
        nome: existing.nome,
        drive_path: `${statusFolderName} › ${folderName}`,
        created: false
      };
    }
    return { ...existing, created: false };
  }

  const { cliente, created } = await linkOrCreateClienteFromFolder(
    folderId,
    folderName,
    status,
    statusFolderName
  );
  return { ...cliente, created };
}

async function ensureProcesso(
  folderId: string,
  folderName: string,
  clienteId: string,
  clienteDrivePath: string
): Promise<boolean> {
  const existing = await findProcessoByDriveFolderId(folderId);
  if (existing) return false;

  await createProcessoFromFolder(folderId, folderName, clienteId, clienteDrivePath);
  return true;
}

export type FileReadDetail = {
  fileName: string;
  documentType: string;
  fieldsExtracted: string[];
  skipped: boolean;
  skipReason?: string;
  clienteNome?: string;
};

export type FullScanResult = {
  clientesFound: number;
  clientesCreated: number;
  processosFound: number;
  processosCreated: number;
  filesRead: number;
  filesSkipped: number;
  fileDetails: FileReadDetail[];
  errors: string[];
  timedOut: boolean;
  resumedFromCheckpoint: boolean;
};

// Deixa margem de segurança para o limite de 5 min (300s) da function.
const MAX_DURATION_MS = 4.5 * 60 * 1000;

// Bem acima do volume normal de uma pasta de cliente (tipicamente 10-40
// itens) — só dispara pra casos de fato fora da curva.
const LARGE_CLIENT_ITEM_THRESHOLD = 200;

// Antes, o corte de tempo só era checado depois de terminar um cliente
// inteiro — um cliente com volume muito grande de arquivos podia estourar o
// maxDuration da plataforma antes de qualquer checkpoint ser salvo. Chamado
// também depois de cada arquivo lido, não só depois de cada cliente.
async function handleTimeoutIfNeeded(
  result: FullScanResult,
  startedAt: number,
  statusFolderId: string,
  clienteFolderId: string
): Promise<boolean> {
  if (Date.now() - startedAt <= MAX_DURATION_MS) return false;

  try {
    await saveCheckpoint(statusFolderId, clienteFolderId);
  } catch (err) {
    result.errors.push(`[checkpoint] Falha ao salvar ponto de retomada: ${err instanceof Error ? err.message : String(err)}`);
  }
  result.timedOut = true;
  return true;
}

export type FullScanOptions = {
  // Quando true, ignora todo arquivo que não pareça procuração pelo nome —
  // usado pra cadastrar rápido um lote grande de clientes (a procuração já
  // tem prioridade pra qualificação, ver PRIORITY_ID_DOCS em
  // ai-document-reader.ts) sem esperar a leitura de dezenas de arquivos
  // por pasta. Os demais arquivos ficam pra uma varredura normal depois.
  onlyProcuracao?: boolean;
  // Restringe a varredura a uma única pasta de status (chave de
  // STATUS_FOLDER_MAP, ex: "02_ativos", ou o nome de exibição, ex:
  // "Ativo" — matchStatusFolderKey aceita os dois). Sem isso, percorre
  // todas as pastas de status como sempre. Existe porque re-varrer a
  // árvore inteira só pra alcançar uma pasta específica no fim da fila
  // desperdiça rodada atrás de rodada reconferindo o que já está pronto.
  onlyStatusFolder?: string;
};

export async function runFullScan(options: FullScanOptions = {}): Promise<FullScanResult> {
  const startedAt = Date.now();

  const result: FullScanResult = {
    clientesFound: 0,
    clientesCreated: 0,
    processosFound: 0,
    processosCreated: 0,
    filesRead: 0,
    filesSkipped: 0,
    fileDetails: [],
    errors: [],
    timedOut: false,
    resumedFromCheckpoint: false
  };

  const checkpoint = await getCheckpoint();

  const rootId = getGoogleDriveRootFolderId();
  const rootChildren = await listChildren(rootId);

  // Se pedido, resolve o filtro de pasta única pra chave canônica — aceita
  // tanto o nome da pasta ("02_ativos", via matchStatusFolderKey) quanto o
  // nome de exibição do status ("Ativo", buscando o valor em STATUS_FOLDER_MAP).
  const onlyStatusKey = options.onlyStatusFolder
    ? matchStatusFolderKey(options.onlyStatusFolder) ??
      Object.entries(STATUS_FOLDER_MAP).find(
        ([, status]) => status.toLowerCase() === options.onlyStatusFolder!.toLowerCase()
      )?.[0]
    : undefined;

  // Identifica as pastas de status na raiz
  const statusFolders: Array<{ id: string; name: string; status: ClientStatus }> = [];
  for (const item of rootChildren) {
    if (item.mimeType !== FOLDER_MIME) continue;
    const key = matchStatusFolderKey(item.name);
    if (!key) continue;
    if (onlyStatusKey && key !== onlyStatusKey) continue;
    statusFolders.push({ id: item.id, name: item.name, status: STATUS_FOLDER_MAP[key] });
  }

  // Um checkpoint salvo por uma varredura sem filtro (ou com outro filtro)
  // não corresponde a nenhuma pasta dentro do conjunto restrito por
  // onlyStatusFolder — sem essa checagem, skipUntilStatusFolder nunca
  // encontraria a pasta procurada dentro da lista filtrada e a varredura
  // "terminaria" silenciosamente sem processar nada.
  const checkpointMatchesScope =
    Boolean(checkpoint.statusFolderId) &&
    statusFolders.some((f) => f.id === checkpoint.statusFolderId);

  result.resumedFromCheckpoint = checkpointMatchesScope;
  let skipUntilStatusFolder = checkpointMatchesScope;
  let skipUntilClienteFolder = checkpointMatchesScope && Boolean(checkpoint.clienteFolderId);

  statusLoop: for (const statusFolder of statusFolders) {
    if (skipUntilStatusFolder) {
      if (statusFolder.id !== checkpoint.statusFolderId) continue;
      skipUntilStatusFolder = false;
    }

    const clienteFolders = await listChildren(statusFolder.id);

    for (const clienteItem of clienteFolders) {
      if (clienteItem.mimeType !== FOLDER_MIME) continue;

      if (skipUntilClienteFolder) {
        if (clienteItem.id !== checkpoint.clienteFolderId) continue;
        // Esse cliente já foi totalmente processado antes da última parada — pula ele também.
        skipUntilClienteFolder = false;
        continue;
      }

      result.clientesFound++;

      let cliente: { id: string; nome: string; drive_path: string; created: boolean };
      try {
        cliente = await ensureCliente(
          clienteItem.id,
          clienteItem.name,
          statusFolder.status,
          statusFolder.name
        );
        if (cliente.created) result.clientesCreated++;
      } catch (err) {
        result.errors.push(`[cliente] ${clienteItem.name}: ${err instanceof Error ? err.message : String(err)}`);
        continue;
      }

      // Percorre conteúdo da pasta do cliente
      const clienteChildren = await listChildren(clienteItem.id);

      // Cliente com centenas/milhares de itens numa pasta só (ex: WhatsApp
      // exportado em massa, digitalização de anos de processo) fazia o
      // checkpoint reprocessar esse mesmo cliente rodada após rodada sem
      // nunca terminar — cada retomada reconfere tudo que já foi pulado
      // antes de alcançar algo novo, e trava o resto da varredura atrás
      // dele. Acima do limite, pula a leitura dos arquivos deste cliente
      // (o cadastro do cliente em si já foi feito acima) e sinaliza pra
      // revisão manual, sem travar os próximos clientes da fila.
      if (clienteChildren.length > LARGE_CLIENT_ITEM_THRESHOLD) {
        result.errors.push(
          `[cliente] ${cliente.nome}: pasta com ${clienteChildren.length} itens (acima do limite de ${LARGE_CLIENT_ITEM_THRESHOLD}) — leitura de documentos pulada por enquanto, precisa de revisão manual.`
        );
        continue;
      }

      // Busca em UMA consulta só quais arquivos diretos da pasta do cliente
      // já foram processados — antes disso rodava uma consulta ao Supabase
      // (mais uma chamada ao Drive só pro modifiedTime, já resolvida acima
      // via listChildren) POR ARQUIVO, mesmo pra pastas 100% já processadas.
      // Numa varredura reconferindo dezenas de clientes já feitos, essa
      // cadeia de idas e voltas sequenciais era o principal motivo da lentidão.
      const clienteFileIds = clienteChildren.filter((c) => c.mimeType !== FOLDER_MIME).map((c) => c.id);
      const clienteProcessedMap = await getProcessedFileModifiedTimeMap(clienteFileIds);

      for (const child of clienteChildren) {
        if (child.mimeType === FOLDER_MIME) {
          // Subpasta = processo
          result.processosFound++;
          try {
            const created = await ensureProcesso(
              child.id,
              child.name,
              cliente.id,
              cliente.drive_path
            );
            if (created) result.processosCreated++;
          } catch (err) {
            result.errors.push(`[processo] ${child.name}: ${err instanceof Error ? err.message : String(err)}`);
          }

          // Lê arquivos dentro da pasta do processo — mesma guarda de
          // volume da pasta do cliente, pro mesmo problema não se repetir
          // um nível abaixo.
          const processoChildren = await listChildren(child.id);
          if (processoChildren.length > LARGE_CLIENT_ITEM_THRESHOLD) {
            result.errors.push(
              `[processo] ${child.name} (${cliente.nome}): pasta com ${processoChildren.length} itens (acima do limite de ${LARGE_CLIENT_ITEM_THRESHOLD}) — leitura de documentos pulada por enquanto, precisa de revisão manual.`
            );
            continue;
          }
          const processoFileIds = processoChildren.filter((c) => c.mimeType !== FOLDER_MIME).map((c) => c.id);
          const processoProcessedMap = await getProcessedFileModifiedTimeMap(processoFileIds);
          for (const file of processoChildren) {
            if (file.mimeType === FOLDER_MIME) continue;
            if (options.onlyProcuracao && !looksLikeProcuracao(file.name)) continue;
            try {
              const read = await readDriveFile(file.id, file.name, child.id, undefined, {
                modifiedTime: file.modifiedTime,
                processedModifiedTime: processoProcessedMap[file.id] ?? null
              });
              result.fileDetails.push({
                fileName: file.name,
                documentType: read.documentType,
                fieldsExtracted: read.fieldsExtracted,
                skipped: read.skipped,
                skipReason: read.skipReason,
                clienteNome: cliente.nome
              });
              if (!read.skipped && read.fieldsExtracted.length > 0) result.filesRead++;
              else if (read.skipped) result.filesSkipped++;
            } catch (err) {
              result.errors.push(`[arquivo] ${file.name}: ${err instanceof Error ? err.message : String(err)}`);
            }

            if (await handleTimeoutIfNeeded(result, startedAt, statusFolder.id, clienteItem.id)) {
              break statusLoop;
            }
          }
        } else {
          // Arquivo direto na pasta do cliente
          if (options.onlyProcuracao && !looksLikeProcuracao(child.name)) continue;
          try {
            const read = await readDriveFile(child.id, child.name, clienteItem.id, undefined, {
              modifiedTime: child.modifiedTime,
              processedModifiedTime: clienteProcessedMap[child.id] ?? null
            });
            result.fileDetails.push({
              fileName: child.name,
              documentType: read.documentType,
              fieldsExtracted: read.fieldsExtracted,
              skipped: read.skipped,
              skipReason: read.skipReason,
              clienteNome: cliente.nome
            });
            if (!read.skipped && read.fieldsExtracted.length > 0) result.filesRead++;
            else if (read.skipped) result.filesSkipped++;
          } catch (err) {
            result.errors.push(`[arquivo] ${child.name}: ${err instanceof Error ? err.message : String(err)}`);
          }

          if (await handleTimeoutIfNeeded(result, startedAt, statusFolder.id, clienteItem.id)) {
            break statusLoop;
          }
        }
      }

      if (await handleTimeoutIfNeeded(result, startedAt, statusFolder.id, clienteItem.id)) {
        break statusLoop;
      }
    }

    // A pasta do cliente do checkpoint não apareceu nesta pasta de status —
    // provavelmente mudou de status (e de pasta física) entre a execução que
    // salvou o checkpoint e esta retomada. Sem este reset, skipUntilClienteFolder
    // continuaria true para as pastas de status seguintes e todo o resto da
    // varredura seria pulado em silêncio.
    if (skipUntilClienteFolder) {
      result.errors.push(
        `[checkpoint] Cliente do ponto de retomada não encontrado na pasta "${statusFolder.name}" (pode ter mudado de status entre execuções). Retomando normalmente a partir daqui.`
      );
      skipUntilClienteFolder = false;
    }
  }

  if (!result.timedOut) {
    try {
      await clearCheckpoint();
    } catch (err) {
      result.errors.push(`[checkpoint] Falha ao limpar ponto de retomada: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return result;
}
