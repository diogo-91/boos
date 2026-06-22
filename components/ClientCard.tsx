import Link from "next/link";
import type { Client } from "@/lib/types";
import { getPartnerLabel, getProcessCountLabel } from "@/lib/client-view-model";
import { StatusBadge } from "@/components/StatusBadge";

type ClientCardProps = {
  client: Client;
};

export function ClientCard({ client }: ClientCardProps) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-soft sm:p-4">
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div>
          <h3 className="font-semibold text-slate-950">{client.name}</h3>
          <p className="mt-1 text-sm text-slate-500">{client.document}</p>
        </div>
        <StatusBadge status={client.status} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:mt-4 sm:gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Processos
          </p>
          <p className="mt-1 font-medium text-slate-900">
            {getProcessCountLabel(client)}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Parceiro
          </p>
          <p className="mt-1 font-medium text-slate-900">{getPartnerLabel(client)}</p>
        </div>
      </div>

      <Link
        href={`/clientes/${client.id}`}
        className="mt-3 inline-flex rounded-md bg-navy-800 px-2 py-1.5 text-xs font-semibold text-white transition hover:bg-navy-700 sm:mt-4 sm:px-3 sm:py-2 sm:text-sm"
      >
        Abrir
      </Link>
    </article>
  );
}
