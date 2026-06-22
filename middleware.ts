import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rotas públicas — login, autenticação e rotas com segredo próprio
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/api/drive/sync" ||
    pathname === "/api/drive/ai-read" ||
    pathname === "/api/drive/scan-full" ||
    pathname === "/api/drive/sheets-sync" ||
    pathname === "/api/drive/processos/criar-pastas"
  ) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  // Protege todas as rotas exceto arquivos estáticos do Next.js e assets públicos
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo-baz\\.png).*)"],
};
