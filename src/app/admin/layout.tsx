import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ToastProvider } from "@/components/Toast";

const TABS = [["", "Översikt"], ["users", "Användare"], ["questions", "Frågor"], ["schools", "Skolor"], ["reports", "Rapporter"], ["security", "Säkerhet"], ["xp", "XP-logg"], ["config", "Regler"]];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getSession();
  if (!user) redirect("/login");
  if (profile?.role !== "admin") redirect("/home");
  return (
    <ToastProvider>
      <div className="wide">
        <main className="app-shell no-nav">
          <div className="topbar">
            <Link href="/home" className="back">‹</Link>
            <h1>Admin · KNOWPLAY</h1>
            <span className="pill g">{profile.alias}</span>
          </div>
          <div className="page">
            <div className="flex gap-2 flex-wrap mb-4">
              {TABS.map(([k, l]) => <Link key={k} href={`/admin${k ? `/${k}` : ""}`} className="pill">{l}</Link>)}
            </div>
            {children}
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
