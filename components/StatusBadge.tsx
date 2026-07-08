import type { ClientStatus, ProcessStatus } from "@/lib/types";
import { STATUS_BADGE_CLASSES } from "@/lib/domain";

type StatusBadgeProps = {
  status: ClientStatus | ProcessStatus;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        STATUS_BADGE_CLASSES[status]
      ].join(" ")}
    >
      {status}
    </span>
  );
}
