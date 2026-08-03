"use client";

import { useEffect } from "react";

// app/error.tsx não cobre erros no próprio root layout — só este arquivo
// pega esse caso, e por isso precisa renderizar <html>/<body> do zero.
export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center bg-navy-900 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-2xl">
            <h1 className="text-xl font-semibold text-navy-900">Algo deu errado</h1>
            <p className="mt-2 text-sm text-gray-500">
              Ocorreu um erro inesperado ao carregar a aplicação. Tente recarregar a página.
            </p>
            <button
              onClick={reset}
              className="mt-6 w-full rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-800"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
