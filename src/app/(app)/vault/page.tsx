import { TopBar } from "@/components/TopBar";
import { SubNav, NAV_ME } from "@/components/SubNav";
import { VaultClient } from "@/components/VaultClient";
import { requireProfile } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { levelForXp } from "@/lib/xp";

export const metadata = { title: "Treasure Vault" };
export const dynamic = "force-dynamic";

export default async function Vault() {
  const { profile } = await requireProfile();
  const p = profile;
  const [{ data: items }, { data: owned }] = await Promise.all([admin().from("cosmetics").select("*").order("kind").order("sort"), admin().from("user_cosmetics").select("cosmetic_id").eq("user_id", p.id)]);
  return (
    <>
      <TopBar title="Treasure Vault" back="/profile" />
      <SubNav items={NAV_ME} />
      <div className="page">
        <div className="card felt flex items-center gap-3">
          <span className="text-3xl">💎</span>
          <div className="flex-1"><b className="text-[15px]">{p.coins} mynt</b><p className="text-[12px] text-[#bfe6d3]">Mynt tjänas genom kunskap (20 % av XP). Allt här är kosmetiskt – inga lootboxar, inga pengar, inga fördelar i spelet.</p></div>
        </div>
        <VaultClient items={items ?? []} owned={(owned ?? []).map((o) => o.cosmetic_id)} coins={p.coins} level={levelForXp(p.xp)} current={{ avatar: p.avatar, theme: p.theme }} />
      </div>
    </>
  );
}
