import type { ReactNode } from "react";
import { InfoItem } from "@/components/InfoItem";

type InfoGridProps = {
  items: {
    label: string;
    value?: ReactNode;
  }[];
};

export function InfoGrid({ items }: InfoGridProps) {
  return (
    <dl className="grid gap-2 sm:gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <InfoItem key={item.label} label={item.label} value={item.value} />
      ))}
    </dl>
  );
}
