import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Onboarding } from "@/components/Onboarding";
export const metadata = { title: "Kom igång" };
export default async function Page() {
  const { user, profile } = await getSession();
  if (!user) redirect("/login");
  if (profile) redirect("/home");
  return <Onboarding />;
}
