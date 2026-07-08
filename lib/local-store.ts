import type { Client, LegalProcess } from "@/lib/types";
import { clients as mockClients, processes as mockProcesses } from "@/data/mock-data";

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
      clients: parsed.clients?.length ? parsed.clients : mockClients,
      processes: parsed.processes?.length ? parsed.processes : mockProcesses
    };
  } catch {
    return { clients: mockClients, processes: mockProcesses };
  }
}

export function persistLocalData(clients: Client[], processes: LegalProcess[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ clients, processes }));
}
