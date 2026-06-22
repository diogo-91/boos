import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

const env = fs.readFileSync(".env.local", "utf-8");
for (const line of env.split("\n")) {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) process.env[key.trim()] = rest.join("=").trim().replace(/^"|"$/g, "");
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data: clientes } = await sb.from("clientes").select("id, nome");
const { data: processos } = await sb.from("processos").select("id, numero_cnj, cliente_id");

console.log("Clientes no banco:");
clientes?.forEach(c => console.log(" -", JSON.stringify(c.nome)));

console.log("\nProcessos no banco:");
processos?.forEach(p => console.log(" -", p.numero_cnj));

function normalizeName(raw) {
  return raw.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
}

console.log("\nNomes normalizados:");
clientes?.forEach(c => console.log(" -", normalizeName(c.nome)));

// Testa Alessandra
const planilhaNome = "Alessandra Aline Paguiarini de Aguiar";
const norm = normalizeName(planilhaNome);
const palavras = norm.split(" ").slice(0, 2).join(" ");
console.log(`\nBusca por: "${palavras}"`);
clientes?.forEach(c => {
  const nomeNorm = normalizeName(c.nome);
  const match = nomeNorm.includes(palavras);
  console.log(` ${match ? "✅" : "❌"} ${c.nome} → "${nomeNorm}"`);
});
