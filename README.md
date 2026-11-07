# KNOWPLAY — Play smart. Learn more.

Mörk, premium-känsla, casino-inspirerad kunskapsplattform för elever 13–18 år. Inga pengar, inga lootboxar – bara kunskap som ger XP.

**Stack:** Next.js 15 (App Router) · Supabase (Auth + Postgres + RLS) · Tailwind v4 · PWA · valfri gratis LLM (Groq / Gemini / OpenRouter).

## Funktioner

| Område | Innehåll |
|---|---|
| **Hem** | Avatar, nivå/rang (Rookie → Grandmaster), XP-bar, mynt, icke-straffande streak, AI-rekommendation, Dagens utmaning, Fortsätt lära, Klassmatch, stor PLAY-knapp |
| **Spel** | Quick Play, Knowledge Blackjack, Knowledge Wheel, Knowledge Slots, High Stakes Quiz, Brain Rush (servergenererad huvudräkning), Dagens utmaning (samma frågor för alla), Dueller 1v1 |
| **Lär** | 9 ämnen, kapitel → lektioner (markdown) → kapiteltest, egen material-uppladdning → AI-studiepaket (sammanfattning, begrepp, flashcards, övningsfrågor märkta *AI-genererat – ej verifierat*), AI-lärare (chatt, ledtrådar före facit) |
| **Skolor** | Sök/skapa skola & klass (ej verifierade tills admin granskar), klasskod – kopiera/dela/byt/stäng, dubblettrapport, medlemslista med alias, klasspoäng |
| **Topplista** | Klasser, skolor, ämnesvis, elever (vecka). Normaliserad poäng: XP-tak per elev, snitt över aktiva × deltagandefaktor, skolpoäng viktad på antal klasser |
| **Profil** | Alias/avatar/tema (Casino Noir eller det ljusa **Dagsljus**), svarsformat (Auto/Alternativ/Skriva/Blandat), ljud/vibration/animationer, integritet (privat profil, dölj skola), utmärkelser, historik, Treasure Vault (kosmetik för mynt), adminkod, radera konto (GDPR) |
| **Admin** (`/admin`) | Översikt, användare (roller, XP-justering, radering), frågor (skapa/redigera/inaktivera/verifiera AI-frågor), skolor (verifiera, slå ihop dubbletter), rapporter, säkerhetslogg med anticheat-nivåer, XP-logg, regler (XP-tabell m.m.) |

### Adaptiv motor & XP-regler
- XP per rätt svar: **Lätt 10 · Medel 25 · Svår 50 · Expert 100** (ändras i Admin → Regler).
- Fel svar = 0 XP + förklaring. Samma fråga igen: ×0.5, ×0.25, sedan 0. Blixtsnabba svar (<1,2 s) halveras och loggas.
- Mynt = 20 % av XP. Nivå = ⌊√(XP/50)⌋+1.
- Kunskap och svarsformat följs separat (`knowledge_state` / `format_state`). Om eleven presterar ≥15 p.e. sämre på skrivna svar än på alternativ föreslår AI:n flerval – eleven kan alltid byta.
- Tävlingsläge (Dagens utmaning, Dueller): facit och AI-förklaringar först efter rundan.

### Säkerhet
- All poängräkning sker i route handlers på servern med service-role-klient efter autentisering. Facit (`questions.answer`) och serverstate (`game_sessions.meta`, `session_items.generated`) skickas aldrig till klienten.
- Sessionsvalidering (ägare, ordning, status), DB-baserad rate limiting, RLS (anon/authenticated kan bara läsa egna rader), säkerhetslogg, inga automatiska avstängningar (nivåer Normal/Varning/Kräver granskning).
- Alias istället för namn, privata profiler, ingen öppen chatt mellan elever, kontoradering raderar allt (cascade).

## Kom igång lokalt

```bash
npm install
cp .env.example .env.local   # fyll i värden
npm run dev
```

### Miljövariabler

| Variabel | Krävs | Beskrivning |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ja | Supabase-projektets URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ja | Anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | ja | Service role – **bara på servern** |
| `ADMIN_CODE` | ja | Kod som gör ett konto till admin (Profil → Inställningar → Adminkod) |
| `GROQ_API_KEY` / `GEMINI_API_KEY` / `OPENROUTER_API_KEY` / `OPENAI_API_KEY` | nej | Valfri uppgradering. **Utan nyckel används automatiskt den öppna modellen GPT-OSS 20B** (se nedan) |
| `AI_DISABLE_FREE` | nej | `1` stänger av den nyckelfria AI:n → offline-läge |
| `AI_MODEL` | nej | Överstyr modellnamn |

### AI utan nyckel – öppen källkod (standard)
KNOWPLAY fungerar med riktig AI direkt, utan konto eller nyckel: anrop går till [Pollinations](https://github.com/pollinations/pollinations) – en öppen källkods-gateway (Berlin) vars nyckelfria nivå serverar **GPT-OSS 20B**, OpenAI:s öppna modell (Apache 2.0-vikter), hostad hos OVH i EU. Vi skickar `private=true` så inget hamnar i deras publika flöde, och de lagrar inte prompts. Modellen i den fria nivån kan bytas av Pollinations över tid; byt vid behov `AI_MODEL`.

### Valfritt: egen gratis nyckel för större modell
1. **Groq** (rekommenderas – snabbast): <https://console.groq.com> → *API Keys* → *Create API Key*. Lägg som `GROQ_API_KEY`. Modell: `llama-3.3-70b-versatile`.
2. **Google Gemini**: <https://aistudio.google.com/apikey> → *Create API key*. Lägg som `GEMINI_API_KEY`. Modell: `gemini-2.0-flash`.
3. **OpenRouter** (gratis-modeller): <https://openrouter.ai/keys>. Lägg som `OPENROUTER_API_KEY`.

### Databas
Migrationerna ligger i `supabase/migrations/` och seed-generatorn i `supabase/seed/content.py` (grundinnehåll) och `supabase/seed/content_books.py` (läroboksavsnitt: Kolets kemi, Världshandel/ideologier, Vitaminer & mineraler – ämnet Idrott och hälsa)` (`python3 supabase/seed/content.py > supabase/seed/0002_seed.sql`). Kör i ordning: `0001_init.sql` → `0002_seed.sql` → `0003_functions.sql`.

## Deploy (Vercel)
Projektet är kopplat till detta repo; varje push till `main`/produktionsgrenen bygger automatiskt. Sätt miljövariablerna ovan under *Settings → Environment Variables* och lägg Vercel-URL:en som *Site URL* i Supabase → Authentication → URL Configuration.

## Struktur
```
src/app/            sidor (App Router) + api/ route handlers
src/lib/engine.ts   spelmotor: urval, rättning, XP, anticheat, achievements, dueller
src/lib/grading.ts  rättning per frågetyp (mcq/tf/fill/numeric/short/match)
src/lib/ai.ts       providerneutral LLM-klient + offline-fallback
src/lib/auth.ts     requireUser, rate limit, säkerhetslogg
supabase/           schema, funktioner, seed
design-previews/    designförslag (A Casino Noir valdes)
```
