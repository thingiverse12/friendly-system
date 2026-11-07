/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client. SERVER ONLY. Bypasses RLS, so every caller must verify
 * the user (see requireUser) and scope queries explicitly.
 * Typed loosely (no generated Database types) – row shapes are asserted at call sites.
 */
let cached: SupabaseClient<any, "public", any> | null = null;
export function admin(): SupabaseClient<any, "public", any> {
  if (!cached) {
    cached = createClient<any, "public", any>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
