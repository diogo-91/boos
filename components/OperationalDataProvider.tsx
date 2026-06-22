"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import type {
  Client,
  ClientFormValues,
  ClientStatus,
  LegalProcess,
  ProcessFormValues,
  ProcessStatus
} from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { formatInputDate, formatTodayBR } from "@/lib/date-utils";
import {
  applyClientStatusDates,
  attachPartnerNames,
  attachProcessIds,
  makeClient,
  makeProcess,
  resolvePartnerId
} from "@/lib/factories";
import { loadLocalData, persistLocalData } from "@/lib/local-store";
import {
  syncClientDriveFolder,
  syncClientStatusFolder,
  syncProcessDriveFolder
} from "@/services/drive-sync";
import {
  atualizarCliente,
  criarCliente,
  listarClientes
} from "@/services/clientes";
import {
  atualizarProcesso,
  criarProcesso,
  listarProcessos
} from "@/services/processos";
import type { Parceiro } from "@/lib/types";
import { listarParceiros } from "@/services/parceiros";
import { registrarHistoricoStatus } from "@/services/historico-status";

export type { ClientFormValues, ProcessFormValues } from "@/lib/types";

type ToastState = { message: string; type: "success" | "error" } | null;

type OperationalDataContextValue = {
  clients: Client[];
  processes: LegalProcess[];
  isLoading: boolean;
  isSupabaseMode: boolean;
  statusHistoryVersion: number;
  toast: ToastState;
  showToast: (message: string, type?: "success" | "error") => void;
  createClient: (values: ClientFormValues) => Promise<Client>;
  updateClient: (clientId: string, values: ClientFormValues) => Promise<void>;
  updateClientStatus: (clientId: string, status: ClientStatus, date?: string) => Promise<void>;
  createProcess: (values: ProcessFormValues) => Promise<LegalProcess>;
  updateProcessNotes: (processId: string, notes: string) => Promise<void>;
  updateProcessStatus: (processId: string, status: ProcessStatus, date?: string) => Promise<void>;
  refreshClient: (updatedClient: Client) => void;
  getClientById: (clientId: string) => Client | undefined;
  getProcessById: (processId: string) => LegalProcess | undefined;
  getProcessesByClientId: (clientId: string) => LegalProcess[];
};

const OperationalDataContext = createContext<OperationalDataContextValue | null>(null);

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

async function tryRegisterStatusHistory(
  entity: "cliente" | "processo",
  entityId: string,
  previousStatus: string,
  newStatus: string
) {
  if (previousStatus === newStatus) return false;
  try {
    await registrarHistoricoStatus({ entity, entityId, previousStatus, newStatus });
    return true;
  } catch (error) {
    console.error("[Supabase] Falha ao registrar histórico de status:", error);
    return false;
  }
}

