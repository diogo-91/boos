"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useOperationalData } from "@/components/OperationalDataProvider";
import { ClientFormModal } from "@/components/forms/ClientFormModal";
import { ProcessFormModal } from "@/components/forms/ProcessFormModal";
import {
  filterClients,
  uniqueBillingModels,
  uniquePartners
} from "@/lib/client-queries";
import { getPartnerLabel, getProcessCountLabel } from "@/lib/client-view-model";
import { CLIENT_STATUS_FILTERS, PROCESS_STATUS_FILTERS } from "@/lib/domain";
import { DriveBrowser } from "@/components/DriveBrowser";
import { ClientCard } from "@/components/ClientCard";
import { DataTable } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { FilterBar } from "@/components/FilterBar";
import { SearchInput } from "@/components/SearchInput";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/Button";

const DRIVE_ROOT_FOLDER_ID = process.env.NEXT_PUBLIC_DRIVE_ROOT_FOLDER_ID ?? "";

const DEFAULT_FILTER = "Todos";

export function ClientsView() {
  const { clients, processes, createClient, createProcess, isLoading } =
    useOperationalData();
  const [search, setSearch] = useState("");
  const [clientStatus, setClientStatus] = useState(DEFAULT_FILTER);
  const [processStatus, setProcessStatus] = useState(DEFAULT_FILTER);
  const [billingModel, setBillingModel] = useState(DEFAULT_FILTER);
  const [partner, setPartner] = useState(DEFAULT_FILTER);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [isDriveBrowserOpen, setIsDriveBrowserOpen] = useState(false);

  const filteredClients = useMemo(
    () =>
      filterClients(clients, processes, {
        search,
        clientStatus,
        processStatus,
        billingModel,
        partner
      }),
    [billingModel, clientStatus, clients, partner, processStatus, processes, search]
  );

  const billingOptions = useMemo(
    () => [DEFAULT_FILTER, ...uniqueBillingModels(processes)],
    [processes]
  );
  const partnerOptions = useMemo(
    () => [DEFAULT_FILTER, ...uniquePartners(clients)],
    [clients]
  );

  function resetFilters() {
    setSearch("");
    setClientStatus(DEFAULT_FILTER);
    setProcessStatus(DEFAULT_FILTER);
    setBillingModel(DEFAULT_FILTER);
    setPartner(DEFAULT_FILTER);
  }

  const emptyState = (
    <EmptyState
      title="Nenhum cliente encontrado"
      description="Ajuste a busca ou remova filtros combinados para visualizar novamente a base de clientes."
      actionLabel="Limpar filtros"
      onAction={resetFilters}
    />
  );

  return (
    <section className="space-y-3 sm:space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-soft sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <SearchInput value={search} onChange={setSearch} />
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button onClick={() => setIsClientModalOpen(true)}>
              + Cliente
            </Button>
            <Button variant="secondary" onClick={() => setIsProcessModalOpen(true)}>
              + Processo
            </Button>
            {DRIVE_ROOT_FOLDER_ID && (
              <Button variant="secondary" onClick={() => setIsDriveBrowserOpen(true)}>
                <span className="mr-2 flex h-4 w-4 items-center justify-center">
                  <svg viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4">
                    <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                    <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
                    <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                    <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                    <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                    <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                  </svg>
                </span>
                Google Drive
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-soft sm:gap-4 sm:p-5">
        <FilterBar
          label="Status do Cliente"
          options={[...CLIENT_STATUS_FILTERS]}
          value={clientStatus}
          onChange={setClientStatus}
        />
        <FilterBar
          label="Status do Processo"
          options={[...PROCESS_STATUS_FILTERS]}
          value={processStatus}
          onChange={setProcessStatus}
        />
        <div className="grid gap-2 sm:gap-3 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Cobrança / Parceiros
            </span>
            <select
              value={billingModel}
              onChange={(event) => setBillingModel(event.target.value)}
              className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-navy-700 focus:ring-2 focus:ring-navy-700/15"
            >
              {billingOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Parceiro
            </span>
            <select
              value={partner}
              onChange={(event) => setPartner(event.target.value)}
              className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-navy-700 focus:ring-2 focus:ring-navy-700/15"
            >
              {partnerOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="hidden md:block">
        {isLoading ? (
          <EmptyState
            title="Carregando clientes"
            description="Buscando dados da base operacional."
          />
        ) : filteredClients.length > 0 ? (
          <DataTable
            data={filteredClients}
            getRowKey={(client) => client.id}
            columns={[
              {
                key: "client",
                header: "Cliente",
                render: (client) => (
                  <div>
                    <p className="font-semibold text-slate-950">{client.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{client.document}</p>
                  </div>
                )
              },
              {
                key: "status",
                header: "Status",
                render: (client) => <StatusBadge status={client.status} />
              },
              {
                key: "processes",
                header: "Processos",
                render: (client) => getProcessCountLabel(client)
              },
              {
                key: "partner",
                header: "Parceiro",
                render: (client) => getPartnerLabel(client)
              },
              {
                key: "action",
                header: "Ação",
                render: (client) => (
                  <Link
                    href={`/clientes/${client.id}`}
                    className="font-semibold text-navy-800 hover:text-navy-700"
                  >
                    Abrir
                  </Link>
                )
              }
            ]}
          />
        ) : (
          emptyState
        )}
      </div>

      <div className="grid gap-3 md:hidden">
        {isLoading ? (
          <EmptyState
            title="Carregando clientes"
            description="Buscando dados da base operacional."
          />
        ) : filteredClients.length > 0
          ? filteredClients.map((client) => (
              <ClientCard key={client.id} client={client} />
            ))
          : emptyState}
      </div>

      {DRIVE_ROOT_FOLDER_ID && (
        <DriveBrowser
          isOpen={isDriveBrowserOpen}
          rootFolderId={DRIVE_ROOT_FOLDER_ID}
          rootFolderName="Escritório Boos"
          onClose={() => setIsDriveBrowserOpen(false)}
        />
      )}

      <ClientFormModal
        key={`client-form-${isClientModalOpen ? "open" : "closed"}`}
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        onSubmit={createClient}
      />
      <ProcessFormModal
        key={`process-form-${isProcessModalOpen ? "open" : "closed"}`}
        clients={clients}
        isOpen={isProcessModalOpen}
        onClose={() => setIsProcessModalOpen(false)}
        onSubmit={createProcess}
      />
    </section>
  );
}
