import { admin } from "@/lib/supabase/admin";
import { AdminAction, AdminForm } from "@/components/AdminAction";
export const dynamic = "force-dynamic";
export default async function Schools() {
  const db = admin();
  const { data: schools } = await db.from("schools").select("id,name,city,verified,merged_into,created_at,classes(id,label,year,verified,join_code,profiles(count))").order("created_at", { ascending: false }).limit(200);
  return (
    <div className="grid gap-4">
      <div className="card">
        <div className="sec-title !text-[11px] mb-2">Slå ihop dubbletter</div>
        <AdminForm action="merge_school" label="Slå ihop" fields={[{ key: "from_id", label: "Dubblettens ID (tas bort)" }, { key: "into_id", label: "Behåll – skolans ID" }]} />
      </div>
      {(schools ?? []).filter((s) => !s.merged_into).map((s) => (
        <div key={s.id} className="card">
          <div className="flex items-center gap-2 flex-wrap">
            <b>{s.name}</b><span className="muted text-[12px]">{s.city}</span>
            <span className={`pill ${s.verified ? "e" : "g"}`}>{s.verified ? "verifierad" : "ej verifierad"}</span>
            <code className="muted text-[10px]">{s.id}</code>
            <span className="ml-auto"><AdminAction body={{ action: "verify_school", id: s.id, verified: !s.verified }} label={s.verified ? "Avverifiera" : "Verifiera"} /></span>
          </div>
          <div className="flex gap-2 flex-wrap mt-2">
            {(s.classes as { id: string; label: string; year: number; verified: boolean; join_code: string; profiles: { count: number }[] }[]).map((c) => (
              <span key={c.id} className="pill">{c.label} (åk {c.year}) · {c.profiles?.[0]?.count ?? 0} elever · kod {c.join_code.startsWith("X-") ? "stängd" : c.join_code} <AdminAction body={{ action: "verify_class", id: c.id, verified: !c.verified }} label={c.verified ? "✅" : "verifiera"} className="underline text-[10px]" /></span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
