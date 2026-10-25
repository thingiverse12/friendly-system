import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Supabase Auth owns credentials. The client keeps the access token in memory/localStorage and
 * sends it to our API exactly once per login, where it is exchanged for a server-side session.
 */
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce',
        },
      })
    : null;

export const supabaseConfigured = Boolean(supabase);

/** Swedish messages for the auth errors users actually hit. */
export function translateAuthError(message: string): string {
  const text = message.toLowerCase();
  if (text.includes('invalid login credentials')) return 'E-post eller lösenord stämmer inte.';
  if (text.includes('email not confirmed')) return 'Bekräfta din e-postadress innan du loggar in.';
  if (text.includes('user already registered')) return 'Det finns redan ett konto med den e-postadressen.';
  if (text.includes('password should be at least')) return 'Lösenordet är för kort. Använd minst 8 tecken.';
  if (text.includes('rate limit') || text.includes('too many')) return 'För många försök. Vänta en stund och försök igen.';
  if (text.includes('duplicate key') || text.includes('already registered')) return 'Det finns redan ett konto med den e-postadressen.';
  if (text.includes('database error')) return 'Kontot kunde inte skapas just nu. Försök igen.';
  if (text.includes('failed to fetch') || text.includes('network')) return 'Kunde inte nå inloggningstjänsten. Kontrollera din anslutning.';
  return message;
}

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase är inte konfigurerat. Sätt VITE_SUPABASE_URL och VITE_SUPABASE_ANON_KEY vid bygget.',
    );
  }
  return supabase;
}
