import { requireAdminPage } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
export const dynamic = "force-dynamic";
export default async function Security({ searchParams }: { searchParams: Promise<{ sev?: string }> }) {
  await requireAdminPage();
  const { sev } = await searchParams;
  let q = admin().from("security_events").select("*, profiles(alias)").not("kind", "like", "rl:%").order("created_at", { ascending: false }).limit(200);
  if (sev) q = q.eq("severity", sev);
  const { data } = await q;
  // Per-user summary of fast answers in last 7 days
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: fast } = await admin().from("security_events").select("user_id, profiles(alias)").eq("kind", "fast_answer").gte("created_at", since);
  const agg = new Map<string, { alias: string; n: number }>();
  for (const f of fast ?? []) { const a = agg.get(f.user_id ?? "") ?? { alias: (f.profiles as unknown as { alias: string })?.alias ?? "?", n: 0 }; a.n++; agg.set(f.user_id ?? "", a); }
  const levels = [...agg.values()].sort((a, b) => b.n - a.n).slice(0, 10);
  return (
    <div className="grid gap-4">
      <div className="card">
        <div className="sec-title !text-[11px] mb-2">AI-anticheat · snabba svar senaste 7 dagarna</div>
        <p className="muted text-[11px] mb-2">Nivåer: Normal (&lt;10), Varning (10–29), Kräver granskning (≥30). Inga automatiska avstängningar – detta är underlag för manuell bedömning.</p>
        <div className="flex gap-2 flex-wrap">{levels.length === 0 && <span className="muted text-[12px]">Inget flaggat.</span>}{levels.map((l) => <span key={l.alias} className={`pill ${l.n >= 30 ? "r" : l.n >= 10 ? "g" : "e"}`}>{l.alias}: {l.n} · {l.n >= 30 ? "Kräver granskning" : l.n >= 10 ? "Varning" : "Normal"}</span>)}</div>
      </div>
      <div className="flex gap-2">{["", "info", "warning", "review"].map((s) => <a key={s} href={`/admin/security${s ? `?sev=${s}` : ""}`} className={`pill ${sev === s || (!sev && !s) ? "g" : ""}`}>{s || "alla"}</a>)}</div>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Tid</th><th>Användare</th><th>Händelse</th><th>Nivå</th><th>Detaljer</th></tr></thead>
          <tbody>{(data ?? []).map((e) => <tr key={e.id}><td className="muted">{new Date(e.created_at).toLocaleString("sv-SE")}</td><td>{(e.profiles as unknown as { alias: string })?.alias ?? "—"}</td><td>{e.kind}</td><td><span className={`pill ${e.severity === "review" ? "r" : e.severity === "warning" ? "g" : ""}`}>{e.severity}</span></td><td className="muted text-[11px] max-w-[380px] truncate">{JSON.stringify(e.details)}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
