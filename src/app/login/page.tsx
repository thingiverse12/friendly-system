import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getSession } from "@/lib/auth";
export const metadata = { title: "Logga in" };
export default async function Login() {
  const { user, profile } = await getSession();
  if (user) redirect(profile ? "/home" : "/onboarding");
  return <AuthForm mode="login" />;
}
