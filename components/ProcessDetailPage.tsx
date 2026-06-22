"use client";

import Link from "next/link";
import { useState } from "react";
import type { ProcessStatus } from "@/lib/types";
import { calculateDuration } from "@/lib/date-utils";
import { useOperationalData } from "@/components/OperationalDataProvider";
import { DriveBrowser } from "@/components/DriveBrowser";
import { DriveFolderCard } from "@/components/DriveFolderCard";
import { DriveFileList } from "@/components/DriveFileList";
import { EmptyState } from "@/components/EmptyState";
import { StatusChangeModal } from "@/components/forms/StatusChangeModal";
import { InfoGrid } from "@/components/InfoGrid";
import { PageShell } from "@/components/layout/PageShell";
import { SectionCard } from "@/components/SectionCard";
import { StatusBadge } from "@/components/StatusBadge";
import { StatusHistoryList } from "@/components/StatusHistoryList";
import { Button } from "@/components/ui/Button";

type ProcessDetailPageProps = {
  processId: string;
};

const PROCESS_STATUS_OPTIONS: ProcessStatus[] = [
  "Em andamento",
  "Aguard. documentos",
  "Aguard. audiência",
  "Acordado",
  "Encerrado"
];

export function ProcessDetailPage({ processId }: ProcessDetailPageProps) {
  const {
    getClientById,
    getProcessById,
    updateProcessNotes,
    updateProcessStatus,
    isLoading
  } = useOperationalData();

  const [pendingStatus, setPendingStatus] = useState<ProcessStatus | null>(null);
  const [isDriveBrowserOpen, setIsDriveBrowserOpen] = useState(false);
  const [notes, setNotes] = useState<string | null>(null);
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  const process = getProcessById(processId);
  const client = process ? getClientById(process.clientId) : undefined;

  if ((!process || !client) && isLoading) {
    return (
      <PageShell>
        <EmptyState
          title="Carregando processo"
          description="Buscando dados do processo na base operacional."
        />
      </PageShell>
    );
  }

  if (!process || !client) {
    return (
      <PageShell>
        <EmptyState
          title="Processo não encontrado"
          description="Este processo não existe mais na base ou o link está incorreto."
        />
      </PageShell>
    );
  }

  const currentNotes = notes ?? process.notes;
  const notesChanged = currentNotes !== process.notes;

  const duration = calculateDuration(
    process.filingDate,
    process.status === "Encerrado" ? process.closingDate : null,
    process.status === "Encerrado"
  );

  function handleStatusChange(status: ProcessStatus) {
    if (status === "Encerrado") {
      setPendingStatus(status);
      return;
    }
    updateProcessStatus(process!.id, status);
  }

  async function handleSaveNotes() {
    if (!notesChanged) return;
    setIsSavingNotes(true);
    try {
      await updateProcessNotes(process!.id, currentNotes);
      setNotes(null);
    } finally {
      setIsSavingNotes(false);
    }
  }

  return (
    <PageShell>
      <nav className="mb-4 text-sm text-slate-500">
        <Link href="/clientes" className="font-semibold text-navy-800">
          Clientes
        </Link>
        <span className="mx-2">›</span>
        <Link href={`/clientes/${client.id}`} className="font-semibold text-navy-800">
          {client.name}
        </Link>
        <span className="mx-2">›</span>
        <span>Processo {process.number}</span>
      </nav>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-950 sm:text-2xl">
            Processo {process.number}
          </h2>
          <p className="mt-1 text-sm font-medium text-slate-600">
            {process.actionType}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <StatusBadge status={process.status} />
          <select
            value={process.status}
            onChange={(e) => handleStatusChange(e.target.value as ProcessStatus)}
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-navy-700 focus:ring-2 focus:ring-navy-700/15"
          >
            {PROCESS_STATUS_OPTIONS.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-5">
        <SectionCard title="Dados do processo">
          <InfoGrid
            items={[
              {
                label: "Cliente",
                value: (
                  <Link
                    href={`/clientes/${client.id}`}
                    className="font-semibold text-navy-800 hover:text-navy-700"
                  >
                    {client.name}
                  </Link>
                )
              },
              { label: "Parte contrária", value: process.opposingParty },
              { label: "Tipo de ação", value: process.actionType },
              { label: "Vara / Comarca", value: process.court },
              { label: "Localização do processo", value: process.location },
              { label: "Data de protocolo", value: process.filingDate },
              { label: "Data de encerramento", value: process.closingDate },
              { label: "Duração", value: duration }
            ]}
          />
        </SectionCard>

        <SectionCard title="Histórico de status">
          <StatusHistoryList entity="processo" entityId={process.id} />
        </SectionCard>

        <SectionCard title="Cobrança acordada">
          <InfoGrid
            items={[
              { label: "Modelo", value: process.billingModel },
              { label: "Valor de entrada", value: process.entryValue },
              { label: "% de êxito", value: process.successFee }
            ]}
          />
        </SectionCard>

        <SectionCard
          title="Documentos e anotações"
          description="Arquivos da pasta do processo no Google Drive."
        >
          <div className="space-y-5">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Pasta do processo
              </p>
              <DriveFolderCard
                path={process.driveFolder ?? ""}
                folderId={process.driveFolderId}
                onOpenBrowser={() => setIsDriveBrowserOpen(true)}
              />
            </div>

            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Arquivos
              </p>
              <DriveFileList folderId={process.driveFolderId} />
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Anotações livres
              </p>
              <textarea
                className="min-h-32 w-full resize-y rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-800 outline-none focus:border-navy-700 focus:ring-2 focus:ring-navy-700/15 sm:min-h-40"
                value={currentNotes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Registre observações internas sobre o processo..."
              />
              {notesChanged && (
                <div className="mt-2 flex justify-end">
                  <Button onClick={handleSaveNotes} disabled={isSavingNotes}>
                    {isSavingNotes ? "Salvando..." : "Salvar anotações"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </SectionCard>
      </div>

      {process.driveFolderId && (
        <DriveBrowser
          isOpen={isDriveBrowserOpen}
          rootFolderId={process.driveFolderId}
          rootFolderName={`Processo ${process.number}`}
          onClose={() => setIsDriveBrowserOpen(false)}
        />
      )}

      <StatusChangeModal
        key={`process-status-${pendingStatus ?? "none"}`}
        isOpen={Boolean(pendingStatus)}
        title="Encerrar processo"
        description="Informe a data de encerramento do processo."
        dateLabel="Data de encerramento"
        onClose={() => setPendingStatus(null)}
        onConfirm={(date) => {
          updateProcessStatus(process.id, "Encerrado", date);
          setPendingStatus(null);
        }}
      />
    </PageShell>
  );
}
