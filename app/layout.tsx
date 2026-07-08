import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Base Operacional — Escritório Boos",
  description: "Interface interna para gestão de clientes e processos jurídicos."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
