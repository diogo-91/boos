import { test } from "node:test";
import assert from "node:assert/strict";
import {
  datasDeTransicao,
  isReservedClientSubfolder,
  isReservedProcessSubfolder,
  matchStatusFolderKey
} from "./drive-status-map.ts";

test("isReservedClientSubfolder — reconhece variações com/sem acento, maiúscula e espaço/underscore", () => {
  for (const name of [
    "documentos_pessoais",
    "Documentos Pessoais",
    "COMUNICACAO",
    "Comunicação",
    "Petições Subsequentes",
    "outros",
    // Único nome reservado com ocorrência real medida em produção como
    // subpasta solta de cliente (docs/revisao-limpeza-banco.md).
    "Inicial"
  ]) {
    assert.equal(isReservedClientSubfolder(name), true, `esperava true para "${name}"`);
  }
});

test("isReservedClientSubfolder — não casa nome de pasta que não é reservada", () => {
  for (const name of [
    "Documentos",
    "Protocolo Inicial",
    "Inicial (1)",
    "Gol",
    "WhatsApp",
    "5331-24.2019.8.16.0018",
    "whatsapp"
  ]) {
    assert.equal(isReservedClientSubfolder(name), false, `esperava false para "${name}"`);
  }
});

test("isReservedProcessSubfolder — só casa as subpastas de processo, não as de cliente", () => {
  for (const name of ["inicial", "Inicial", "Petições Subsequentes", "PETICOES_SUBSEQUENTES"]) {
    assert.equal(isReservedProcessSubfolder(name), true, `esperava true para "${name}"`);
  }
  for (const name of ["documentos_pessoais", "Comunicação", "outros", "Protocolo Inicial"]) {
    assert.equal(isReservedProcessSubfolder(name), false, `esperava false para "${name}"`);
  }
});

test("matchStatusFolderKey — acha a chave ignorando maiúsculas/espaços (contrato original)", () => {
  assert.equal(matchStatusFolderKey("01_arquivados"), "01_arquivados");
  assert.equal(matchStatusFolderKey("Gol"), undefined);
  // Contrato original de normalizeFolderKey só remove espaços, não
  // underscore — "07 Sarandi" (sem underscore) não bate mais com a chave
  // "07_sarandi".
  assert.equal(matchStatusFolderKey("07 Sarandi"), undefined);
});

test("datasDeTransicao — rename sem transição não toca data nenhuma", () => {
  assert.deepEqual(datasDeTransicao("ativo", "Ativo", "2026-08-13"), {});
  assert.deepEqual(datasDeTransicao("arquivado", "Arquivado", "2026-08-13"), {});
  // audiencia é subestado de ativo — eco do Drive (pasta em 02_ativos) não é transição
  assert.deepEqual(datasDeTransicao("audiencia", "Ativo", "2026-08-13"), {});
});

test("datasDeTransicao — transições reais gravam as datas certas", () => {
  assert.equal(datasDeTransicao("contratacao", "Ativo", "2026-08-13").data_ativacao, "2026-08-13");
  assert.equal(datasDeTransicao("ativo", "Arquivado", "2026-08-13").data_finalizacao, "2026-08-13");
  assert.equal(datasDeTransicao("ativo", "Arquivado", "2026-08-13").data_ativacao, undefined);
  // reativação limpa a finalização com null explícito
  assert.equal(datasDeTransicao("arquivado", "Ativo", "2026-08-13").data_finalizacao, null);
  // audiencia movida de verdade para arquivados É transição
  assert.equal(datasDeTransicao("audiencia", "Arquivado", "2026-08-13").data_finalizacao, "2026-08-13");
});
