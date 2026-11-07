import { admin } from "./supabase/admin";
import { todayKey, weekRange } from "./xp";
import type { Subject } from "./types";

export async function getSubjects(): Promise<Subject[]> {
  const { data } = await admin().from("subjects").select("*").eq("active", true).order("sort");
  return (data ?? []) as Subject[];
}

export async function getStreak(userId: string) {
  const { data } = await admin().rpc("activity_streak", { p_user: userId });
  return Number(data ?? 0);
}

export const DAILY_GOAL_XP = 100;

/** Active days (for the streak dots) + XP earned today (for the daily goal ring) – one query. */
export async function getActiveDays(userId: string, days = 7) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data } = await admin().from("xp_events").select("created_at,amount").eq("user_id", userId).gte("created_at", since);
  const today = todayKey();
  const set = new Set((data ?? []).map((r) => todayKey(new Date(r.created_at))));
  const out: boolean[] = [];
  for (let i = days - 1; i >= 0; i--) out.push(set.has(todayKey(new Date(Date.now() - i * 86400000))));
  const todayXp = (data ?? []).filter((r) => todayKey(new Date(r.created_at)) === today).reduce((a, r) => a + Math.max(0, Number(r.amount) || 0), 0);
  return { days: out, todayXp };
}

export async function getDailyStatus(userId: string) {
  const key = todayKey();
  const start = new Date(`${key}T00:00:00+01:00`);
  const { data } = await admin()
    .from("game_sessions")
    .select("id,status,correct,total,xp_awarded")
    .eq("user_id", userId)
    .eq("mode", "daily")
    .gte("created_at", new Date(start.getTime() - 3600000).toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function getContinueLearning(userId: string) {
  const db = admin();
  const { data: done } = await db.from("lesson_progress").select("lesson_id,completed_at").eq("user_id", userId).order("completed_at", { ascending: false }).limit(50);
  const doneIds = new Set((done ?? []).map((d) => d.lesson_id));
  const { data: lessons } = await db.from("lessons").select("id,title,sort,chapter_id,chapters(id,title,subject_id,subjects(name,icon))").order("sort");
  if (!lessons?.length) return null;
  // Find the chapter of the most recent completed lesson that still has unfinished lessons; else first chapter with progress 0.
  const byChapter = new Map<string, typeof lessons>();
  for (const l of lessons) {
    const arr = byChapter.get(l.chapter_id) ?? [];
    arr.push(l);
    byChapter.set(l.chapter_id, arr);
  }
  const recentChapter = (done ?? []).map((d) => lessons.find((l) => l.id === d.lesson_id)?.chapter_id).find((cid) => cid && (byChapter.get(cid) ?? []).some((l) => !doneIds.has(l.id)));
  const chapterId = recentChapter ?? [...byChapter.keys()].find((cid) => (byChapter.get(cid) ?? []).some((l) => !doneIds.has(l.id)));
  if (!chapterId) return null;
  const arr = byChapter.get(chapterId)!;
  const next = arr.find((l) => !doneIds.has(l.id))!;
  const ch = next.chapters as unknown as { id: string; title: string; subject_id: string; subjects: { name: string; icon: string } };
  const completed = arr.filter((l) => doneIds.has(l.id)).length;
  return { lessonId: next.id, lessonTitle: next.title, chapterTitle: ch.title, subjectName: ch.subjects.name, subjectIcon: ch.subjects.icon, subjectId: ch.subject_id, completed, total: arr.length, pct: Math.round((completed / arr.length) * 100) };
}

export async function getClassMatch(classId: string | null) {
  if (!classId) return null;
  const db = admin();
  const { from, to } = weekRange();
  const { data: scores } = await db.rpc("class_week_scores", { p_from: from, p_to: to });
  const list = ((scores ?? []) as { class_id: string; score: number; active_members: number; total_members: number }[]).sort((a, b) => b.score - a.score);
  const idx = list.findIndex((s) => s.class_id === classId);
  const mine = idx >= 0 ? list[idx] : { class_id: classId, score: 0, active_members: 0, total_members: 0 };
  const rival = idx > 0 ? list[idx - 1] : list.find((s) => s.class_id !== classId) ?? null;
  const ids = [classId, rival?.class_id].filter(Boolean) as string[];
  const { data: classes } = await db.from("classes").select("id,label,year,schools(name)").in("id", ids);
  const name = (id: string) => {
    const c = classes?.find((x) => x.id === id);
    return c ? { label: c.label, school: (c.schools as unknown as { name: string })?.name ?? "" } : { label: "?", school: "" };
  };
  return { mine: { ...mine, ...name(classId), rank: idx >= 0 ? idx + 1 : null }, rival: rival ? { ...rival, ...name(rival.class_id) } : null, totalClasses: list.length };
}
