import { TopBar } from "@/components/TopBar";
import { SettingsClient } from "@/components/SettingsClient";
import { requireProfile } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";

export const metadata = { title: "Inställningar" };
export const dynamic = "force-dynamic";

export default async function Settings() {
  const { profile, user } = await requireProfile();
  const p = profile;
  const { data: owned } = await admin().from("user_cosmetics").select("cosmetic_id,cosmetics(kind,value,name)").eq("user_id", p.id);
  const avatars = ["🦊", "🐱", "🐸", "🐵", "🐧", "🐨", "🐯", "🦋", ...(owned ?? []).map((o) => o.cosmetics as unknown as { kind: string; value: string }).filter((c) => c?.kind === "avatar").map((c) => c.value)];
  const themes = ["noir", ...(owned ?? []).map((o) => o.cosmetics as unknown as { kind: string; value: string }).filter((c) => c?.kind === "theme").map((c) => c.value)];
  return (
    <>
      <TopBar title="Inställningar" back="/profile" />
      <div className="page">
        <SettingsClient profile={{ alias: p.alias, avatar: p.avatar, theme: p.theme, role: p.role, settings: p.settings }} avatars={[...new Set(avatars)]} themes={[...new Set(themes)]} email={user!.email ?? ""} />
      </div>
    </>
  );
}
