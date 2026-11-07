import { NextResponse } from "next/server";
import { handler, requireUser } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";

export const GET = handler(async (req) => {
  await requireUser({ allowNoProfile: true });
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ schools: [] });
  const { data } = await admin()
    .from("schools")
    .select("id,name,city,verified,classes(count)")
    .is("merged_into", null)
    .or(`name.ilike.%${q.replace(/[%,()]/g, "")}%,city.ilike.%${q.replace(/[%,()]/g, "")}%`)
    .order("verified", { ascending: false })
    .limit(12);
  return NextResponse.json({
    schools: (data ?? []).map((s) => ({ id: s.id, name: s.name, city: s.city, verified: s.verified, classes: (s.classes as unknown as { count: number }[])?.[0]?.count ?? 0 })),
  });
});
