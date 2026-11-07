import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Keeps the Supabase session cookie fresh. To avoid a network roundtrip to Supabase on
 * EVERY navigation we first decode the access token's expiry locally (no verification
 * needed – pages and API routes always verify with getUser themselves) and only call
 * the auth server when the token is missing/expiring within 5 minutes.
 */
function tokenExpiry(request: NextRequest): number | null {
  try {
    const all = request.cookies.getAll().filter((c) => /^sb-.*-auth-token(\.\d+)?$/.test(c.name));
    if (!all.length) return null;
    const base = all.find((c) => !/\.\d+$/.test(c.name));
    let raw: string;
    if (base) raw = base.value;
    else raw = all.sort((a, b) => Number(a.name.split(".").pop()) - Number(b.name.split(".").pop())).map((c) => c.value).join("");
    if (raw.startsWith("base64-")) raw = atob(raw.slice(7).replace(/-/g, "+").replace(/_/g, "/"));
    const parsed = JSON.parse(raw) as { expires_at?: number; access_token?: string };
    if (parsed.expires_at) return parsed.expires_at * 1000;
    if (parsed.access_token) {
      const payload = JSON.parse(atob(parsed.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number };
      return payload.exp ? payload.exp * 1000 : null;
    }
    return null;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const exp = tokenExpiry(request);
  const hasCookie = request.cookies.getAll().some((c) => /^sb-.*-auth-token/.test(c.name));
  if (!hasCookie || (exp !== null && exp - Date.now() > 5 * 60_000)) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );
  await supabase.auth.getUser(); // refreshes the token and syncs cookies
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|manifest.webmanifest|sw.js|offline.html).*)"],
};
