"use client";

import { useEffect, useState } from "react";
import { Calendar } from "lucide-react";
import { getLastDriveSyncAt } from "@/services/drive-sync-status";
import { formatSyncTimestamp } from "@/lib/date-utils";

const DRIVE_SYNC_POLL_MS = 60_000;

export function DriveSyncStatus({
  className = "",
  textClassName = "text-slate-400"
}: {
  className?: string;
  textClassName?: string;
}) {
  const [lastDriveSyncAt, setLastDriveSyncAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLastSync() {
      try {
        const value = await getLastDriveSyncAt();
        if (!cancelled) setLastDriveSyncAt(value);
      } catch (error) {
        console.error("[DriveSyncStatus] Falha ao buscar última sincronização do Drive:", error);
      }
    }

    loadLastSync();
    const interval = window.setInterval(loadLastSync, DRIVE_SYNC_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div className={`flex items-center gap-2 text-xs ${textClassName} ${className}`}>
      <Calendar size={12} />
      {lastDriveSyncAt
        ? `Drive sincronizado pela última vez em ${formatSyncTimestamp(lastDriveSyncAt)} · atualiza automaticamente a cada 15 minutos`
        : "Sincronização automática do Drive a cada 15 minutos"}
    </div>
  );
}
