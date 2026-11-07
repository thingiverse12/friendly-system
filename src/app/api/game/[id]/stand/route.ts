import { NextResponse } from "next/server";
import { handler, requireUser } from "@/lib/auth";
import { standBlackjack } from "@/lib/engine";

export const POST = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const { user } = await requireUser();
  const { id } = await ctx.params;
  return NextResponse.json(await standBlackjack(id, user.id));
});
