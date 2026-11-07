import { admin } from "@/lib/supabase/admin";
import { AdminAction } from "@/components/AdminAction";
import { QuestionEditor } from "@/components/QuestionEditor";
export const dynamic = "force-dynamic";
export default async function Questions({ searchParams }: { searchParams: Promise<{ subject?: string; source?: string; q?: string }> }) {
  const sp = await searchParams;
  const db = admin();
  const [{ data: subjects }, { data: chapters }] = await Promise.all([db.from("subjects").select("id,name,active").order("sort"), db.from("chapters").select("id,title,subject_id").order("sort")]);
  let qu = db.from("questions").select("id,subject_id,difficulty,qtype,prompt,explanation,source,active,owner_id,created_at").order("created_at", { ascending: false }).limit(150);
  if (sp.subject) qu = qu.eq("subject_id", sp.subject);
  if (sp.source) qu = qu.eq("source", sp.source);
  if (sp.q) qu = qu.ilike("prompt", `%${sp.q}%`);
  const { data } = await qu;
  return (
    <div className="grid gap-4">
      <div className="card">
        <div className="sec-title !text-[11px] mb-2">Ämnen</div>
        <div className="flex gap-2 flex-wrap">
          {(subjects ?? []).map((s) => <span key={s.id} className={`pill ${s.active ? "" : "r"}`}>{s.name} <AdminAction body={{ action: "toggle_subject", id: s.id, active: !s.active }} label={s.active ? "Dölj" : "Visa"} className="underline text-[10px]" /></span>)}
        </div>
      </div>
      <QuestionEditor subjects={(subjects ?? []).map((s) => ({ id: s.id, name: s.name }))} chapters={chapters ?? []} />
      <form className="flex gap-2 flex-wrap">
        <select name="subject" className="input !w-auto" defaultValue={sp.subject}><option value="">Alla ämnen</option>{(subjects ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <select name="source" className="input !w-auto" defaultValue={sp.source}><option value="">Alla källor</option><option value="verified">Verifierade</option><option value="ai">AI-genererade</option></select>
        <input name="q" className="input !w-auto flex-1" placeholder="Sök i frågetext" defaultValue={sp.q} />
        <button className="btn-ghost">Filtrera</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Fråga</th><th>Ämne</th><th>Nivå</th><th>Typ</th><th>Källa</th><th></th></tr></thead>
          <tbody>
            {(data ?? []).map((q) => (
              <tr key={q.id} className={q.active ? "" : "opacity-50"}>
                <td className="max-w-[420px]"><div className="truncate" title={q.prompt}>{q.prompt}</div><div className="muted text-[11px] truncate">{q.explanation}</div></td>
                <td>{q.subject_id}</td><td>{q.difficulty}</td><td>{q.qtype}</td>
                <td><span className={`pill ${q.source === "verified" ? "e" : "p"}`}>{q.source}</span></td>
                <td className="flex gap-1 flex-wrap">
                  <AdminAction body={{ action: "toggle_question", id: q.id, active: !q.active }} label={q.active ? "Inaktivera" : "Aktivera"} />
                  <AdminAction body={{ action: "update_question", id: q.id }} label="Ändra text" prompt={{ key: "prompt", text: "Ny frågetext:" }} />
                  <AdminAction body={{ action: "update_question", id: q.id }} label="Förklaring" prompt={{ key: "explanation", text: "Ny förklaring:" }} />
                  {q.source !== "verified" && <AdminAction body={{ action: "update_question", id: q.id, verify: true }} label="Verifiera & publicera" confirmText="Gör frågan verifierad och publik för alla?" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
