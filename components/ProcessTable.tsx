import Link from "next/link";
import type { LegalProcess } from "@/lib/types";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";

type ProcessTableProps = {
  processes: LegalProcess[];
};

export function ProcessTable({ processes }: ProcessTableProps) {
  return (
    <DataTable
      data={processes}
      getRowKey={(process) => process.id}
      emptyMessage="Nenhum processo vinculado a este cliente."
      columns={[
        {
          key: "number",
          header: "Nº do processo",
          render: (process) => (
            <span className="font-medium text-slate-950">{process.number}</span>
          )
        },
        {
          key: "actionType",
          header: "Tipo de ação",
          render: (process) => process.actionType
        },
        {
          key: "status",
          header: "Status do processo",
          render: (process) => <StatusBadge status={process.status} />
        },
        {
          key: "billingModel",
          header: "Modelo de cobrança",
          render: (process) => process.billingModel
        },
        {
          key: "location",
          header: "Localização do processo",
          render: (process) => process.location
        },
        {
          key: "action",
          header: "Ação",
          render: (process) => (
            <Link
              href={`/processos/${process.id}`}
              className="font-semibold text-navy-800 hover:text-navy-700"
            >
              Abrir
            </Link>
          )
        }
      ]}
    />
  );
}
