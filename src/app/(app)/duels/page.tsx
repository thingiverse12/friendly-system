import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { DuelsClient } from "@/components/DuelsClient";
import { getSession } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { getSubjects } from "@/lib/data";

export const metadata = { title: "Dueller" };
export const dynamic = "force-dynamic";

export default async function Duels() {
  const { profile } = await getSession();
  const p = profile!;
  const db = admin();
  if (!p.class_id) {
    return (<><TopBar title="Dueller" back="/games" /><div className="page"><div className="card text-center py-8"><div className="text-4xl mb-2">⚔️</div><b>Dueller kräver en klass</b><p className="muted text-[13px] mt-1">Du kan bara utmana klasskompisar – inga främlingar.</p><Link href="/schools" className="btn-gold mt-4">Gå med i klass</Link></div></div></>);
  }
  const [{ data: mates }, { data: duels }, subjects] = await Promise.all([
    db.from("profiles").select("id,alias,avatar,settings").eq("class_id", p.class_id).neq("id", p.id).order("alias"),
    db.from("duels").select("*, challenger:profiles!duels_challenger_id_fkey(alias,avatar), opponent:profiles!duels_opponent_id_fkey(alias,avatar)").or(`challenger_id.eq.${p.id},opponent_id.eq.${p.id}`).order("created_at", { ascending: false }).limit(20),
    getSubjects(),
  ]);
  const list = (duels ?? []).map((d) => ({
    id: d.id, status: d.status, subject: subjects.find((s) => s.id === d.subject_id)?.name ?? d.subject_id, difficulty: d.difficulty,
    isChallenger: d.challenger_id === p.id, mySession: d.challenger_id === p.id ? d.challenger_session : d.opponent_session, winner: (d.winner_id === p.id ? "me" : d.winner_id ? "them" : null) as "me" | "them" | null,
    other: (d.challenger_id === p.id ? d.opponent : d.challenger) as { alias: string; avatar: string }, created_at: d.created_at,
  }));
  return (
    <>
      <TopBar title="Dueller" back="/games" />
      <div className="page">
        <DuelsClient mates={(mates ?? []).map((m) => ({ id: m.id, alias: m.alias, avatar: m.avatar }))} subjects={subjects.map((s) => ({ id: s.id, name: s.name, icon: s.icon }))} duels={list} />
      </div>
    </>
  );
}
