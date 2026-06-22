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

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const secret = process.env.AUTH_SECRET ?? "";

  const isValid = token && secret && (await verifySessionToken(token, secret));

  if (!isValid) {
    // Rotas de API retornam 401; páginas redirecionam para login
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Protege todas as rotas exceto arquivos estáticos do Next.js e assets públicos
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo-baz\\.png).*)"],
};
