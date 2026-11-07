import { notFound } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { Markdown } from "@/components/Markdown";
import { MaterialView } from "@/components/MaterialView";
import { getSession } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function MaterialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await getSession();
  const db = admin();
  const { data: m } = await db.from("materials").select("*").eq("id", id).eq("user_id", profile!.id).maybeSingle();
  if (!m) notFound();
  const { count } = await db.from("questions").select("id", { count: "exact", head: true }).eq("material_id", id);
  return (
    <>
      <TopBar title="Studiepaket" back="/learn/materials" />
      <div className="page">
        <h2 className="text-[20px] font-extrabold">{m.title}</h2>
        <div className="flex gap-2 mt-2 flex-wrap">
          {m.status === "ready" ? <span className="pill p">🤖 AI-genererat – ej verifierat</span> : <span className="pill g">Enkel offline-analys</span>}
          <span className="pill">{count ?? 0} övningsfrågor</span>
        </div>
        <div className="sec">
          <div className="sec-title">Sammanfattning</div>
          <div className="card mt-3"><Markdown>{m.summary ?? "Ingen sammanfattning."}</Markdown></div>
        </div>
        <MaterialView id={m.id} concepts={(m.concepts as { term: string; definition: string }[]) ?? []} flashcards={(m.flashcards as { front: string; back: string }[]) ?? []} questionCount={count ?? 0} />
      </div>
    </>
  );
}
