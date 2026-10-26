import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

export function uuid(): string {
  return randomUUID();
}

/** URL-safe random token, 256 bits of entropy by default. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

const ALIAS_ALPHABET = 'abcdefghijkmnopqrstuvwxyz23456789';

/** Human-friendly random suffix for suggested aliases (never used as a secret). */
export function randomSuffix(length = 3): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += ALIAS_ALPHABET[bytes[i]! % ALIAS_ALPHABET.length];
  return out;
}

export function normalizeAlias(alias: string): string {
  return alias
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function randomAlias(): string {
  return `sparlygd_${randomSuffix(3)}${randomSuffix(2)}`;
}
