/**
 * Provider-agnostic LLM access. Picks the first configured FREE-tier friendly provider:
 *   GROQ_API_KEY      → Groq (OpenAI-compatible, llama-3.3-70b-versatile)
 *   GEMINI_API_KEY    → Google AI Studio (gemini-2.0-flash)
 *   OPENROUTER_API_KEY→ OpenRouter (free models)
 *   OPENAI_API_KEY    → OpenAI
 * Without any key the app runs in a clearly labeled offline mode (no fake AI output).
 */
export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export interface Provider {
  name: string;
  model: string;
}

export function activeProvider(): Provider | null {
  const override = process.env.AI_MODEL;
  if (process.env.GROQ_API_KEY) return { name: "groq", model: override || "llama-3.3-70b-versatile" };
  if (process.env.GEMINI_API_KEY) return { name: "gemini", model: override || "gemini-2.0-flash" };
  if (process.env.OPENROUTER_API_KEY) return { name: "openrouter", model: override || "meta-llama/llama-3.3-70b-instruct:free" };
  if (process.env.OPENAI_API_KEY) return { name: "openai", model: override || "gpt-4o-mini" };
  return null;
}

async function openaiCompatible(url: string, key: string, model: string, messages: ChatMessage[], json: boolean, extraHeaders: Record<string, string> = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}`, ...extraHeaders },
    body: JSON.stringify({ model, messages, temperature: 0.4, max_tokens: 1800, ...(json ? { response_format: { type: "json_object" } } : {}) }),
    signal: AbortSignal.timeout(40_000),
  });
  if (!res.ok) throw new Error(`AI provider error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return String(data.choices?.[0]?.message?.content ?? "");
}

async function gemini(key: string, model: string, messages: ChatMessage[], json: boolean) {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const contents = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents,
      generationConfig: { temperature: 0.4, maxOutputTokens: 1800, ...(json ? { responseMimeType: "application/json" } : {}) },
    }),
    signal: AbortSignal.timeout(40_000),
  });
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return String(data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "");
}

export async function chat(messages: ChatMessage[], opts: { json?: boolean } = {}): Promise<{ text: string; provider: Provider } | null> {
  const p = activeProvider();
  if (!p) return null;
  const json = !!opts.json;
  let text = "";
  if (p.name === "groq") text = await openaiCompatible("https://api.groq.com/openai/v1/chat/completions", process.env.GROQ_API_KEY!, p.model, messages, json);
  else if (p.name === "gemini") text = await gemini(process.env.GEMINI_API_KEY!, p.model, messages, json);
  else if (p.name === "openrouter")
    text = await openaiCompatible("https://openrouter.ai/api/v1/chat/completions", process.env.OPENROUTER_API_KEY!, p.model, messages, json, { "HTTP-Referer": "https://knowplay.app", "X-Title": "KNOWPLAY" });
  else text = await openaiCompatible("https://api.openai.com/v1/chat/completions", process.env.OPENAI_API_KEY!, p.model, messages, json);
  return { text, provider: p };
}

export function parseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

export const TEACHER_SYSTEM = `Du är KNOWPLAYs AI-lärare för elever 13–18 år i Sverige. Svara alltid på svenska, kort (max ~120 ord), vänligt och konkret.
Regler:
- Förklara VARFÖR något är rätt eller fel med ett steg-för-steg-resonemang anpassat till elevens nivå.
- I övningsläge ger du INTE bara facit: led eleven med ledtrådar och frågor, såvida eleven inte redan svarat och facit visas.
- Hitta aldrig på fakta. Om du är osäker, säg det och föreslå var eleven kan kolla (lärobok, lärare).
- Inga personuppgifter, inga länkar, inga ämnen utanför skolan. Var uppmuntrande men aldrig nedlåtande.`;

export const MATERIAL_SYSTEM = `Du är en pedagogisk innehållsanalytiker för svenska högstadie- och gymnasieelever. Du får en text (anteckningar/lärobok) och ska skapa studiematerial PÅ SVENSKA.
Hitta aldrig på fakta som inte stöds av texten. Om texten är för kort eller otydlig, gör färre poster hellre än att gissa.
Svara ENBART med giltig JSON enligt:
{"title": string, "summary": string (5–8 meningar, markdown tillåten), "concepts": [{"term": string, "definition": string}] (4–10 st),
 "flashcards": [{"front": string, "back": string}] (6–12 st),
 "questions": [{"difficulty": "easy"|"medium"|"hard", "prompt": string, "options": [string,string,string,string], "answer": number (index 0-3), "explanation": string}] (6–10 st, endast ett rätt alternativ)}`;

/** Offline fallback: honest extractive summary + frequency-based concepts. Clearly labeled in the UI. */
export function offlineMaterial(raw: string) {
  const sentences = raw.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).filter((s) => s.length > 30);
  const summary = sentences.slice(0, 5).join(" ");
  const stop = new Set("och att det som en ett är av för på med till den de i om har inte kan vilket detta när man ska från eller också så men var vid sig än där då hur mellan under över genom sin sina dessa the and of to in is a".split(" "));
  const freq = new Map<string, number>();
  for (const w of raw.toLowerCase().match(/[a-zåäöéü]{5,}/g) ?? []) if (!stop.has(w)) freq.set(w, (freq.get(w) ?? 0) + 1);
  const concepts = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([term, n]) => ({ term, definition: `Förekommer ${n} gånger i texten – slå upp och skriv en egen definition.` }));
  const flashcards = sentences.filter((s) => / är | kallas | betyder | innebär /.test(s)).slice(0, 8).map((s) => {
    const [front, ...rest] = s.split(/ är | kallas | betyder | innebär /);
    return { front: `Vad är/innebär: ${front.trim()}?`, back: rest.join(" ").trim() || s };
  });
  return { summary, concepts, flashcards };
}
