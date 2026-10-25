import { hash, verify } from '@node-rs/argon2';

/**
 * Argon2id parameters following OWASP's minimum recommendation:
 * m = 19 MiB, t = 2, p = 1, 32-byte output.
 */
const ARGON_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON_OPTIONS);
}

export async function verifyPassword(passwordHash: string, plain: string): Promise<boolean> {
  try {
    return await verify(passwordHash, plain);
  } catch {
    return false;
  }
}

/** Constant-ish work for unknown accounts so login timing does not reveal which e-mails exist. */
const DUMMY_HASH = await hashPassword('sparly-dummy-password-for-timing');

export async function verifyDummy(plain: string): Promise<void> {
  await verifyPassword(DUMMY_HASH, plain);
}

export interface PasswordPolicyResult {
  ok: boolean;
  message?: string;
}

export function checkPasswordPolicy(password: string): PasswordPolicyResult {
  if (password.length < 10) return { ok: false, message: 'Lösenordet måste vara minst 10 tecken.' };
  if (password.length > 200) return { ok: false, message: 'Lösenordet får vara högst 200 tecken.' };
  if (!/[a-zA-ZåäöÅÄÖ]/.test(password) || !/\d/.test(password)) {
    return { ok: false, message: 'Lösenordet måste innehålla både bokstäver och siffror.' };
  }
  if (/^(.)\1+$/.test(password)) return { ok: false, message: 'Välj ett starkare lösenord.' };
  return { ok: true };
}
