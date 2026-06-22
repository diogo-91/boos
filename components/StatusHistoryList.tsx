"use client";

import { useEffect, useState } from "react";
import type { StatusHistoryEntity, StatusHistoryEntry } from "@/lib/types";
import { useOperationalData } from "@/components/OperationalDataProvider";
import { listarHistoricoPorEntidade } from "@/services/historico-status";

type StatusHistoryListProps = {
  entity: StatusHistoryEntity;
  entityId: string;
};

export function StatusHistoryList({ entity, entityId }: StatusHistoryListProps) {
  const { isSupabaseMode, statusHistoryVersion } = useOperationalData();
  const [items, setItems] = useState<StatusHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isSupabaseMode) {
      setItems([]);
      return;
    }

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const history = await listarHistoricoPorEntidade(entity, entityId);
        if (!cancelled) setItems(history);
      } catch (error) {
        console.error("[Supabase] Falha ao carregar histórico de status:", error);
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [entity, entityId, isSupabaseMode, statusHistoryVersion]);

  if (isLoading) {
    return (
      <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
        Carregando histórico...
      </p>
    );
  }

  if (!items.length) {
    return (
      <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500">
        Nenhuma mudança de status registrada ainda.
      </p>
    );
  }

  return (
    <div className="divide-y divide-slate-200 overflow-hidden rounded-md border border-slate-200">
      {items.map((item) => (
        <div
          key={item.id}
          className="grid gap-2 bg-white px-2 py-2 text-sm sm:px-3 sm:py-3 sm:grid-cols-[1fr_auto]"
        >
          <div>
            <p className="truncate font-semibold text-slate-900">
              {item.previousStatus} &rarr; {item.newStatus}
            </p>
            {item.note ? <p className="mt-1 text-slate-500">{item.note}</p> : null}
          </div>
          <p className="text-slate-500">{item.eventDate}</p>
        </div>
      ))}
    </div>
  );
}
