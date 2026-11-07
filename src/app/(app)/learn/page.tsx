import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { SubNav, NAV_LEARN } from "@/components/SubNav";
import { requireProfile } from "@/lib/auth";
import { getSubjects } from "@/lib/data";
import { admin } from "@/lib/supabase/admin";
import { recommend } from "@/lib/engine";
import { DIFF_LABEL } from "@/lib/xp";

export const metadata = { title: "Lär" };
export const dynamic = "force-dynamic";

export default async function Learn() {
  const { profile } = await requireProfile();
  const db = admin();
  const [subjects, rec, { data: lessons }, { data: done }, { data: materials }] = await Promise.all([
    getSubjects(), recommend(profile.id),
    db.from("lessons").select("id,chapters(subject_id)"),
    db.from("lesson_progress").select("lesson_id").eq("user_id", profile.id),
    db.from("materials").select("id,title,status,created_at").eq("user_id", profile.id).order("created_at", { ascending: false }).limit(3),
  ]);
  const doneSet = new Set((done ?? []).map((d) => d.lesson_id));
  const per = new Map<string, { total: number; done: number }>();
  for (const l of lessons ?? []) {
    const sid = (l.chapters as unknown as { subject_id: string })?.subject_id;
    const p = per.get(sid) ?? { total: 0, done: 0 };
    p.total++;
    if (doneSet.has(l.id)) p.done++;
    per.set(sid, p);
  }
  return (
    <>
      <TopBar title="Lär" />
      <SubNav items={NAV_LEARN} />
      <div className="page">
        <Link href="/learn/materials" className="card purple interactive">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📄</span>
            <div className="flex-1">
              <b className="text-[14px]">Eget material → AI-studiepaket</b>
              <p className="muted text-[12px]">Klistra in anteckningar: få sammanfattning, begrepp, flashcards och övningsfrågor.</p>
            </div>
            <span className="gold">›</span>
          </div>
          {materials && materials.length > 0 && <p className="muted text-[11px] mt-2">Senast: {materials.map((m) => m.title).join(" · ")}</p>}
        </Link>
        <div className="sec">
          <div className="sec-title">Ämnen</div>
          <div className="grid gap-2.5 mt-3">
            {subjects.map((s) => {
              const p = per.get(s.id) ?? { total: 0, done: 0 };
              const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
              const ks = rec.perSubject[s.id];
              return (
                <Link key={s.id} href={`/learn/${s.id}`} className="card interactive flex items-center gap-3 !py-3">
                  <div className="w-11 h-11 rounded-xl grid place-items-center text-2xl" style={{ background: `linear-gradient(135deg, ${s.color}, #0a0d0b)` }}>{s.icon}</div>
                  <div className="flex-1 min-w-0">
                    <b className="block text-[14px]">{s.name}</b>
                    <p className="muted text-[11px]">
                      {p.done}/{p.total} lektioner · nivå {DIFF_LABEL[ks?.difficulty ?? "easy"]}{ks?.accuracy !== null && ks?.accuracy !== undefined ? ` · ${Math.round(ks.accuracy * 100)} % rätt` : ""}
                    </p>
                  </div>
                  <div className="ring" style={{ ["--pct" as string]: `${pct}%` }}><i>{pct}%</i></div>
                </Link>
              );
            })}
          </div>
        </div>
        <Link href="/ai" className="card interactive mt-6 flex items-center gap-3">
          <span className="text-3xl">🧠</span>
          <div><b className="text-[14px]">AI-läraren</b><p className="muted text-[12px]">Ställ frågor, få förklaringar steg för steg – aldrig bara facit.</p></div>
        </Link>
      </div>
    </>
  );
}