export function OperationalDataProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [processes, setProcesses] = useState<LegalProcess[]>([]);
  const [partners, setPartners] = useState<Parceiro[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);
  const [statusHistoryVersion, setStatusHistoryVersion] = useState(0);
  const [toast, setToast] = useState<ToastState>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);

      if (!isSupabaseConfigured) {
        const local = loadLocalData();
        setClients(local.clients);
        setProcesses(local.processes);
        setIsHydrated(true);
        setIsLoading(false);
        return;
      }

      try {
        const [loadedClients, loadedProcesses, loadedPartners] = await Promise.all([
          listarClientes(),
          listarProcessos(),
          listarParceiros()
        ]);

        setPartners(loadedPartners);
        setProcesses(loadedProcesses);
        setClients(
          attachPartnerNames(
            attachProcessIds(loadedClients, loadedProcesses),
            loadedPartners
          )
        );
      } catch (error) {
        const message = getErrorMessage(error, "Não foi possível carregar dados do Supabase.");
        console.error("[Supabase] Falha ao carregar dados iniciais:", error);
        showToast(message, "error");
        setClients([]);
        setProcesses([]);
      } finally {
        setIsHydrated(true);
        setIsLoading(false);
      }
    }

    loadData();
  }, [showToast]);

  useEffect(() => {
    if (!isHydrated || isSupabaseConfigured) return;
    persistLocalData(clients, processes);
  }, [clients, isHydrated, processes]);

  const createClient = useCallback(
    async (values: ClientFormValues): Promise<Client> => {
      const draft = makeClient(values);
      const partnerId = resolvePartnerId(partners, values.partner);
      const draftWithPartner = { ...draft, partnerId: partnerId ?? null };

      if (!isSupabaseConfigured) {
        setClients((prev) => attachPartnerNames([draftWithPartner, ...prev], partners));
        showToast("Cliente cadastrado com sucesso.");
        return draftWithPartner;
      }

      try {
        const saved = await criarCliente(draftWithPartner, partnerId);
        const savedWithDrive = await syncClientDriveFolder(saved);
        setClients((prev) => attachPartnerNames([savedWithDrive, ...prev], partners));
        showToast("Cliente cadastrado com sucesso.");
        return savedWithDrive;
      } catch (error) {
        const message = getErrorMessage(error, "Erro ao cadastrar cliente.");
        showToast(message, "error");
        throw new Error(message);
      }
    },
    [partners, showToast]
  );

  const updateClient = useCallback(
    async (clientId: string, values: ClientFormValues): Promise<void> => {
      const existing = clients.find((c) => c.id === clientId);
      if (!existing) return;

      const partnerId = resolvePartnerId(partners, values.partner);
      const next = {
        ...makeClient(values, existing),
        partnerId: partnerId ?? existing.partnerId ?? null
      };

      if (!isSupabaseConfigured) {
        setClients((prev) =>
          attachPartnerNames(
            prev.map((c) => (c.id === clientId ? next : c)),
            partners
          )
        );
        showToast("Cliente atualizado com sucesso.");
        return;
      }

      try {
        const saved = await atualizarCliente(next, partnerId ?? existing.partnerId ?? null);
        setClients((prev) =>
          attachPartnerNames(
            prev.map((c) =>
              c.id === clientId ? { ...saved, processIds: c.processIds } : c
            ),
            partners
          )
        );
        showToast("Cliente atualizado com sucesso.");
      } catch (error) {
        const message = getErrorMessage(error, "Erro ao atualizar cliente.");
        showToast(message, "error");
        throw new Error(message);
      }
    },
    [clients, partners, showToast]
  );

  const updateClientStatus = useCallback(
    async (clientId: string, status: ClientStatus, date?: string): Promise<void> => {
      const existing = clients.find((c) => c.id === clientId);
      if (!existing) return;

      const formattedDate = date ? formatInputDate(date) : formatTodayBR();
      const next = applyClientStatusDates(existing, status, formattedDate);

      if (!isSupabaseConfigured) {
        setClients((prev) =>
          attachPartnerNames(
            prev.map((c) => (c.id === clientId ? next : c)),
            partners
          )
        );
        showToast("Status do cliente atualizado.");
        return;
      }

      try {
        const saved = await atualizarCliente(next, existing.partnerId ?? null);
        const savedWithDrive = await syncClientStatusFolder(saved, status);
        setClients((prev) =>
          attachPartnerNames(
            prev.map((c) =>
              c.id === clientId
                ? { ...savedWithDrive, processIds: c.processIds }
                : c
            ),
            partners
          )
        );
        const changed = await tryRegisterStatusHistory(
          "cliente",
          savedWithDrive.id,
          existing.status,
          status
        );
        if (changed) setStatusHistoryVersion((v) => v + 1);
        showToast("Status do cliente atualizado.");
      } catch (error) {
        const message = getErrorMessage(error, "Erro ao atualizar status do cliente.");
        showToast(message, "error");
        throw new Error(message);
      }
    },
    [clients, partners, showToast]
  );

  const createProcess = useCallback(
    async (values: ProcessFormValues): Promise<LegalProcess> => {
      const draft = makeProcess(values);

      if (!isSupabaseConfigured) {
        setProcesses((prev) => [draft, ...prev]);
        setClients((prev) =>
          prev.map((c) =>
            c.id === values.clientId
              ? { ...c, processIds: [draft.id, ...c.processIds] }
              : c
          )
        );
        showToast("Processo cadastrado com sucesso.");
        return draft;
      }

      try {
        const saved = await criarProcesso(draft);
        const owner = clients.find((c) => c.id === saved.clientId);
        const savedWithDrive = await syncProcessDriveFolder(owner, saved);
        setProcesses((prev) => [savedWithDrive, ...prev]);
        setClients((prev) =>
          prev.map((c) =>
            c.id === savedWithDrive.clientId
              ? { ...c, processIds: [savedWithDrive.id, ...c.processIds] }
              : c
          )
        );
        showToast("Processo cadastrado com sucesso.");
        return savedWithDrive;
      } catch (error) {
        const message = getErrorMessage(error, "Erro ao cadastrar processo.");
        showToast(message, "error");
        throw new Error(message);
      }
    },
    [clients, showToast]
  );

  const refreshClient = useCallback((updatedClient: Client) => {
    setClients((prev) =>
      attachPartnerNames(
        prev.map((c) => (c.id === updatedClient.id ? { ...updatedClient, processIds: c.processIds } : c)),
        partners
      )
    );
  }, [partners]);

  const updateProcessNotes = useCallback(
    async (processId: string, notes: string): Promise<void> => {
      const existing = processes.find((p) => p.id === processId);
      if (!existing) return;

      const next: LegalProcess = { ...existing, notes };

      if (!isSupabaseConfigured) {
        setProcesses((prev) => prev.map((p) => (p.id === processId ? next : p)));
        showToast("Anotações salvas.");
        return;
      }

      try {
        const saved = await atualizarProcesso(next);
        setProcesses((prev) => prev.map((p) => (p.id === processId ? saved : p)));
        showToast("Anotações salvas.");
      } catch (error) {
        const message = getErrorMessage(error, "Erro ao salvar anotações.");
        showToast(message, "error");
        throw new Error(message);
      }
    },
    [processes, showToast]
  );

  const updateProcessStatus = useCallback(
    async (processId: string, status: ProcessStatus, date?: string): Promise<void> => {
      const existing = processes.find((p) => p.id === processId);
      if (!existing) return;

      const next: LegalProcess = {
        ...existing,
        status,
        closingDate:
          status === "Encerrado"
            ? date
              ? formatInputDate(date)
              : formatTodayBR()
            : existing.closingDate
      };

      if (!isSupabaseConfigured) {
        setProcesses((prev) => prev.map((p) => (p.id === processId ? next : p)));
        showToast("Status do processo atualizado.");
        return;
      }

      try {
        const saved = await atualizarProcesso(next);
        setProcesses((prev) => prev.map((p) => (p.id === processId ? saved : p)));
        const changed = await tryRegisterStatusHistory(
          "processo",
          saved.id,
          existing.status,
          status
        );
        if (changed) setStatusHistoryVersion((v) => v + 1);
        showToast("Status do processo atualizado.");
      } catch (error) {
        const message = getErrorMessage(error, "Erro ao atualizar status do processo.");
        showToast(message, "error");
        throw new Error(message);
      }
    },
    [processes, showToast]
  );

  const value = useMemo<OperationalDataContextValue>(
    () => ({
      clients,
      processes,
      isLoading,
      isSupabaseMode: isSupabaseConfigured,
      statusHistoryVersion,
      toast,
      showToast,
      createClient,
      updateClient,
      updateClientStatus,
      createProcess,
      refreshClient,
      updateProcessNotes,
      updateProcessStatus,
      getClientById: (id) => clients.find((c) => c.id === id),
      getProcessById: (id) => processes.find((p) => p.id === id),
      getProcessesByClientId: (clientId) =>
        processes.filter((p) => p.clientId === clientId)
    }),
    [
      clients,
      createClient,
      createProcess,
      isLoading,
      processes,
      refreshClient,
      showToast,
      statusHistoryVersion,
      toast,
      updateClient,
      updateClientStatus,
      updateProcessNotes,
      updateProcessStatus
    ]
  );

  return (
    <OperationalDataContext.Provider value={value}>
      {children}
      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className={[
            "fixed bottom-4 right-4 z-[60] rounded-lg px-4 py-3 text-sm font-semibold shadow-lg",
            toast.type === "success" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
          ].join(" ")}
        >
          {toast.message}
        </div>
      ) : null}
    </OperationalDataContext.Provider>
  );
}

export function useOperationalData() {
  const context = useContext(OperationalDataContext);
  if (!context) {
    throw new Error("useOperationalData deve ser usado dentro de OperationalDataProvider");
  }
  return context;
}
