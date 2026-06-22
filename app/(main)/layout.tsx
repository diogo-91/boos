import type { ReactNode } from "react";
import { OperationalDataProvider } from "@/components/OperationalDataProvider";
import { AppHeader } from "@/components/layout/AppHeader";

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <OperationalDataProvider>
      <AppHeader />
      {children}
    </OperationalDataProvider>
  );
}
