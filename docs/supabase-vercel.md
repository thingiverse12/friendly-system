# Supabase + Vercel — genomförd migrering

Sparly kör nu på **Supabase Auth** (inloggning), **Supabase Postgres** (all data) och **Vercel**
(publicering). Det här dokumentet beskriver vad som faktiskt är gjort, varför, och exakt vad som är
verifierat — och vad som inte kunnat verifieras från arbetsmiljön.

## Publika adresser

| Tjänst | Adress |
| --- | --- |
| App (produktion) | https://sparly-zeta.vercel.app |
| API-hälsokontroll | https://sparly-zeta.vercel.app/api/health |
| Vercel-projekt | `sparly` (`prj_P7NmKgeaKNRlFw2W0nJXeJ2eQtMQ`), team `vinciel-8425s-projects` |
| Supabase-projekt | `sparly`, ref `bwvgajaihcdmhaawwojp`, region `eu-north-1` |
| GitHub | `thingiverse12/friendly-system`, gren `arena/bc9a18a0-friendly-system` |

## Status

| Del | Status |
| --- | --- |
| Postgres-schema | **Klart** — 6 migreringar i `server/src/pg/migrations.ts`, applicerade på Supabase och registrerade i `schema_migrations` (001–006) |
| Datalager i appen | **Klart** — `pg` i produktion, PGlite i test; all SQL är Postgres |
| Supabase Auth | **Klart** — `POST /api/auth/session` verifierar access-token mot `/auth/v1/user` och utfärdar appens egen server-session |
| Kontoradering | **Klart** — appens data först, Supabase Auth-användaren sist (service-role, endast server-side) |
| Publicering | **Klart** — Vercel-funktion `api/[...path].js` + statisk Vite-build, produktionsdomän tilldelad |
| Tester | **38/38 gröna** mot PGlite (Postgres i WebAssembly) med testidentitetsprovider |

## 1. Databasen

Migreringarna ligger kvar i kod (`server/src/pg/migrations.ts`) och körs automatiskt vid serverstart
och vid Vercels kallstart. På Supabase-projektet applicerades exakt samma SQL som en migration
(`sparly_initial_schema`) och `schema_migrations` fylldes med 001–006, så appens `migrate()` är en
no-op men kan fortfarande lägga till nya migreringar senare.

Samma skydd som tidigare, nu som `plpgsql`-triggers:

* `savings_ledger_append_only` — huvudboken kan inte skrivas över.
* `goal_owner_mismatch` — en transaktion kan inte peka på någon annans sparmål.
* `locked_snapshot_immutable`, `final_score_immutable`, `competition_finalised` — frysta
  tävlingsögonblick och slutresultat kan inte ändras.

Nytt i porten: `seq BIGINT IDENTITY` på `savings_goals`, `transactions` och `savings_movements` så att
listordningen är deterministisk även när två rader har samma tidsstämpel (testklockan kan frysa tiden),
samt att alla `AS "camelCase"`-alias är citatteckenomslutna eftersom Postgres annars viker dem till gemener.

Anslutningssträng: **Supavisor transaction pooler**,
`postgresql://postgres.<ref>:<lösenord>@aws-0-eu-north-1.pooler.supabase.com:6543/postgres`, med
`postgres.<ref>` som användarnamn. Poolerns index (`aws-0` / `aws-1`) går inte att härleda från
regionen, så värdet togs från Supabase Connect-dialogen och verifierades med `/api/health`, som
rapporterar den faktiskt använda värden.

Direktanslutningen `db.<ref>.supabase.co` användes aldrig — den behövdes inte. Att den är
IPv6-only utan IPv4-tillägget är sant på Supabase, men det var **inte** orsaken till något av felen
under driftsättningen (de satt i appens databasskikt och i en miljövariabel, se nedan).

Två fel som kostade tid och vad de egentligen berodde på:

1. `Maximum call stack size exceeded` vid kallstart — appens `scopeAware()`-wrapper returnerade sig
   själv när en transaktion var aktiv, vilket gav oändlig rekursion i `db.tx`. Rättat i
   `server/src/db.ts` (guarden `if (!active || active === wrapper) return db;`).
2. `ENOTFOUND tenant/user postgres.<ref> not found` — den *känsliga* Vercel-variabeln `DATABASE_URL`
   hade ett tomt värde i funktionen. `update_env_var` på känsliga variabler slår inte alltid igenom
   på det som funktionen får; radera och återskapa variabeln löste det.

## 2. Inloggningen (Supabase Auth)

1. Webbläsaren loggar in direkt mot Supabase (`signInWithPassword` / `signUp`). Lösenordet lämnar
   aldrig webbläsaren och finns inte i någon tabell i appens schema.
2. `POST /api/auth/session { accessToken, alias?, publicCompetitionConsent? }` verifierar token mot
   `GET ${SUPABASE_URL}/auth/v1/user` med anon-nyckeln och skapar `users` + `profiles` med
   `users.id = auth.uid` första gången (`201`), annars `200`.
