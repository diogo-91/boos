export function generateId(prefix: string, label: string) {
  const slug =
    label
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "registro";

  return `${prefix}-${slug}-${Date.now()}`;
}
