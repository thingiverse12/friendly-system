import { notFound } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { GameSetup } from "@/components/GameSetup";
import { getSubjects } from "@/lib/data";
import { requireProfile } from "@/lib/auth";
import { recommend } from "@/lib/engine";
import { MODE_LABEL } from "@/lib/xp";
import type { GameMode } from "@/lib/types";

const INFO: Record<string, { icon: string; desc: string; rules: string[]; pick: "subject+difficulty" | "subject" | "optional-subject" | "none" }> = {
  quick: { icon: "🎯", desc: "Snabb runda med 8 frågor. Du väljer ämne och nivå – eller låter AI:n föreslå.", rules: ["XP per rätt svar beroende på nivå", "Förklaring vid fel", "Upprepade frågor ger mindre XP"], pick: "subject+difficulty" },
  blackjack: { icon: "🃏", desc: "Varje rätt svar ger ett kort. Kom så nära 21 som möjligt utan att gå över. Stanna när du vill.", rules: ["Rätt svar = nytt kort (2–11)", "Stanna: bonus = handens summa × 3 XP", "Exakt 21: +75 XP", "Över 21 = bust, men du behåller intjänad XP"], pick: "subject" },
  wheel: { icon: "🎡", desc: "Hjulet väljer ämne åt dig. Svårighetsgraden anpassas efter vad du kan.", rules: ["6 frågor i det ämne hjulet stannar på", "Ämnet väljs av servern – hjulet visar bara resultatet"], pick: "none" },
  slots: { icon: "🎰", desc: "Tre hjul: ämne, nivå och frågetyp. Perfekt för att träna format du annars undviker.", rules: ["6 frågor", "Nivån viktas mot din rekommenderade", "Inga pengar – bara kunskap"], pick: "none" },
  highstakes: { icon: "💎", desc: "10 frågor med stigande svårighet – från lätt till expert. Poängen stiger för varje runda.", rules: ["2 lätta, 3 medel, 3 svåra, 2 expert", "Felfri runda: +100 XP bonus", "Välj ämne eller blanda"], pick: "optional-subject" },
  brainrush: { icon: "⚡", desc: "60 sekunder huvudräkning. Så många rätt som möjligt. Talen genereras på servern.", rules: ["4 XP per rätt svar", "15+ rätt: +50 XP bonus", "Fel svar visar facit kort och går vidare"], pick: "none" },
  daily: { icon: "📅", desc: "Samma 10 frågor för alla idag. En chans per dag – resultatet räknas till klassen.", rules: ["Blandad nivå i dagens ämne", "≥70 % rätt: +100 XP bonus", "Tävlingsläge: facit och AI-förklaringar efter rundan"], pick: "none" },
};

export default async function GameMode({ params, searchParams }: { params: Promise<{ mode: string }>; searchParams: Promise<{ subject?: string; difficulty?: string }> }) {
  const { mode } = await params;
  const sp = await searchParams;
  const info = INFO[mode];
  if (!info) notFound();
  const { profile } = await requireProfile();
  const [subjects, rec] = await Promise.all([getSubjects(), recommend(profile.id)]);
  return (
    <>
      <TopBar title={MODE_LABEL[mode]} back="/games" />
      <div className="page">
        <div className="card felt">
          <div className="text-4xl">{info.icon}</div>
          <p className="text-[14px] mt-2">{info.desc}</p>
          <ul className="mt-3 grid gap-1">
            {info.rules.map((r) => <li key={r} className="text-[12px] text-[#bfe6d3] flex gap-2"><span className="gold">♦</span>{r}</li>)}
          </ul>
        </div>
        <GameSetup mode={mode as GameMode} pick={info.pick} subjects={subjects} rec={{ subjectId: rec.subjectId, difficulty: rec.difficulty, perSubject: rec.perSubject }} preset={{ subject: sp.subject, difficulty: sp.difficulty }} preferredFormat={profile.settings.preferred_format} />
      </div>
    </>
  );
}
