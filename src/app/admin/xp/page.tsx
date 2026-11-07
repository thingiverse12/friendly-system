import { admin } from "@/lib/supabase/admin";
export const dynamic = "force-dynamic";
export default async function Xp({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  let qu = admin().from("xp_events").select("*, profiles!inner(alias)").order("created_at", { ascending: false }).limit(200);
  if (q) qu = qu.ilike("profiles.alias", `%${q}%`);
  const { data } = await qu;
  return (
    <div>
      <form className="flex gap-2 mb-3"><input name="q" className="input" placeholder="Filtrera på alias" defaultValue={q} /><button className="btn-ghost">Sök</button></form>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Tid</th><th>Användare</th><th>XP</th><th>Mynt</th><th>Orsak</th><th>Runda</th></tr></thead>
          <tbody>{(data ?? []).map((e) => <tr key={e.id}><td className="muted">{new Date(e.created_at).toLocaleString("sv-SE")}</td><td>{(e.profiles as unknown as { alias: string })?.alias}</td><td className={e.amount < 0 ? "danger" : "emerald"}>{e.amount > 0 ? "+" : ""}{e.amount}</td><td>{e.coins}</td><td>{e.reason}</td><td><code className="text-[10px]">{e.session_id?.slice(0, 8) ?? "—"}</code></td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
