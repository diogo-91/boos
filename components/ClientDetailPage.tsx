"use client";

import Link from "next/link";
import { useState } from "react";
import type { ClientStatus } from "@/lib/types";
import { useOperationalData } from "@/components/OperationalDataProvider";
import { syncClientDriveFolder } from "@/services/drive-sync";
import { DriveFolderCard } from "@/components/DriveFolderCard";
import { DriveBrowser } from "@/components/DriveBrowser";
import { EmptyState } from "@/components/EmptyState";
import { ClientFormModal } from "@/components/forms/ClientFormModal";
import { ProcessFormModal } from "@/components/forms/ProcessFormModal";
import { StatusChangeModal } from "@/components/forms/StatusChangeModal";
import { InfoGrid } from "@/components/InfoGrid";
import { PageShell } from "@/components/layout/PageShell";
import { ProcessTable } from "@/components/ProcessTable";
import { SectionCard } from "@/components/SectionCard";
import { StatusHistoryList } from "@/components/StatusHistoryList";
import { Button } from "@/components/ui/Button";

type ClientDetailPageProps = {
  clientId: string;
};

const CLIENT_STATUS_OPTIONS: ClientStatus[] = [
  "Ativo",
  "Em contratação",
  "Sarandi/IPTU",
  "Dativo",
  "Parceiros",
  "Arquivado",
  "Cancelado"
];

function statusRequiresDate(status: ClientStatus) {
  return status === "Ativo" || status === "Arquivado" || status === "Cancelado";
}

