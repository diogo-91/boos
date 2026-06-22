import { NextResponse } from "next/server";
import { createSessionToken, COOKIE_NAME, SESSION_DAYS } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authPassword = process.env.AUTH_PASSWORD;
  const authSecret = process.env.AUTH_SECRET;

  if (!authPassword || !authSecret) {
    console.error("[Auth] AUTH_PASSWORD ou AUTH_SECRET não configurados no ambiente.");
    return NextResponse.json(
      { error: "Servidor não configurado corretamente." },
      { status: 500 }
    );
  }

  let body: { password?: string };
  try {
    body = (await request.json()) as { password?: string };
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  if (!body.password || body.password !== authPassword) {
    // Delay fixo para dificultar ataques de força bruta
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
  }

  const token = await createSessionToken(authSecret);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: SESSION_DAYS * 24 * 3600,
    path: "/",
  });

  return response;
}
