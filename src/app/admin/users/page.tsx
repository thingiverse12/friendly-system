import { admin } from "@/lib/supabase/admin";
import { AdminAction } from "@/components/AdminAction";
import { levelForXp } from "@/lib/xp";
export const dynamic = "force-dynamic";
export default async function Users({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  let qu = admin().from("profiles").select("id,alias,avatar,xp,coins,role,created_at,last_active_at,classes(label,schools(name))").order("last_active_at", { ascending: false }).limit(100);
  if (q) qu = qu.ilike("alias", `%${q}%`);
  const { data } = await qu;
  return (
    <div>
      <form className="flex gap-2 mb-3"><input name="q" className="input" placeholder="Sök alias" defaultValue={q} /><button className="btn-ghost">Sök</button></form>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Alias</th><th>Klass</th><th>XP / Nivå</th><th>Mynt</th><th>Roll</th><th>Senast aktiv</th><th></th></tr></thead>
          <tbody>
            {(data ?? []).map((u) => {
              const c = u.classes as unknown as { label: string; schools: { name: string } } | null;
              return (
                <tr key={u.id}>
                  <td>{u.avatar} <b>{u.alias}</b></td>
                  <td className="muted">{c ? `${c.label} · ${c.schools?.name}` : "—"}</td>
                  <td>{u.xp} / {levelForXp(u.xp)}</td>
                  <td>{u.coins}</td>
                  <td><span className={`pill ${u.role === "admin" ? "g" : ""}`}>{u.role}</span></td>
                  <td className="muted">{new Date(u.last_active_at).toLocaleDateString("sv-SE")}</td>
                  <td className="flex gap-1 flex-wrap">
                    <AdminAction body={{ action: "adjust_xp", user_id: u.id }} label="± XP" prompt={{ key: "amount", text: "Justera XP med (t.ex. -100 eller 50):" }} />
                    {u.role !== "admin" ? <AdminAction body={{ action: "set_role", user_id: u.id, role: "admin" }} label="Gör admin" confirmText={`Gör ${u.alias} till admin?`} /> : <AdminAction body={{ action: "set_role", user_id: u.id, role: "student" }} label="Ta bort admin" confirmText="Ta bort adminroll?" />}
                    {u.role !== "teacher" && <AdminAction body={{ action: "set_role", user_id: u.id, role: "teacher" }} label="Lärare" />}
                    <AdminAction body={{ action: "delete_user", user_id: u.id }} label="Radera" className="btn-danger text-[11px] !py-1.5" confirmText={`Radera ${u.alias} permanent?`} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
