import { NextResponse } from "next/server";
import { handler, requireUser } from "@/lib/auth";
import { serve } from "@/lib/engine";

export const GET = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const { user } = await requireUser({ skipProfile: true });
  const { id } = await ctx.params;
  return NextResponse.json(await serve(id, user.id, true));
});
