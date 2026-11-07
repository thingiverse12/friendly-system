import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getSession } from "@/lib/auth";
export const metadata = { title: "Skapa konto" };
export default async function Signup() {
  const { user, profile } = await getSession();
  if (user) redirect(profile ? "/home" : "/onboarding");
  return <AuthForm mode="signup" />;
}