export function ClientDetailPage({ clientId }: ClientDetailPageProps) {
  const {
    clients,
    createProcess,
    getClientById,
    getProcessesByClientId,
    updateClient,
    updateClientStatus,
    refreshClient,
    isLoading
  } = useOperationalData();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [isDriveBrowserOpen, setIsDriveBrowserOpen] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [localDriveFolderId, setLocalDriveFolderId] = useState<string | null | undefined>(undefined);
  const [pendingStatus, setPendingStatus] = useState<ClientStatus | null>(null);

  const client = getClientById(clientId);

  if (!client && isLoading) {
    return (
      <PageShell>
        <EmptyState
          title="Carregando cliente"
          description="Buscando dados da ficha na base operacional."
        />
      </PageShell>
    );
  }

  if (!client) {
    return (
      <PageShell>
        <EmptyState
          title="Cliente não encontrado"
          description="Este cliente não existe mais na base ou o link está incorreto."
        />
      </PageShell>
    );
  }

  const processes = getProcessesByClientId(client.id);

  const effectiveDriveFolderId = localDriveFolderId !== undefined
    ? localDriveFolderId
    : client.driveFolderId;

  async function handleOpenDrive() {
    if (effectiveDriveFolderId) {
      setIsDriveBrowserOpen(true);
      return;
    }

    setIsCreatingFolder(true);
    try {
      const updated = await syncClientDriveFolder(client!);
      if (updated.driveFolderId) {
        setLocalDriveFolderId(updated.driveFolderId);
        refreshClient(updated);
        setIsDriveBrowserOpen(true);
      }
    } finally {
      setIsCreatingFolder(false);
    }
  }

  function handleStatusChange(status: ClientStatus) {
    if (statusRequiresDate(status)) {
      setPendingStatus(status);
      return;
    }
    updateClientStatus(client!.id, status);
  }

  return (
    <PageShell>
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-soft sm:p-6">
        <nav className="mb-4 text-sm text-slate-500">
          <Link href="/clientes" className="font-semibold text-navy-800">
            ← Clientes
          </Link>
        </nav>

        <div className="border-b border-slate-200 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-slate-950 sm:text-2xl lg:text-3xl">
                {client.name}
              </h2>
              <div className="mt-2 inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200 sm:text-sm">
                {client.status === "Ativo"
                  ? `Ativo desde ${client.activationDate}`
                  : client.status}
              </div>
            </div>
            <select
              value={client.status}
              onChange={(e) => handleStatusChange(e.target.value as ClientStatus)}
              className="h-9 shrink-0 rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 outline-none transition focus:border-navy-700 focus:ring-2 focus:ring-navy-700/15 sm:h-10 sm:px-3 sm:text-sm"
            >
              {CLIENT_STATUS_OPTIONS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setIsEditModalOpen(true)}>
              Editar
            </Button>
            <Button variant="secondary" onClick={() => setIsProcessModalOpen(true)}>
              + Processo
            </Button>
            <button
              onClick={handleOpenDrive}
              disabled={isCreatingFolder}
              className="inline-flex h-9 items-center justify-center rounded-md bg-navy-800 px-3 text-xs font-semibold text-white transition hover:bg-navy-700 disabled:opacity-60 sm:h-10 sm:px-4 sm:text-sm"
            >
              {isCreatingFolder ? "Criando..." : "Drive"}
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-5">
          <SectionCard title="Identificação">
            <InfoGrid
              items={[
                { label: "Tipo", value: client.personType },
                { label: "CPF/CNPJ", value: client.document },
                { label: "RG / Inscrição Estadual", value: client.secondaryDocument },
                { label: "Nome completo / Razão social", value: client.legalName },
                { label: "Data de nascimento / abertura", value: client.birthOrOpeningDate },
                { label: "Estado civil", value: client.maritalStatus }
              ]}
            />
          </SectionCard>

          <SectionCard title="Histórico no escritório">
            <InfoGrid
              items={[
                { label: "Data de cadastro", value: client.registrationDate },
                { label: "Data de ativação", value: client.activationDate },
                { label: "Data de finalização", value: client.finalizationDate }
              ]}
            />
          </SectionCard>

          <SectionCard title="Histórico de status">
            <StatusHistoryList entity="cliente" entityId={client.id} />
          </SectionCard>

          <SectionCard title="Contato">
            <InfoGrid
              items={[
                { label: "Telefone / WhatsApp", value: client.phone },
                {
                  label: "E-mail",
                  value: (
                    <a
                      href={`mailto:${client.email}`}
                      className="text-navy-800 hover:text-navy-700"
                    >
                      {client.email}
                    </a>
                  )
                },
                { label: "Endereço", value: client.address }
              ]}
            />
          </SectionCard>

          <SectionCard title="Origem e parceria">
            <InfoGrid
              items={[
                { label: "Origem do cliente", value: client.origin },
                { label: "Parceiro de indicação", value: client.partner },
                { label: "% de honorário ao parceiro", value: client.partnerFee }
              ]}
            />
          </SectionCard>

          <SectionCard title="Processos vinculados">
            <ProcessTable processes={processes} />
          </SectionCard>

          <SectionCard title="Pasta no Drive">
            <div id="pasta-drive">
              <DriveFolderCard
                path={client.driveFolder}
                folderId={effectiveDriveFolderId}
                onOpenBrowser={() => setIsDriveBrowserOpen(true)}
              />
            </div>
          </SectionCard>
        </div>
      </div>

      <ClientFormModal
        key={`edit-client-${client.id}-${String(isEditModalOpen)}`}
        client={client}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSubmit={(values) => updateClient(client.id, values)}
      />
      <ProcessFormModal
        key={`new-process-${client.id}-${String(isProcessModalOpen)}`}
        clients={clients}
        fixedClientId={client.id}
        isOpen={isProcessModalOpen}
        onClose={() => setIsProcessModalOpen(false)}
        onSubmit={createProcess}
      />
      {effectiveDriveFolderId && (
        <DriveBrowser
          isOpen={isDriveBrowserOpen}
          rootFolderId={effectiveDriveFolderId}
          rootFolderName={client.name}
          onClose={() => setIsDriveBrowserOpen(false)}
        />
      )}

      <StatusChangeModal
        key={`client-status-${pendingStatus ?? "none"}`}
        isOpen={Boolean(pendingStatus)}
        title="Atualizar status do cliente"
        description={`Informe a data para marcar o cliente como ${pendingStatus}.`}
        dateLabel={
          pendingStatus === "Ativo" ? "Data de ativação" : "Data de finalização"
        }
        onClose={() => setPendingStatus(null)}
        onConfirm={(date) => {
          if (pendingStatus) updateClientStatus(client.id, pendingStatus, date);
          setPendingStatus(null);
        }}
      />
    </PageShell>
  );
}
