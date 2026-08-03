import type { Client, LegalProcess } from "@/lib/types";

const STORAGE_KEY = "base-operacional-boos:v2";

type LocalStore = {
  clients: Client[];
  processes: LegalProcess[];
};

export function loadLocalData(): LocalStore {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) throw new Error("empty");

    const parsed = JSON.parse(saved) as Partial<LocalStore>;
    return {
      clients: parsed.clients ?? [],
      processes: parsed.processes ?? []
    };
  } catch {
    return { clients: [], processes: [] };
  }
}

// Dispara a cada mudança de dados em modo local (useEffect). Sem o try, uma
// quota excedida do localStorage lançava dentro do efeito e quebrava a
// árvore React inteira — sem error boundary pra recuperar. Devolve se
// conseguiu salvar, pra quem chama poder avisar o usuário em vez de deixar
// os dados silenciosamente sem persistir.
export function persistLocalData(clients: Client[], processes: LegalProcess[]): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ clients, processes }));
    return true;
  } catch (error) {
    console.error("[LocalStore] Falha ao salvar dados localmente:", error);
    return false;
  }
}
