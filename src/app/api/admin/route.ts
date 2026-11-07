import { NextResponse } from "next/server";
import { handler, readJson, requireUser, HttpError, logSecurity } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";

type Body = { action: string; [k: string]: unknown };

export const POST = handler(async (req) => {
  const { profile } = await requireUser({ admin: true });
  const b = await readJson<Body>(req);
  const db = admin();
  const audit = (kind: string, details: unknown) => logSecurity(profile.id, `admin:${kind}`, "info", details);
  switch (b.action) {
    case "set_role": {
      if (!["student", "teacher", "admin"].includes(String(b.role))) throw new HttpError(400, "Ogiltig roll");
      await db.from("profiles").update({ role: b.role }).eq("id", String(b.user_id));
      await audit("set_role", { user_id: b.user_id, role: b.role });
      break;
    }
    case "adjust_xp": {
      const amount = Number(b.amount);
      if (!Number.isFinite(amount) || Math.abs(amount) > 10000) throw new HttpError(400, "Ogiltigt belopp");
      await db.rpc("award_xp", { p_user: String(b.user_id), p_amount: amount, p_coins: 0, p_reason: `admin:adjust:${String(b.note ?? "").slice(0, 80)}`, p_session: null });
      await audit("adjust_xp", { user_id: b.user_id, amount, note: b.note });
      break;
    }
    case "toggle_question": {
      await db.from("questions").update({ active: !!b.active }).eq("id", String(b.id));
      await audit("toggle_question", { id: b.id, active: b.active });
      break;
    }
    case "update_question": {
      const patch: Record<string, unknown> = {};
      if (typeof b.prompt === "string") patch.prompt = b.prompt.slice(0, 500);
      if (typeof b.explanation === "string") patch.explanation = b.explanation.slice(0, 800);
      if (b.verify === true) { patch.source = "verified"; patch.owner_id = null; patch.material_id = null; }
      if (typeof b.difficulty === "string" && ["easy", "medium", "hard", "expert"].includes(b.difficulty)) patch.difficulty = b.difficulty;
      await db.from("questions").update(patch).eq("id", String(b.id));
      await audit("update_question", { id: b.id, patch });
      break;
    }
    case "create_question": {
      const q = b.question as { subject_id: string; difficulty: string; qtype: string; prompt: string; options?: unknown; answer: unknown; explanation?: string; chapter_id?: string | null };
      if (!q?.subject_id || !q.prompt || q.answer === undefined) throw new HttpError(400, "Ofullständig fråga");
      const { error } = await db.from("questions").insert({ subject_id: q.subject_id, difficulty: q.difficulty, qtype: q.qtype, prompt: q.prompt, options: q.options ?? null, answer: q.answer, explanation: q.explanation ?? null, chapter_id: q.chapter_id || null, source: "verified" });
      if (error) throw new HttpError(400, error.message);
      await audit("create_question", { prompt: q.prompt });
      break;
    }
    case "verify_school": {
      await db.from("schools").update({ verified: !!b.verified }).eq("id", String(b.id));
      await audit("verify_school", { id: b.id, verified: b.verified });
      break;
    }
    case "merge_school": {
      const from = String(b.from_id), into = String(b.into_id);
      if (from === into) throw new HttpError(400, "Samma skola");
      await db.from("classes").update({ school_id: into }).eq("school_id", from);
      await db.from("profiles").update({ school_id: into }).eq("school_id", from);
      await db.from("schools").update({ merged_into: into }).eq("id", from);
      await audit("merge_school", { from, into });
      break;
    }
    case "verify_class": {
      await db.from("classes").update({ verified: !!b.verified }).eq("id", String(b.id));
      break;
    }
    case "resolve_report": {
      await db.from("reports").update({ status: b.dismiss ? "dismissed" : "resolved", resolution: String(b.resolution ?? "").slice(0, 500) }).eq("id", String(b.id));
      await audit("resolve_report", { id: b.id, dismiss: b.dismiss });
      break;
    }
    case "set_config": {
      const key = String(b.key);
      if (!["xp_by_difficulty", "coins_per_xp", "repeat_multipliers", "class_member_weekly_cap"].includes(key)) throw new HttpError(400, "Okänd nyckel");
      let value: unknown;
      try { value = JSON.parse(String(b.value)); } catch { throw new HttpError(400, "Värdet måste vara giltig JSON"); }
      await db.from("app_config").upsert({ key, value });
      await audit("set_config", { key, value });
      break;
    }
    case "toggle_subject": {
      await db.from("subjects").update({ active: !!b.active }).eq("id", String(b.id));
      break;
    }
    case "delete_user": {
      const { error } = await db.auth.admin.deleteUser(String(b.user_id));
      if (error) throw new HttpError(400, error.message);
      await audit("delete_user", { user_id: b.user_id });
      break;
    }
    default:
      throw new HttpError(400, "Okänd åtgärd");
  }
  return NextResponse.json({ ok: true });
});
