import { timingSafeEqual } from "crypto";

// `secret !== process.env.DRIVE_SYNC_SECRET` compara string por string
// normal — teoricamente vaza tempo de comparação e permite descobrir o
// segredo caractere a caractere. timingSafeEqual evita isso, mas exige
// buffers do mesmo tamanho (senão lança), por isso a checagem de tamanho
// antes.
export function isValidSyncSecret(request: Request): boolean {
  const provided = request.headers.get("x-sync-secret");
  const expected = process.env.DRIVE_SYNC_SECRET;

  if (!provided || !expected) return false;

  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);

  if (providedBuf.length !== expectedBuf.length) return false;

  return timingSafeEqual(providedBuf, expectedBuf);
}
