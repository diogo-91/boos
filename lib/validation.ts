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
