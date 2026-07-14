export function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function formatSyncTimestamp(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function formatInputDate(value: string) {
  if (!value) return "—";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value) || value === "—") return value;
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

export function formatTodayBR() {
  return formatInputDate(todayInputValue());
}

export function toInputDate(value?: string) {
  if (!value || value === "—") return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const [day, month, year] = value.split("/");
  if (!day || !month || !year) return "";
  return `${year}-${month}-${day}`;
}

function parseBRDate(value: string): Date | null {
  if (!value || value === "—") return null;

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [day, month, year] = value.split("/");
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  return null;
}

export function calculateDuration(
  startDate: string,
  endDate?: string | null,
  isEncerrado = false
): string {
  const start = parseBRDate(startDate);
  if (!start) return "—";

  const end = endDate ? parseBRDate(endDate) : null;
  const reference = end ?? new Date();

  let years = reference.getFullYear() - start.getFullYear();
  let months = reference.getMonth() - start.getMonth();

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? "ano" : "anos"}`);
  if (months > 0) parts.push(`${months} ${months === 1 ? "mês" : "meses"}`);
  if (parts.length === 0) parts.push("menos de 1 mês");

  const label = isEncerrado ? "encerrado" : "em curso";
  return `${parts.join(" e ")} (${label})`;
}
