import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { BottomNav } from "@/components/BottomNav";
import { ToastProvider } from "@/components/Toast";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getSession();
  if (!user) redirect("/login");
  if (!profile) redirect("/onboarding");
  return (
    <ToastProvider>
      <main className="app-shell">{children}</main>
      <BottomNav />
    </ToastProvider>
  );
}
