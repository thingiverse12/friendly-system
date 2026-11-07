import { NextResponse } from "next/server";
import { handler, readJson, requireUser, HttpError, rateLimit } from "@/lib/auth";
import { answerItem } from "@/lib/engine";

export const POST = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const { user } = await requireUser({ skipProfile: true });
  const { id } = await ctx.params;
  const [body] = await Promise.all([readJson<{ idx: number; response: unknown }>(req), rateLimit(user.id, "answer", 90, 60)]);
  if (typeof body.idx !== "number") throw new HttpError(400, "idx saknas");
  // basic payload sanity (never trust client types)
  const r = body.response;
  if (typeof r === "string" && r.length > 300) throw new HttpError(400, "För långt svar");
  if (Array.isArray(r) && r.length > 12) throw new HttpError(400, "Ogiltigt svar");
  return NextResponse.json(await answerItem(id, user.id, body.idx, r));
});
