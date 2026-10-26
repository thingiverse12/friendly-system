# Arkitektur

## Översikt

```
┌──────────────────────────┐        HTTPS / WSS
│  React-klient (Vite)     │  cookie-baserad session, same-origin
│  sidor + bevisbräda + WS │
└───────────┬──────────────┘
            │ /api (REST)   /ws (närvaro/signal)
┌───────────▼──────────────┐
│  Express + ws (Node 22)  │
│  routes → tjänster → logik│
└───────────┬──────────────┘
            │
┌───────────▼──────────────┐
│  node:sqlite (WAL)       │  normaliserat, versionsmedvetet schema
└──────────────────────────┘
```

Klienten byggs med Vite och serveras statiskt av Express i produktion. Under
utveckling proxar Vite `/api` och `/ws` till backend på port 8787.

## Säkerhetsgränser

Den viktigaste arkitekturregeln är skiljelinjen mellan **offentligt
fallmaterial** och **hemligt facit**:

- `cases.public_payload`, `case_suspects.public_profile`, `case_events`
  (publika rader) och `case_evidence` (utan `secret_meaning`) får lämnas ut.
- `case_solution_secrets`, `case_suspect_secrets`, `case_evidence.secret_meaning`
  och `case_events.secret_note` läses bara av serverkod: AI-motorn,
  poängberäkningen och lösningsvisningen.
- `getPublicCase()` monterar ett paket där hemliga fält aldrig ingår.
  Integrationstestet assertar att strängar som `isCulprit`, `secretMeaning`
  och `decisiveEvidence` inte kan förekomma i klientsvaret.
- Facit kan bara läsas efter en korrekt anklagelse, gemensamt avslöjande
  (tävling) eller ett färdigt rum – se `getSolutionIfAllowed()`.

## Datamodell

Schemat finns i `server/src/db.js` och täcker hela den efterfrågade modellen:

- Identitet: `users`, `profiles`, `auth_tokens`, `roles` (rollfält på user)
- Fall: `case_series`, `cases`, `case_suspects(+secrets)`, `case_events`,
  `case_evidence`, `case_witness_statements`, `case_solution_secrets`,
  `case_validation_runs`, `case_validation_findings`
- Spel: `investigation_rooms`, `room_members`, `investigation_sessions`,
  `session_events`, `discovered_evidence`, `interrogations(+messages)`,
  `player_notes`, `evidence_connections`, `final_accusations`, `score_events`
- Kampanj: `campaigns`, `campaign_cases`, `campaign_progress`
- Community: `community_ratings`, `favorites`, `comments`, `reports`,
  `moderation_actions`
- Styrning: `audit_logs`, `privacy_requests`, `usage_budgets`

### Versionslåsning

Redigering av ett publicerat fall skapar en ny rad i `cases` med högre
`version` inom samma `case_series`. Rum refererar till både `case_id` och
`case_version` vid skapandet, så pågående utredningar alltid behåller sin version.

## Tjänstelager

- `services/investigation.js` – rum, medlemskap, bevissäkring, brädklassificering,
  anteckningar, anklagelser, poäng och händelselogg.
- `services/interrogation.js` – förhör och assistent, med budget och behörighetskontroller.
- `logic/validation.js` – deterministisk QA (kontroll A, C och grundskydd D)
  plus den oberoende utredaren (kontroll B, med enbart offentligt material).
- `logic/scoring.js` – all poängberäkning sker serversidigt.
- `ai/` – providerabstraktion, lokal kunskapsbanksmotor, svarsvalidering och budget.
- `realtime/hub.js` – WebSocket-närvaro. Känslig data skickas aldrig via socket;
  klienten får en signal och hämtar sitt behörighetsstyrda tillstånd via REST.

## AI-arkitektur

1. **Lokal motor (standard):** svar väljs deterministiskt ur den misstänktes
   egna kunskapsbank (`knows/believes/hides/questions/evidenceReactions`).
   Träffar ingen fråga banken returneras ett validerat generiskt svar.
2. **Extern modell (valfritt):** får ett strikt kontexturval – den egna
   personens modell och enbart upptäckta bevis. Facit, andras hemligheter och
   oupptäckta bevistitlar skickas aldrig. Svar valideras
   (`validateExternalAnswer`) med ett återförsök och sedan lokal fallback.
3. **Budget:** timkvoter per användare och rum. När taket nås fortsätter
   spelet på den kostnadsfria motorn – ingen betalvägg uppstår.

Absolut regel i kod: inget reservsval inför nya fakta. Alla textsvar som når
en spelare är förankrade i den låsta fallmodellen.

## Idempotens och feltålighet

- Alla mutationer skriver till `session_events` med idempotency-nycklar
  (unik kolumn i databasen).
- Bevissäkring och kopplingar har dessutom naturliga unika begränsningar.
- Klienten pollar som reservläge var 20:e sekund utöver WS-signaler och
  återansluter sockets med backoff.
- Transaktioner är implementerade med `BEGIN`/`SAVEPOINT` i `db.js`.

## Behörighetsmodell

- `authRequired` på alla API:er utom katalog, hälsokontroll och inloggning.
- `roleRequired('moderator','admin')` för moderationsåtgärder.
- Rum: `assertMember` + borttagna medlemmar nekas; värdskap kan migrera till
  äldsta kvarvarande medlem vid frånkoppling.
- Tävling: anteckningar filtreras per användare, anklagelser döljs till
  avslöjandet, och poäng kan aldrig skickas in från klienten.
