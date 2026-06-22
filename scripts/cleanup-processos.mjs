import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://dvuguivtvetzfpopnosz.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2dWd1aXZ0dmV0emZwb3Bub3N6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExODg4ODgsImV4cCI6MjA5Njc2NDg4OH0.6DGiYOnrVowakEmL77gtpNluUveodMHBcFhkKheA0Mw"
);

// Busca a Alessandra
const { data: alessandra } = await supabase
  .from("clientes")
  .select("id, nome")
  .ilike("nome", "%ALESSANDRA%")
  .maybeSingle();

if (!alessandra) {
  console.log("Cliente Alessandra não encontrado.");
  process.exit(1);
}
console.log(`Cliente: ${alessandra.nome} (${alessandra.id})`);

// Lista todos os processos dela
const { data: processos } = await supabase
  .from("processos")
  .select("id, numero_cnj, tipo_acao, modelo_cobranca, localizacao, drive_folder_id")
  .eq("cliente_id", alessandra.id);

console.log(`\nTotal de processos: ${processos.length}`);
for (const p of processos) {
  console.log(`  [${p.id.slice(0,8)}] CNJ: ${p.numero_cnj} | tipo: ${p.tipo_acao ?? "-"} | cobrança: ${p.modelo_cobranca ?? "-"} | drive: ${p.drive_folder_id ?? "-"}`);
}

// Processos a manter: os que têm drive_folder_id (criados pelo scan de subpastas)
//                     ou têm CNJ real (não começa com "sem-cnj-" e não é "não identificado")
const manter = processos.filter(p =>
  p.drive_folder_id ||
  (p.numero_cnj && !p.numero_cnj.startsWith("sem-cnj-") && !p.numero_cnj.toLowerCase().includes("não identificado") && !p.numero_cnj.toLowerCase().includes("nao identificado"))
);

const deletar = processos.filter(p => !manter.find(m => m.id === p.id));

console.log(`\nManter: ${manter.length}`);
for (const p of manter) console.log(`  ✅ [${p.id.slice(0,8)}] ${p.numero_cnj}`);

console.log(`\nDeletar: ${deletar.length}`);
for (const p of deletar) console.log(`  ❌ [${p.id.slice(0,8)}] ${p.numero_cnj}`);

if (deletar.length > 0) {
  const ids = deletar.map(p => p.id);
  const { error } = await supabase.from("processos").delete().in("id", ids);
  if (error) {
    console.error("Erro ao deletar:", error);
  } else {
    console.log(`\n✅ ${deletar.length} processo(s) duplicado(s) removido(s).`);
  }
}

console.log("\nProcessos restantes:");
const { data: restantes } = await supabase
  .from("processos")
  .select("id, numero_cnj, tipo_acao, modelo_cobranca, localizacao")
  .eq("cliente_id", alessandra.id);
for (const p of restantes) {
  console.log(`  [${p.id.slice(0,8)}] CNJ: ${p.numero_cnj} | tipo: ${p.tipo_acao ?? "-"} | cobrança: ${p.modelo_cobranca ?? "-"}`);
}
