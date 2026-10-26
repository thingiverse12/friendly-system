# Driftsättning

## Krav

- Node.js ≥ 22.5 (det inbyggda `node:sqlite` används – inga externa databaser).
- Ingen tredjepartstjänst är obligatorisk. AI, bilder och berättarröst har
  inbyggda, kostnadsfria alternativ.

## Miljövariabler

Se [`.env.example`](../.env.example). Sammanfattning:

| Variabel | Standard | Beskrivning |
| --- | --- | --- |
| `PORT` | `8787` | Lyssningsport (bind alltid `0.0.0.0` i container) |
| `DATA_DIR` | `./data` | Katalog för SQLite-filen (WAL) |
| `DB_PATH` | `<DATA_DIR>/mordgatan.sqlite` | Databasfil |
| `AI_PROVIDER` | `local` | `local` eller `openai-compatible` |
| `AI_BASE_URL` | – | Bas-URL till chat completions-kompatibel tjänst |
| `AI_MODEL` | – | Modellnamn |
| `AI_API_KEY` | – | Nyckel (skickas som Bearer) |
| `AI_HOUR_BUDGET` | `60` | Max AI-anrop per användare och timme |
| `AI_ROOM_HOUR_BUDGET` | `200` | Max AI-anrop per rum och timme |

## Lokal utveckling

```bash
npm install
npm run dev      # startar API (8787) och Vite (5173) parallellt
```

Demokonto: `demo` / `demopass123`. Databasen och allt officiellt innehåll
skapas automatiskt första starten (`server/src/seed.js`). Manuell omsådd:

```bash
npm run seed
```

## Produktion

```bash
npm run build    # bygger klienten till dist/
npm start        # Express serverar API, WS och den statiska klienten
```

Hälsokontroll: `GET /api/health`.

## Vercel (serverless)

Publik demo: **<https://mordgatan.vercel.app>** (Vercel-projekt `mordgatan`,
region iad1, Node 24.x). Distribution sker automatiskt vid push till
repositoryts anslutna Git-gren. Projektet är kopplat till
`thingiverse12/friendly-system` och använder:

- Miljövariabler (Production/Preview/Development):
  `NODE_OPTIONS=--experimental-sqlite`, `DATA_DIR=/tmp/mordgatan-data`.
- Byggkommando `npm run build`, output-katalog `dist`.

Projektet är förberett för Vercel via [`vercel.json`](../vercel.json) och
funktionen [`api/index.js`](../api/index.js):

- Bygge: `npm run build` (Vite → `dist/`), statiskt värdskap för klienten.
- Allt under `/api/*` går till en Express-serverless-funktion.
- `node:sqlite` kräver Node-flaggan `--experimental-sqlite` – läggs på som
  miljövariabeln `NODE_OPTIONS=--experimental-sqlite` i projektet.
- Databasen läggs i `/tmp` (`DATA_DIR=/tmp/mordgatan-data`), eftersom
  serverless-funktioner saknar beständigt filsystem.

> **Viktig begränsning:** `/tmp` är inte beständigt mellan kalla starter och
> inte delat mellan funktionsinstanser. Vid en kallstart återskapas schema,
> officiella fall och demokontot automatiskt (idempotent frösådd), men
> registreringar och spelarrom som skapats i en annan instans kan saknas.
> Det duger för demo och provspel. För skarp drift med konton och sparade
> utredningar, byt datalagret i `server/src/db.js` mot en nätverksdatabas
> (t.ex. Turso/libSQL eller Postgres) – all SQL är samlad i det lagret.
> WebSocket-stöd finns inte i serverless; klienten går automatiskt över till
> 20-sekunders polling och spelet förblir spelbart (realtidsnärvaro uteblir).

### Rekommenderad härdning

- Kör bakom TLS-avlastande reverse proxy (nginx/Caddy/Load Balancer).
- Montera `DATA_DIR` på beständig lagring och säkerhetskopiera
  `mordgatan.sqlite` med WAL-filerna (eller använd SQLite online backup).
- Ändra samtliga demouppgifter och ta bort demokontot i skarpa miljöer.
- Sätt strikta CSP- och CORS-regler i proxyn (API:et är same-origin).
- Rotera sessionshemligheter genom att rensa tabellen `auth_tokens`.

## Externa tjänster (valfria)

1. **OpenAI-kompatibel AI:** fyll i `AI_BASE_URL`, `AI_MODEL`, `AI_API_KEY`.
   Om tjänsten är otillgänglig returneras validerade reservsvar från den lokala
   motorn och spelet fortsätter att fungera.
2. **E-post/utskick:** inte implementerat; integritetsbegäranden hamnar i
   `privacy_requests` för manuell hantering.

## Säkerhetsprinciper i drift

- Hemliga facit finns bara i tabellerna `case_solution_secrets` och
  `case_suspect_secrets`. Ge aldrig API:er eller dashboardar direkt läsrätt
  till dessa tabeller.
- Klienten kan inte rapportera egna poäng – samtliga poäng skapas i
  `score_events` via serverlogik.
- Publicering av användarfall kräver godkänd validering utan kritiska fel.
- Logga aldrig förhörstexter, teorier eller facit till analyssystem. Den
  inbyggda åtkomstloggen (`audit_logs`) noterar bara händelsetyp och mottagare.

## Felsökning

| Symtom | Åtgärd |
| --- | --- |
| `Unknown named parameter '0'` | Använd array-parameter i db-hjälparna (hanteras internt). |
| Klient kan inte ansluta WS | Kontrollera att proxyn tillåter Upgrade/Connection-headrar för `/ws`. |
| AI-svar uteblir | Kontrollera kvot i `usage_budgets`; systemet fallback:ar till lokala motorn. |
| Tom databas | Radera `data/` och starta om, eller kör `npm run seed`. |
