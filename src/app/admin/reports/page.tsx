import { requireAdminPage } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { AdminAction } from "@/components/AdminAction";
export const dynamic = "force-dynamic";
export default async function Reports() {
  await requireAdminPage();
  const { data } = await admin().from("reports").select("*, reporter:profiles(alias)").order("created_at", { ascending: false }).limit(100);
  return (
    <div className="card overflow-x-auto">
      <table className="table">
        <thead><tr><th>Datum</th><th>Typ</th><th>Mål</th><th>Orsak</th><th>Av</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {(data ?? []).map((r) => (
            <tr key={r.id}>
              <td className="muted">{new Date(r.created_at).toLocaleDateString("sv-SE")}</td><td>{r.target_type}</td><td><code className="text-[10px]">{r.target_id}</code></td>
              <td className="max-w-[320px]">{r.reason}{r.resolution && <div className="muted text-[11px]">→ {r.resolution}</div>}</td>
              <td>{(r.reporter as unknown as { alias: string })?.alias ?? "—"}</td>
              <td><span className={`pill ${r.status === "open" ? "g" : ""}`}>{r.status}</span></td>
              <td className="flex gap-1">{r.status === "open" && <><AdminAction body={{ action: "resolve_report", id: r.id }} label="Lös" prompt={{ key: "resolution", text: "Åtgärd/kommentar:" }} /><AdminAction body={{ action: "resolve_report", id: r.id, dismiss: true }} label="Avfärda" /></>}</td>
            </tr>
          ))}
          {(data ?? []).length === 0 && <tr><td colSpan={7} className="muted text-center py-6">Inga rapporter.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
