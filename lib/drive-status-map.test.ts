import { test } from "node:test";
import assert from "node:assert/strict";
import { isReservedClientSubfolder, matchStatusFolderKey } from "./drive-status-map.ts";

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

test("matchStatusFolderKey — acha a chave ignorando maiúsculas/espaços (contrato original)", () => {
  assert.equal(matchStatusFolderKey("01_arquivados"), "01_arquivados");
  assert.equal(matchStatusFolderKey("Gol"), undefined);
  // Contrato original de normalizeFolderKey só remove espaços, não
  // underscore — "07 Sarandi" (sem underscore) não bate mais com a chave
  // "07_sarandi".
  assert.equal(matchStatusFolderKey("07 Sarandi"), undefined);
});
