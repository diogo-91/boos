export const COOKIE_NAME = "boos_session";
export const SESSION_DAYS = 7;

async function hmacSign(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacVerify(secret: string, data: string, signature: string): Promise<boolean> {
  const expected = await hmacSign(secret, data);
  if (expected.length !== signature.length) return false;
  // Comparação em tempo constante para evitar timing attacks
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

export async function createSessionToken(secret: string): Promise<string> {
  const expires = Math.floor(Date.now() / 1000) + SESSION_DAYS * 24 * 3600;
  const data = String(expires);
  const sig = await hmacSign(secret, data);
  return `${data}.${sig}`;
}

export async function verifySessionToken(token: string, secret: string): Promise<boolean> {
  const dotIndex = token.indexOf(".");
  if (dotIndex === -1) return false;
  const data = token.slice(0, dotIndex);
  const sig = token.slice(dotIndex + 1);
  const expires = parseInt(data, 10);
  if (isNaN(expires) || Date.now() / 1000 > expires) return false;
  return hmacVerify(secret, data, sig);
}
