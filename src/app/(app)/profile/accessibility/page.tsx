import { TopBar } from "@/components/TopBar";
import { SubNav, NAV_ME } from "@/components/SubNav";
import { AccessibilityClient } from "@/components/AccessibilityClient";
import { requireProfile } from "@/lib/auth";

export const metadata = { title: "Tillgänglighet" };
export const dynamic = "force-dynamic";

export default async function Accessibility() {
  const { profile } = await requireProfile();
  return (
    <>
      <TopBar title="Tillgänglighet" back="/profile" />
      <SubNav items={NAV_ME} />
      <div className="page">
        <p className="muted text-[13px] mb-3">KNOWPLAY ska funka för alla. Allt här sparas på ditt konto och gäller direkt på alla sidor. Du kan kombinera fritt.</p>
        <AccessibilityClient settings={profile.settings} />
      </div>
    </>
  );
}
