# Vägen till Supabase + Vercel

Detta dokument beskriver migreringen från den självhostade SQLite-versionen till
**Supabase Auth + Supabase Postgres + Vercel**. Det är ett medvetet tvåstegsarbete eftersom
appen som ligger i `main`/preview är grön och testad (38/38) och inte får gå sönder under vägen.

## Status

| Del | Status |
| --- | --- |
| Supabase-projekt | **Klart** — `sparly`, ref `bwvgajaihcdmhaawwojp`, region `eu-north-1`, Postgres 17 |
| Postgres-schema | **Klart och verifierat** i `server/src/pg/migrations.ts` (körs av `npm run check:schema` mot en inbäddad Postgres) |
| Databasanslutning i appen | **Kvar** — `server/src/db.ts` portas från `better-sqlite3` (synkron) till asynkron Postgres |
| Supabase Auth i appen | **Kvar** — kräver att datalagret är asynkront först (tokenutbyte skapar en användarrad) |
| Publicering på Vercel | **Kvar** — ett serverlöst API kan inte använda en lokal SQLite-fil, därför är datalagret en förutsättning |

## Varför datalagret måste först

Vercel kör API:t som serverlösa funktioner. Filsystemet är skrivskyddat utom `/tmp`, som töms vid
kallstart. En SQLite-fil kan därför inte vara auktoritativ för sparande på Vercel. Data måste ligga i
Supabase Postgres, och eftersom `better-sqlite3` är synkront medan Postgres är asynkront måste
service-lagret skrivas om. Schemat, reglerna och SQL:en är oförändrade — det är anropen som får
`await`.

## Steg 1 — datalager (Postgres)

1. `server/src/db.ts` får ett `Db`-gränssnitt med `query/one/run/exec/tx`. Två implementationer:
   `pg` (Supabase Postgres i produktion) och PGlite (samma Postgres-motor, in-process, för
   utveckling och tester). Ingen SQLite kvar.
2. Alla services (`accounts`, `sessions`, `goals`, `transactions`, `achievements`, `competitions`,
   `groups`, `dashboard`) blir asynkrona. SQL:en portas mekaniskt: `?` → `$n`,
   `INSERT OR IGNORE` → `ON CONFLICT DO NOTHING`, `rowid` → `created_at DESC, id DESC`,
   `strftime` → `left(occurred_at, 7)`.
3. `migrations.ts` ersätts av `pg/migrations.ts` (redan skrivet). Migreringar körs vid start och
   spåras i `schema_migrations`.
4. Testerna flyttas till PGlite. Samma 38 scenarier ska fortsätta vara gröna, nu mot Postgres.

## Steg 2 — Supabase Auth

1. `POST /api/auth/session` tar en Supabase-access-token, verifierar den mot
   `GET /auth/v1/user` (med anon-nyckeln) och skapar en serversidig session för appens egna
   endpoints. Verifieraren är injicerbar så att testerna kan köra utan nätverk.
2. Användarraden skapas vid första inloggningen med Supabase `sub` (UUID) som `users.id`; alias,
   samtycke och integritetsval ligger kvar i appens `profiles`.
3. Registrering, inloggning, lösenordsåterställning och lösenordsbyte sker i webbläsaren via
   `@supabase/supabase-js`. Servern lagrar aldrig lösenord.
4. Kontoradering raderar appens data i en transaktion och därefter auth-användaren via
   Admin-API:t med service-role-nyckeln (endast server-side).
5. Auth-inställningar: `mailer_autoconfirm = true` (ingen SMTP i demomiljön), `password_min_length = 10`,
   `site_url` = produktionsdomänen, `uri_allow_list` = återställnings-URL:er.

## Steg 3 — Vercel

1. `api/index.js` exporterar Express-appen som en serverlös funktion; `vercel.json` routar
   `/api/*` dit och låter övriga vägar servera den statiska Vite-byggen.
2. Miljövariabler: `DATABASE_URL` (Supabase pooler), `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
   `COOKIE_SECURE=1`, `COOKIE_SAMESITE=Lax`, `ALLOWED_ORIGINS`.
3. Projektet kopplas till GitHub-repot så att varje push till sessionens gren ger en förhandsvisning
   och produktion uppdateras från `main`.
4. Efter första deployen: verifiera `/api/health`, registrering, inloggning, ett sparmål och en
   insättning mot den publika URL:en.

## Vad som redan är verifierat

`npm run check:schema` skapar en tom Postgres-databas, kör alla fem migreringarna och bevisar att
triggarna fungerar:

```
migration 001 core_accounts_sessions_audit ok
migration 002 savings_goals_transactions_ledger ok
migration 003 achievements ok
migration 004 groups_invitations ok
migration 005 competitions_and_snapshots ok
ledger immutable -> savings_ledger_append_only
goal owner guard -> goal_owner_mismatch
```

Det betyder att huvudboken inte kan skrivas över, att en transaktion inte kan peka på någon annans
mål och att frysta tävlingssnapshots samt slutresultat är oföränderliga — samma skydd som i
SQLite-versionen, nu uttryckta som `plpgsql`-triggers.
