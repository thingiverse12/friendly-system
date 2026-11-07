import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { createClient } from "./supabase/server";
import { admin } from "./supabase/admin";
import type { Profile } from "./types";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await admin().from("profiles").select("*").eq("id", userId).maybeSingle();
  return (data as Profile | null) ?? null;
}

/** For server components: user + profile (profile may be null before onboarding). */
export async function getSession() {
  const user = await getUser();
  if (!user) return { user: null, profile: null };
  const profile = await getProfile(user.id);
  return { user, profile };
}

/** For server pages: redirects to /login or /onboarding unless signed in with a profile.
 *  Needed because Next renders layout and page in parallel, so a layout redirect alone
 *  doesn't stop the page from executing. */
export async function requireProfile() {
  const { user, profile } = await getSession();
  if (!user) redirect("/login");
  if (!profile) redirect("/onboarding");
  return { user, profile };
}

/** For admin pages: same as requireProfile, plus role check (defense in depth beside admin/layout). */
export async function requireAdminPage() {
  const r = await requireProfile();
  if (r.profile.role !== "admin") redirect("/home");
  return r;
}

/** For route handlers: throws HttpError(401/403) unless signed in with a profile. */
export async function requireUser(opts: { admin?: boolean; allowNoProfile?: boolean } = {}) {
  const user = await getUser();
  if (!user) throw new HttpError(401, "Inte inloggad");
  const profile = await getProfile(user.id);
  if (!profile && !opts.allowNoProfile) throw new HttpError(403, "Profil saknas");
  if (opts.admin && profile?.role !== "admin") throw new HttpError(403, "Kräver adminbehörighet");
  return { user, profile: profile as Profile };
}

/** Wrap a route handler: JSON errors, HttpError mapping, never leaks stack traces. */
export function handler<C = unknown>(fn: (req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      console.error(e);
      return NextResponse.json({ error: "Något gick fel" }, { status: 500 });
    }
  };
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "Ogiltig JSON");
  }
}

export async function logSecurity(userId: string | null, kind: string, severity: "info" | "warning" | "review", details?: unknown) {
  await admin().from("security_events").insert({ user_id: userId, kind, severity, details: details ?? null });
}

/** Simple DB-backed rate limit: max `limit` events of `kind` per user in `windowSec`. */
export async function rateLimit(userId: string, kind: string, limit: number, windowSec: number) {
  const since = new Date(Date.now() - windowSec * 1000).toISOString();
  const { count } = await admin()
    .from("security_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("kind", `rl:${kind}`)
    .gte("created_at", since);
  if ((count ?? 0) >= limit) {
    await logSecurity(userId, "rate_limited", "warning", { kind, limit, windowSec });
    throw new HttpError(429, "För många förfrågningar – vänta en stund.");
  }
  await admin().from("security_events").insert({ user_id: userId, kind: `rl:${kind}`, severity: "info" });
}
