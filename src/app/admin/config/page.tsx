import { requireAdminPage } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { AdminAction } from "@/components/AdminAction";
export const dynamic = "force-dynamic";
export default async function Config() {
  await requireAdminPage();
  const { data } = await admin().from("app_config").select("*").order("key");
  const desc: Record<string, string> = { xp_by_difficulty: "XP per rätt svar per nivå", coins_per_xp: "Mynt per XP (0.2 = 20 %)", repeat_multipliers: "Multiplikator vid upprepning av samma fråga (1:a, 2:a, 3:e, därefter)", class_member_weekly_cap: "Max XP per elev som räknas till klasspoäng per vecka" };
  return (
    <div className="card overflow-x-auto">
      <table className="table">
        <thead><tr><th>Nyckel</th><th>Värde (JSON)</th><th>Beskrivning</th><th></th></tr></thead>
        <tbody>{(data ?? []).map((c) => <tr key={c.key}><td><b>{c.key}</b></td><td><code>{JSON.stringify(c.value)}</code></td><td className="muted">{desc[c.key]}</td><td><AdminAction body={{ action: "set_config", key: c.key }} label="Ändra" prompt={{ key: "value", text: `Nytt JSON-värde för ${c.key}:` }} /></td></tr>)}</tbody>
      </table>
    </div>
  );
}
