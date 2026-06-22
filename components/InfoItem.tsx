import type { ReactNode } from "react";

type InfoItemProps = {
  label: string;
  value?: ReactNode;
};

export function InfoItem({ label, value }: InfoItemProps) {
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium leading-6 text-slate-900">
        {value || "—"}
      </dd>
    </div>
  );
}
