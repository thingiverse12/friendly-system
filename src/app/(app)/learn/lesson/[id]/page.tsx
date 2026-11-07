import { notFound } from "next/navigation";
import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { Markdown } from "@/components/Markdown";
import { LessonActions } from "@/components/LessonActions";
import { getSession } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await getSession();
  const db = admin();
  const { data: lesson } = await db.from("lessons").select("id,title,body,xp_reward,sort,chapter_id,chapters(id,title,subject_id,subjects(name,icon))").eq("id", id).maybeSingle();
  if (!lesson) notFound();
  const ch = lesson.chapters as unknown as { id: string; title: string; subject_id: string; subjects: { name: string; icon: string } };
  const [{ data: done }, { data: siblings }] = await Promise.all([
    db.from("lesson_progress").select("lesson_id").eq("user_id", profile!.id).eq("lesson_id", id).maybeSingle(),
    db.from("lessons").select("id,title,sort").eq("chapter_id", lesson.chapter_id).order("sort"),
  ]);
  const idx = (siblings ?? []).findIndex((s) => s.id === id);
  const next = idx >= 0 ? siblings?.[idx + 1] : null;
  return (
    <>
      <TopBar title={ch.subjects.name} back={`/learn/${ch.subject_id}`} />
      <div className="page">
        <p className="muted text-[12px]">{ch.subjects.icon} {ch.title} · Lektion {idx + 1} av {siblings?.length ?? 1}</p>
        <h2 className="text-[22px] font-extrabold mt-1">{lesson.title}</h2>
        <div className="flex gap-2 mt-2"><span className="pill e">+{lesson.xp_reward} XP vid klar</span><span className="pill">✅ Verifierat innehåll</span></div>
        <div className="card mt-4">
          <Markdown>{lesson.body}</Markdown>
        </div>
        <LessonActions id={id} alreadyDone={!!done} nextHref={next ? `/learn/lesson/${next.id}` : `/learn/${ch.subject_id}`} nextLabel={next ? `Nästa: ${next.title}` : "Tillbaka till kapitel"} />
        <Link href={`/ai?ctx=${encodeURIComponent(`${ch.subjects.name}: ${lesson.title}`)}`} className="card interactive mt-3 flex items-center gap-3">
          <span className="text-2xl">🧠</span>
          <div><b className="text-[13px]">Fråga AI-läraren om lektionen</b><p className="muted text-[11px]">Får du inte ihop det? Be om en förklaring på ett annat sätt.</p></div>
        </Link>
      </div>
    </>
  );
}
