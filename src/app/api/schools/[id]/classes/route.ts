import { NextResponse } from "next/server";
import { handler, requireUser } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";

export const GET = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  await requireUser({ allowNoProfile: true });
  const { id } = await ctx.params;
  const { data } = await admin().from("classes").select("id,year,label,verified,profiles(count)").eq("school_id", id).order("year").order("label");
  return NextResponse.json({
    classes: (data ?? []).map((c) => ({ id: c.id, year: c.year, label: c.label, verified: c.verified, members: (c.profiles as unknown as { count: number }[])?.[0]?.count ?? 0 })),
  });
});
