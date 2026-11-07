import { requireAdminPage } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
export const dynamic = "force-dynamic";
export default async function AdminHome() {
  await requireAdminPage();
  const db = admin();
  const count = async (t: string, f?: (q: ReturnType<ReturnType<typeof admin>["from"]>["select"] extends (...a: never[]) => infer R ? R : never) => unknown) => {
    let q = db.from(t).select("*", { count: "exact", head: true });
    if (f) q = f(q) as typeof q;
    const { count } = await q;
    return count ?? 0;
  };
  const since = new Date(Date.now() - 86400000 * 7).toISOString();
  const [users, questions, aiq, schools, classes, sessions, reports, review, xp] = await Promise.all([
    count("profiles"), count("questions"), count("questions", (q) => q.eq("source", "ai")), count("schools", (q) => q.is("merged_into", null)), count("classes"),
    count("game_sessions", (q) => q.gte("created_at", since)), count("reports", (q) => q.eq("status", "open")), count("security_events", (q) => q.eq("severity", "review")),
    db.from("xp_events").select("amount").gte("created_at", since).then((r) => (r.data ?? []).reduce((a, e) => a + e.amount, 0)),
  ]);
  const cards = [["Användare", users], ["Frågor (varav AI)", `${questions} (${aiq})`], ["Skolor / klasser", `${schools} / ${classes}`], ["Rundor senaste 7 d", sessions], ["XP utdelat 7 d", xp], ["Öppna rapporter", reports], ["Säkerhet: kräver granskning", review]];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map(([l, v]) => <div key={String(l)} className="stat"><b>{String(v)}</b><span>{l}</span></div>)}
      <div className="card md:col-span-4 text-[12px] muted">
        Admin-principer: all poängräkning sker på servern; inga automatiska avstängningar – säkerhetsflaggor är underlag för manuell granskning. Alla adminåtgärder loggas i säkerhetsloggen (admin:*).
      </div>
    </div>
  );
}
