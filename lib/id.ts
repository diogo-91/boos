// Só o timestamp em milissegundos como sufixo colide se dois registros com o
// mesmo nome forem criados no mesmo milissegundo — relevante só em modo
// local (sem Supabase), onde esse id é a chave client-side. Um sufixo
// aleatório de verdade fecha isso.
function randomSuffix(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}

export function generateId(prefix: string, label: string) {
  const slug =
    label
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "registro";

  return `${prefix}-${slug}-${Date.now()}-${randomSuffix()}`;
}
