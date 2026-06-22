import type { ReactNode } from "react";

type InfoItemProps = {
  label: string;
  value?: ReactNode;
};

export function InfoItem({ label, value }: InfoItemProps) {
  return (
    <div className="min-w-0 rounded-md border border-slate-100 bg-slate-50 p-2.5 sm:p-3">
      <dt className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-medium leading-5 text-slate-900">
        {value || "—"}
      </dd>
    </div>
  );
}
