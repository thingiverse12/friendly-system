import { NextResponse } from "next/server";
import { handler, requireUser } from "@/lib/auth";
import { abandonSession } from "@/lib/engine";

export const POST = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const { user } = await requireUser();
  const { id } = await ctx.params;
  return NextResponse.json(await abandonSession(id, user.id));
});
