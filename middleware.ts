import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rotas públicas — login e rotas com segredo próprio
  if (
    pathname.startsWith("/login") ||
    pathname === "/api/drive/sync" ||
    pathname === "/api/drive/ai-read" ||
    pathname === "/api/drive/scan-full" ||
    pathname === "/api/drive/sheets-sync" ||
    pathname === "/api/drive/processos/criar-pastas"
  ) {
    return NextResponse.next();
  }

  const { user, response } = await getSessionUser(request);

  if (!user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo-baz\\.png).*)"],
};
