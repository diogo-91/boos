export function isValidEmail(value: string) {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isValidPercent(value: string) {
  if (!value || value === "—") return true;
  const normalized = value.replace("%", "").replace(",", ".").trim();
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 && number <= 100;
}

export function isValidMoney(value: string) {
  if (!value) return true;
  return /^R\$\s?\d{1,3}(\.\d{3})*(,\d{2})?$|^R\$\s?\d+(,\d{2})?$/.test(
    value.trim()
  );
}

export function normalizeDocument(value: string) {
  return value.replace(/\D/g, "");
}

function calcCheckDigit(base: string, weights: number[]): number {
  let sum = 0;
  for (let i = 0; i < weights.length; i++) sum += Number(base[i]) * weights[i];
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

function isValidCPF(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf)) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // todos os dígitos iguais

  const d1 = calcCheckDigit(cpf, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calcCheckDigit(cpf, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return cpf === cpf.slice(0, 9) + String(d1) + String(d2);
}

function isValidCNPJ(cnpj: string): boolean {
  if (!/^\d{14}$/.test(cnpj)) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const d1 = calcCheckDigit(cnpj, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calcCheckDigit(cnpj, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return cnpj === cnpj.slice(0, 12) + String(d1) + String(d2);
}

// Nenhum ponto do pipeline de leitura por IA validava o CPF/CNPJ extraído —
// um número mal lido pelo modelo (ou que colida por acaso com o de outra
// pessoa) era gravado sem checagem. Isso também é a defesa contra o merge
// indevido do A5: número inválido vira null aqui e nunca chega a disparar
// o conflito de unicidade que aciona o merge.
export function isValidCpfCnpj(digits: string): boolean {
  if (digits.length === 11) return isValidCPF(digits);
  if (digits.length === 14) return isValidCNPJ(digits);
  return false;
}

// Um "next" que começa com "/" ainda pode ser um redirect externo: "//evil.com"
// e "/\evil.com" são interpretados pelo navegador como URL absoluta (protocol-relative).
// Só aceita path relativo de verdade, de um único "/".
export function isSafeRedirectPath(value: string | null): value is string {
  return !!value && /^\/(?!\/|\\)/.test(value);
}