3. Servern sätter sin egen `sparly_session`-cookie (HttpOnly, `sha256`-hashad i databasen) och
   returnerar en CSRF-token. **Vanliga API-anrop pratar aldrig med Supabase** — de validerar bara
   sessionsraden, vilket gör dem snabba och omedelbart återkalleliga.
4. Per-enhet-sessioner: två inloggningar ger två rader, utloggning på en enhet rör inte den andra.
5. Lösenordsbyte och kontoradering kräver ett **färskt** access-token (ny inloggning i webbläsaren) —
   en stulen sessionscookie kan alltså inte byta lösenord eller radera kontot.
6. Radering: appens data raderas i en transaktion, därefter Supabase Auth-användaren via Admin-API:t
   med service-role-nyckeln. Nyckeln används bara server-side och når aldrig webbläsaren.

Auth-inställningar på projektet: `site_url = https://sparly-zeta.vercel.app`, återställnings-URL:er
vitlistade för produktionsdomänen, förhandsdomänerna `sparly-*.vercel.app` och lokal utveckling
(`localhost:3000`, `localhost:5173`), `mailer_autoconfirm = true` — ingen SMTP är kopplad till
projektet, så konton aktiveras direkt i stället för att fastna i "väntar på bekräftelse".
`password_min_length` är Supabase-standard (6); gränssnittet kräver 8 tecken både vid registrering
och vid lösenordsbyte.

## 3. Vercel

* `vercel.json`: `buildCommand: npm run build`, `outputDirectory: web/dist`, SPA-rewrite till
  `/index.html`, cache-headers för `/assets`.
* `api/[...path].js` → `api/_app.js`: skapar Express-appen **en gång per varm instans**, kör
  migreringarna vid kallstart och sweppar tävlingslivscykeln högst en gång i minuten. Ingen
  långlivad timer behövs eftersom resultat räknas ut från servertid. En misslyckad kallstart
  cachas inte — nästa request försöker igen.
* `/api/health` svarar med `database`, `databaseHost` och ett `auth`-block som visar om
  Supabase-uppgifterna finns (`supabaseUrl`, `anonKey`, `serviceRoleKey` — endast `true`/`false`)
  samt om Supabase Auth faktiskt svarar (`reachable`, `status`) från Vercels nätverk.
* Miljövariabler (Production + Preview + Development): `DATABASE_URL`, `DATABASE_POOL_SIZE=3`,
  `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`, `TRUST_PROXY=1`.
* Node 24, funktionsregion `iad1` (Vercels standard). Databasen ligger i `eu-north-1`, så varje
  databasrundtur korsar Atlanten — flytta gärna funktionsregionen till `arn1` i
  projektinställningarna om latensen märks.

## Vad som är verifierat och vad som inte är det

**Verifierat här:**

* `npx tsc -p server/tsconfig.json --noEmit` och `npx tsc -p web/tsconfig.json --noEmit` — inga fel.
* `npm test` — 38/38 tester gröna mot PGlite (samma SQL som produktion).
* `npm run build` — SPA + server kompilerar.
* Supabase: 16 tabeller i `public`, `schema_migrations` 001–006, auth-konfiguration uppdaterad.
* Vercel: bygget går igenom, produktionen ligger på `sparly-zeta.vercel.app`.
* **Kallstart mot riktig databas** (verifierat via `/api/health?diag=<sha>`):

  ```json
  {"status":"ok","database":"ok","databaseHost":"aws-0-eu-north-1.pooler.supabase.com:6543",
   "auth":{"supabaseUrl":true,"anonKey":true,"serviceRoleKey":true,"reachable":true,"status":200}}
  ```

  Det vill säga: funktionen når Supabase Postgres, migreringarna är applicerade, de tre
  Supabase-variablerna finns i funktionen och GoTrue svarar `200` från Vercels nätverk.

**Inte verifierat här (och varför):**

* **Anrop mot den publika appen** — arbetsmiljön har ingen utgående HTTPS (allt utom en vitlista
  stängs av en proxy), så GET-anrop mot `*.vercel.app` gjordes via ett sidhämtningsverktyg.
  POST-anrop, cookies och redirects kan därför inte köras härifrån.
* **Inloggning/registrering i riktig webbläsare** — hela kedjan (Supabase `signUp`/`signInWithPassword`
  → `POST /api/auth/session` → cookie → inloggad dashboard) måste köras i en webbläsare med
  internet. Det är den enda kontroll som återstår, och den kräver ett klick från en människa.
* **Deployment Protection.** Vercel-projekt skapas med "Vercel Authentication" för alla deployment
  utom egna domäner. Ser appen ut att kräva Vercel-inloggning: stäng av det under
  *Project → Settings → Deployment Protection*.

