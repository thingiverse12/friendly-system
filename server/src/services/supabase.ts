import { config } from '../config.js';
import { forbidden, unauthorized } from '../lib/errors.js';

/** Identity proven by Supabase Auth. The app never sees or stores passwords. */
export interface SupabaseIdentity {
  id: string;
  email: string;
  emailVerified: boolean;
}

export interface AuthProvider {
  /** Verifies a Supabase access token and returns the proven identity. */
  verify(accessToken: string): Promise<SupabaseIdentity>;
  /** Deletes the Supabase Auth user (server-side, service-role key only). */
  deleteUser(userId: string): Promise<void>;
}

function requireSupabaseConfig(): { url: string; anonKey: string | null; serviceRole: string | null } {
  if (!config.supabaseUrl) throw new Error('SUPABASE_URL is not configured');
  return {
    url: config.supabaseUrl.replace(/\/$/, ''),
    anonKey: config.supabaseAnonKey,
    serviceRole: config.supabaseServiceRoleKey,
  };
}

/**
 * Production provider: asks Supabase Auth who the token belongs to. This is the only network call
 * involved in authentication, and it happens once per login (when the app session is created) —
 * never on ordinary API requests, which use the server-side session.
 */
export function createSupabaseAuthProvider(): AuthProvider {
  return {
    async verify(accessToken: string) {
      if (!accessToken) throw unauthorized('Inloggningstoken saknas.');
      const { url, anonKey } = requireSupabaseConfig();
      if (!anonKey) throw new Error('SUPABASE_ANON_KEY is not configured');
      const response = await fetch(`${url}/auth/v1/user`, {
        method: 'GET',
        headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
      });
      if (response.status === 401 || response.status === 403) {
        throw unauthorized('Inloggningen har gått ut. Logga in igen.');
      }
      if (!response.ok) {
        throw new Error(`Supabase Auth svarade ${response.status}`);
      }
      const body = (await response.json()) as {
        id?: string;
        email?: string;
        email_confirmed_at?: string | null;
        confirmed_at?: string | null;
      };
      if (!body.id || !body.email) throw unauthorized('Inloggningen kunde inte verifieras.');
      return {
        id: body.id,
        email: body.email.toLowerCase(),
        emailVerified: Boolean(body.email_confirmed_at ?? body.confirmed_at),
      };
    },

    async deleteUser(userId: string) {
      const { url, serviceRole } = requireSupabaseConfig();
      if (!serviceRole) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
      const response = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}` },
      });
      if (!response.ok && response.status !== 404) {
        throw forbidden('Kunde inte ta bort inloggningen. Försök igen.');
      }
    },
  };
}

/**
 * Test-only provider. Mirrors the production contract without network access: a token of the form
 * `test:<uuid>:<email>` identifies that user. Enabled only with NODE_ENV=test.
 */
export function createTestAuthProvider(): AuthProvider {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('createTestAuthProvider is only available in tests');
  }
  const known = new Map<string, SupabaseIdentity>();
  return {
    async verify(accessToken: string) {
      const match = /^test:([0-9a-f-]{36}):(.+)$/i.exec(accessToken);
      if (!match) throw unauthorized('Inloggningen har gått ut. Logga in igen.');
      const [, id, email] = match as unknown as [string, string, string];
      const identity = { id, email: email.toLowerCase(), emailVerified: true };
      known.set(id, identity);
      return identity;
    },
    async deleteUser(userId: string) {
      known.delete(userId);
    },
  };
}

export function defaultAuthProvider(): AuthProvider {
  if (process.env.NODE_ENV === 'test' && process.env.SUPABASE_TEST_AUTH !== '0') {
    return createTestAuthProvider();
  }
  return createSupabaseAuthProvider();
}
