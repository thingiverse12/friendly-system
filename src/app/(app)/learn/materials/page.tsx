import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { MaterialUpload } from "@/components/MaterialUpload";
import { requireProfile } from "@/lib/auth";
import { getSubjects } from "@/lib/data";
import { admin } from "@/lib/supabase/admin";
import { activeProvider } from "@/lib/ai";

export const metadata = { title: "Eget material" };
export const dynamic = "force-dynamic";

export default async function Materials() {
  const { profile } = await requireProfile();
  const [subjects, { data: materials }] = await Promise.all([getSubjects(), admin().from("materials").select("id,title,status,subject_id,created_at").eq("user_id", profile.id).order("created_at", { ascending: false })]);
  const ai = activeProvider();
  return (
    <>
      <TopBar title="Eget material" back="/learn" />
      <div className="page">
        {!ai && (
          <div className="card mb-4 text-[12px] border-gold/30">
            <span className="pill g">OFFLINE-LÄGE</span>
            <p className="mt-2">Ingen AI-nyckel är konfigurerad. Du kan ändå ladda upp text och få en enkel automatisk sammanfattning, men inga AI-genererade frågor. Lägg till en gratis Groq- eller Gemini-nyckel på servern för full funktion.</p>
          </div>
        )}
        <MaterialUpload subjects={subjects.map((s) => ({ id: s.id, name: s.name }))} />
        <div className="sec">
          <div className="sec-title">Mina material</div>
          {(materials ?? []).length === 0 && <p className="muted text-[13px] mt-3">Inget uppladdat än.</p>}
          <div className="grid gap-2 mt-3">
            {(materials ?? []).map((m) => (
              <Link key={m.id} href={`/learn/materials/${m.id}`} className="card interactive flex items-center gap-3 !py-3">
                <span className="text-2xl">📄</span>
                <div className="flex-1 min-w-0">
                  <b className="block text-[14px] truncate">{m.title}</b>
                  <p className="muted text-[11px]">{new Date(m.created_at).toLocaleDateString("sv-SE")}{m.subject_id ? ` · ${subjects.find((s) => s.id === m.subject_id)?.name ?? ""}` : ""}</p>
                </div>
                <span className={`pill ${m.status === "ready" ? "p" : m.status === "offline" ? "g" : "r"}`}>{m.status === "ready" ? "AI-genererat" : m.status === "offline" ? "Enkel analys" : m.status}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
