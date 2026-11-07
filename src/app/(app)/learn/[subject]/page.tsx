import Link from "next/link";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { requireProfile } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function SubjectPage({ params }: { params: Promise<{ subject: string }> }) {
  const { subject } = await params;
  const { profile } = await requireProfile();
  const db = admin();
  const { data: subj } = await db.from("subjects").select("*").eq("id", subject).maybeSingle();
  if (!subj) notFound();
  const [{ data: chapters }, { data: done }, { data: qcount }] = await Promise.all([
    db.from("chapters").select("id,title,year,sort,lessons(id,title,sort,xp_reward)").eq("subject_id", subject).order("year").order("sort"),
    db.from("lesson_progress").select("lesson_id").eq("user_id", profile.id),
    db.from("questions").select("chapter_id,difficulty").eq("subject_id", subject).eq("active", true).is("owner_id", null),
  ]);
  const doneSet = new Set((done ?? []).map((d) => d.lesson_id));
  const yearLabel = (y: number) => (y <= 9 ? `Årskurs ${y}` : `Gymnasiet år ${y - 9}`);
  const groups = new Map<number, typeof chapters>();
  for (const c of chapters ?? []) groups.set(c.year, [...(groups.get(c.year) ?? []), c]);
  return (
    <>
      <TopBar title={subj.name} back="/learn" />
      <div className="page">
        <div className="flex gap-2">
          <Link href={`/games/quick?subject=${subject}`} className="btn-gold flex-1">▶ Öva {subj.name}</Link>
          <Link href={`/games/blackjack?subject=${subject}`} className="btn-ghost">🃏</Link>
        </div>
        {[...groups.entries()].map(([year, chs]) => (
          <div className="sec" key={year}>
            <div className="sec-title">{yearLabel(year)}</div>
            {(chs ?? []).map((c) => {
              const lessons = [...(c.lessons as { id: string; title: string; sort: number; xp_reward: number }[])].sort((a, b) => a.sort - b.sort);
              const nq = (qcount ?? []).filter((q) => q.chapter_id === c.id).length;
              return (
                <div key={c.id} className="card mt-3">
                  <div className="flex items-center justify-between">
                    <b className="text-[15px]">{c.title}</b>
                    <span className="pill">{nq} frågor</span>
                  </div>
                  <div className="grid gap-2 mt-3">
                    {lessons.map((l, i) => (
                      <Link key={l.id} href={`/learn/lesson/${l.id}`} className="opt !py-3">
                        <span className="k">{doneSet.has(l.id) ? "✓" : i + 1}</span>
                        <span className="flex-1 text-[14px]">{l.title}</span>
                        <span className="pill e">+{l.xp_reward} XP</span>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        {(chapters ?? []).length === 0 && <div className="card mt-4 muted text-[13px]">Inga lektioner ännu i detta ämne – men du kan öva frågor via spel.</div>}
      </div>
    </>
  );
}
