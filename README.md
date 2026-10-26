# Sparly — Små steg. Stora mål.

A complete, standalone, mobile-first savings app with gamified goals, achievements and optional
savings competitions. Swedish UI, Scandinavian visual language (deep pine navy, emerald accents,
restrained gold for achievements), server-rendered truth.

> **Live stack:** React + TypeScript (Vite) · Express 5 + TypeScript on **Vercel** · **Supabase Auth**
> for login · **Supabase Postgres** for all application data. No Lovable, no mock data, no
> frontend-only storage: every account, balance, competition result and permission lives in Postgres
> and is authorised on the server for every request.
>
> **Live app:** https://sparly-zeta.vercel.app · **health:** https://sparly-zeta.vercel.app/api/health
> · migration/deployment report: [`docs/supabase-vercel.md`](docs/supabase-vercel.md)

## 1. What is included

| Area | Implemented |
| --- | --- |
| Accounts | Registration, login, logout, password change, password reset (Supabase Auth), account deletion |
| Security | Supabase-verified tokens, server-side sessions, HttpOnly cookies, CSRF double-submit, same-origin checks, rate limits, audit log |
| Savings goals | Create, edit, archive, delete, privacy flag, locked target during competitions |
| Transactions | Income/expenses with categories, optional private description, filters, search by period, edit/delete |
| Savings ledger | Append-only deposit/withdrawal ledger, exact integer öre, balances derived from movements |
| Progress | Saved / target / remaining / percentage, milestone timeline |
| Achievements | Five verified milestones, duplicate-proof awards, five levels, badge opt-in for leaderboards |
| Competitions | 7- and 30-day, public + private groups, automatic lifecycle, server-side scoring, frozen finals, sharing ranks |
| Groups | Create, invite by hashed one-time codes, revoke, leave, ownership transfer, group-only leaderboards |
| Privacy | Alias-only leaderboards, explicit public-competition consent (default **off**), badge sharing opt-in |
| UX | Mobile bottom navigation + desktop sidebar, loading/empty/error/success states, reduced-motion support, keyboard focus rings |
| Ops | Postgres migrations, Vercel function, Docker image, health check, test suite |

Screens: Dashboard, Savings goals, Goal detail, Transactions, Competitions, Competition leaderboard,
Private groups + group detail, Achievements, Profile & privacy, Login, Registration, Password reset,
404. Every button performs its action; every form validates server-side **and** client-side.

---

## 2. Architecture

```
┌───────────────────────────────────┐
│ React 19 + TypeScript (Vite)      │   browser
│ web/src · mobile-first SPA        │
└───────┬───────────────────┬───────┘
        │ 1. e-mail+lösenord│ 2. POST /api/auth/session { accessToken }   (once per login)
        ▼                   ▼
┌──────────────────┐  ┌──────────────────────────────────────────┐
│ Supabase Auth    │  │ Express 5 · Vercel Function              │
│ (GoTrue)         │◄─┤ server/src  routes → services → lib       │
│ owns credentials │  │ session cookie (HttpOnly) + sha256 in DB │
└──────────────────┘  └───────────────────┬──────────────────────┘
                                          │ parameterised SQL (`pg`, Supavisor :6543)
                                          ▼
                        ┌──────────────────────────────────────────┐
                        │ Supabase Postgres · public schema        │
                        │ integer öre · CHECK · triggers · indexes │
                        └──────────────────────────────────────────┘
```

**Login flow (Supabase Auth owns the credentials).** The browser signs in directly against Supabase
(`signInWithPassword`); the password never touches this API. The resulting access token is sent
**once** to `POST /api/auth/session`, which verifies it against `${SUPABASE_URL}/auth/v1/user`,
provisions the local `users`/`profiles` rows with `users.id = auth uid`, and issues the app's own
server-side session cookie. Ordinary API requests therefore never call Supabase — they validate a
session row, which keeps them fast, revocable and independent of JWT expiry.

**Why this stack**

* The user asked for **Supabase for login and Vercel for publishing**. Vercel functions have no
  persistent disk, so the data layer moved to **Supabase Postgres** as a consequence — the whole app
  is now stateless at the edge and survives redeploys and cold starts.
* One SQL dialect everywhere: production runs real Postgres, tests run **PGlite** (the same Postgres
  compiled to WebAssembly), so the suite exercises the exact statements that production executes.
* Money stays **integer öre** (`BIGINT`, 1 SEK = 100 öre) and scores stay **integer centi-points**.
  No floating point anywhere, and `int8`/`numeric` are parsed to JS numbers at the driver level.
* Sessions are server-managed rows: revocation is immediate, nothing security-relevant is stored in
  the client, and logging out one device leaves the others untouched.
* Vanilla React + a small `fetch` wrapper keeps the dependency and security surface small.

### Project layout

```
server/src
  app.ts                 express app: security headers, sessions, CSRF, routes, SPA fallback
  index.ts               long-lived server bootstrap (migrations, lifecycle sweep, shutdown)
  db.ts                  pg/PGlite handle, migrations, transactions, audit helper
  pg/migrations.ts       versioned Postgres schema (001–006) + achievement seed
  config.ts              environment configuration
  lib/                   money, cookies, http middleware, validation, time
  services/              accounts, goals, transactions, achievements, competitions, groups,
                         dashboard, sessions, supabase (Auth provider)
  routes/                auth+profile, goals, transactions, dashboard, achievements,
                         competitions, groups
api/
  _app.js                Vercel function: caches the Express app per instance, migrates on cold start
  [...path].js, index.js thin re-exports so every /api/* path reaches the function
vercel.json              build/output, function config, SPA rewrite, headers
web/src
  supabase.ts            Supabase client (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
  auth.tsx, api.ts, types.ts, format.ts, toast.tsx, hooks.ts
  components/            AppShell, UI primitives, Cards, Forms, Icon, illustrations
  pages/                 Auth, Dashboard, Goals, GoalDetail, Transactions, Competitions,
                         CompetitionDetail, GroupDetail, Achievements, Profile, NotFound
  styles.css, pages.css  design tokens, layout, components, responsive + reduced motion
tests                    server/tests — 38 integration/unit tests (vitest + supertest)
```

---

## 3. Quick start

Prerequisites: **Node 22+** and a Supabase project (the free tier is enough). You need the project
URL, the anon key and the service-role key, plus the database connection string.

```bash
npm install
npm run build                     # builds the SPA (Vite) and the server (tsc → dist/)

# Point the app at your Supabase project (see .env.example for every variable)
export DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-<n>-<region>.pooler.supabase.com:6543/postgres"
export SUPABASE_URL="https://<ref>.supabase.co"
export SUPABASE_ANON_KEY="<anon key>"
export SUPABASE_SERVICE_ROLE_KEY="<service_role key>"
export VITE_SUPABASE_URL="$SUPABASE_URL"        # read at *build* time by Vite
export VITE_SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"

npm start                         # http://localhost:3000 — migrates, seeds, serves API + SPA
```

Without `DATABASE_URL` the server falls back to **PGlite** in `./data/pglite` (real Postgres
semantics, no server needed) — handy for local UI work, but login still requires Supabase Auth
because credentials are never handled locally.

Useful scripts:

| Script | Purpose |
| --- | --- |
| `npm run dev:server` | API with `tsx watch` (port 3000) |
| `npm run dev:web` | Vite dev server with `/api` proxy (port 5173) |
| `npm run build` / `npm start` | Production build / run from compiled `dist/` |
| `npm test` | Vitest suite (38 tests, PGlite, no network) |
| `npm run typecheck` | Server + web type check |

### Configuration

See `.env.example`. The important ones:

| Variable | Default | Notes |
| --- | --- | --- |
| `DATABASE_URL` | – | Supabase Postgres, **transaction pooler** (`...pooler.supabase.com:6543`). Required in production |
| `DATABASE_SSL` | auto | `1` forces TLS; Supabase hosts enable it automatically (`rejectUnauthorized: false`) |
| `DATABASE_POOL_SIZE` | `5` | Keep low (3) on serverless |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | – | Used to verify access tokens (`/auth/v1/user`) |
| `SUPABASE_SERVICE_ROLE_KEY` | – | Only used to delete the Auth user when an account is erased |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | – | Baked into the SPA at build time |
| `PORT` / `HOST` | `3000` / `0.0.0.0` | Bind all interfaces so previews/proxies work |
| `COOKIE_SECURE` | auto (`1` in production) | Must be `1` behind HTTPS; `0` only for local HTTP |
| `COOKIE_SAMESITE` | `Lax` | `None` (with `COOKIE_SECURE=1`) only when embedded in a cross-site iframe |
| `SESSION_TTL_HOURS` | `336` | Server-side expiry, validated per request |
| `ALLOWED_ORIGINS` | – | Extra origins allowed to call the API |
| `TRUST_PROXY` | – | `1` behind Vercel/nginx/ALB so rate limits see the real client IP |

---

## 4. Data model

Tables (all with primary keys, foreign keys, CHECK constraints and indexes):

`users` · `profiles` · `sessions` · `audit_events` · `rate_limits` ·
`savings_goals` · `transactions` · `savings_movements` · `achievements` · `user_achievements` ·
`competitions` · `competition_participants` · `private_groups` · `group_members` · `invitation_codes`

Highlights:

* `users.id` is the **Supabase Auth user id** (UUID) — credentials stay in the `auth` schema and are
  never duplicated here; `users` stores only e-mail, verification flag and timestamps. `profiles` holds alias, normalized alias (unique), timezone,
  `public_competition_consent` (default `0`), `share_badges` (default `0`) and creation time.
* `savings_goals.target_amount_ore` / `balance_ore` are integers with `CHECK` bounds; `privacy`
  defaults to `private`; `archived_at` is optional.
* `transactions` store positive integer `amount_ore`, `type IN ('income','expense')`, category,
  optional private description, `occurred_at` and `created_at`. A trigger guarantees a transaction
  can only reference a goal owned by the same user.
* `savings_movements` is the append-only savings ledger: deposits/withdrawals with
  `balance_after_ore`. Updates are blocked by a trigger (`savings_ledger_append_only`), so history
  cannot be rewritten to fake a competition score.
* `competition_participants` stores the frozen `starting_balance_ore`, `locked_target_ore`,
  `class_code` and `snapshot_frozen_at`. Triggers reject any later change to a frozen snapshot and
  any second write of `final_score_centi` / `final_rank`.
* `invitation_codes` stores **only** `sha256(code)` plus expiry, usage limit/counter and revocation.
* `savings_goals.balance_ore` is only ever changed by the movement service inside a transaction,
  together with the matching ledger row.
* `savings_goals`, `transactions` and `savings_movements` carry a `seq BIGINT IDENTITY` column so
  list order is deterministic even when two rows share a timestamp (the test clock can freeze).

Migrations are ordered SQL statements executed once inside a transaction and recorded in
`schema_migrations`, so a fresh database is reproducible. The same module runs locally (PGlite) and
against Supabase Postgres, and runs automatically on server start and on Vercel cold start.

---

## 5. Security model

**Authentication — Supabase Auth**

* Credentials live **only** in Supabase Auth (GoTrue). This API never receives, stores or hashes a
  password, and there is no password column anywhere in the schema.
* Registration and login happen in the browser against Supabase; account creation is provisioned in
  the app on the first `POST /api/auth/session` (server-side, from the verified token claims).
* The token is verified against `${SUPABASE_URL}/auth/v1/user` with the anon key. Invalid or expired
  tokens return a generic `401` (“Inloggningen har gått ut”); malformed requests are `422`.
* Only one network call to Supabase per login. Every subsequent request uses the app session.
* App sessions: 256-bit random token, only `sha256(token)` stored, `HttpOnly` + `Secure` (production)
  + `SameSite`, per-device rows with expiry, `last_seen_at` and revocation. Logging out one device
  does not touch the others.
* Password change and account erasure require a **fresh** Supabase access token obtained by
  re-authenticating — a hijacked session cookie alone cannot rotate the password or destroy the
  account. Account erasure additionally requires the literal confirmation `RADERA`.
* Rate limits (persisted in Postgres, so they survive restarts and scale across instances):
  session exchange 8/15 min, invitation joins 15/15 min, competition joins 20/h, group creation 10/h,
  invitation creation 30/h.

**Authorisation** — enforced in services, not in the UI:

| Attempt | Result |
| --- | --- |
| Any financial endpoint without a session | `401` |
| Read/patch/delete another user's transaction | `404` (existence not disclosed) |
| Read/update/archive/delete another user's goal, or move money into it | `404` |
| Link a transaction to a foreign goal | `404` + database trigger |
| Group member reading another member's goal, ledger or balance | `404` |
| Non-owner minting or revoking invitations | `403` |
| Follower of a private competition (outsider) | `404`, never listed |
| Join a public competition without consent | `403` |
| Submit or overwrite a score / snapshot / final result | `403`/`404` and blocked by triggers |
| State-changing request without CSRF token or from a foreign origin | `403` / `400` |
| Delete someone else's account by replaying another token | `403` (token identity must match) |

**Transport & headers** — `Content-Security-Policy` (no inline scripts, `frame-ancestors *` so a
sandbox preview can embed the app), `X-Content-Type-Options: nosniff`, `Referrer-Policy`,
`Permissions-Policy`, HSTS in production. All SQL uses bound parameters; every request body is
validated with a strict Zod schema; React escapes all rendered strings by default and the API only
serves JSON with `nosniff`. The service-role key is only ever read server-side.

**Not in scope / explicitly absent** — no card, bank or payment integrations, no bank credentials,
no third-party analytics, no secrets in the frontend bundle (only the public anon key ships to the
browser, as intended by Supabase).

---

## 6. Competitions

### Scoring

```
score = 100 × (current_balance − starting_balance) / locked_target_amount
```

* `starting_balance` and `locked_target` are frozen by the server (never by the client) when the
  competition starts or when a participant joins an already-started competition.
* Only net savings changes after the snapshot count. Withdrawals reduce the score; negative scores
  are allowed and shown in red.
* Scores are stored/ranked as integer centi-points (1/100 point) to avoid floating point drift.
* Ties share a rank and the next rank skips (`1, 2, 2, 4`).
* Nothing a client sends can raise a score: there is no score endpoint, and `POST /score` returns
  `403`. Paid features do not exist in this MVP; if added they must not feed into the formula.
* **Classes** (`A1`–`D4`) bucket participants by locked target band and starting share. They improve
  comparability but do not equalise personal finances — stated in the UI.

### Lifecycle

| Phase | Behaviour |
| --- | --- |
| Discovery | Public competitions auto-created (a 7-day and a 30-day are always available), private ones only for group members |
| Before start | Ownership of the chosen goal verified; goal must be active; consent/membership checked; duplicate participation rejected by `UNIQUE(competition_id, user_id)`; snapshot deferred |
| At start (server time) | Upcoming competitions are activated atomically, snapshots and classes frozen, audit event written |
| During | Scores computed from authoritative balances; target changes rejected (`409`); archiving/deleting a participating goal rejected; withdrawals allowed and reflected |
| At end | Final scores and ranks computed by the server, frozen, competition marked `completed`, leaderboard switches to stored finals |
| Withdrawal | `POST /competitions/:id/withdraw` marks the participant withdrawn: removed from leaderboard and scores, cannot rejoin |
| Cancelled competitions | Status `cancelled` never ranks or accepts joins |
| Account deletion | Participations are removed; the user disappears from all leaderboards |
| Archived goal | Cannot be used in new competitions and cannot be archived while participating |

The lifecycle sweep is idempotent, runs on every competition request and on a 60-second interval,
always using server time (`SPARLY_ALLOW_CLOCK_OVERRIDE` only exists for tests and is refused unless
explicitly enabled).

### Privacy of leaderboards

`GET /api/competitions/:id/leaderboard` selects a dedicated projection: **alias, rank, score, class
and an approved badge**. It never selects e-mails, names, targets, balances, goal names or
transactions, and it exposes no other participant's starting snapshot. The viewer's own
participation (own starting balance, locked target, class) is only returned by the participant-scoped
competition detail response.

---

## 7. Groups and invitation codes

* Codes are 12 characters from an unambiguous alphabet (no I/O/0/1), displayed once and stored only
  as `sha256(code)`.
* Rules enforced in one IMMEDIATE transaction: existence, revocation, expiry, `uses_count < max_uses`,
  membership, and a conditional `UPDATE … WHERE uses_count < max_uses` whose row count must be 1.
  A `CHECK (uses_count <= max_uses)` constraint is the last line of defence.
* Owners can set usage limits (1–100), expiry (1 h – 90 days or never), labels, and revoke codes.
* Leaving as owner transfers ownership to the earliest remaining member; leaving as the last member
  deletes the group and its private competitions.
* Membership grants no access to other members' financial records — only alias, role and join date.

---

## 8. Account deletion policy

`DELETE /api/profile/account` requires a **fresh Supabase access token** (obtained by re-entering the
password in the browser, verified server-side against `/auth/v1/user`) **and** the literal
confirmation `RADERA`. The token must belong to the signed-in user. On success, and inside one
transaction:

1. Group ownership is transferred to the earliest remaining member (groups without other members are
   deleted together with their private competitions).
2. All sessions are revoked.
3. The user row is deleted; `ON DELETE CASCADE` removes profile, goals, ledger movements,
   transactions, achievements, group memberships, invitations they created and competition
   participations.
4. Competitions keep working: the user simply no longer appears in any leaderboard.
5. The audit log keeps one pseudonymous `account.deleted` row (random UUID + counts, no e-mail,
   alias or amounts) plus an `account.deletion_policy_applied` marker containing the erased user id,
   which is what regulators need to prove the erasure happened.
6. Only then is the **Supabase Auth user** deleted with the service-role key — if that call fails
   the request fails loudly instead of leaving an orphaned login.

---

## 9. API summary

All endpoints are under `/api`; every mutating call needs `X-CSRF-Token` (the value from
`/api/auth/me`, also set as a readable cookie). Errors are `{ error: { code, message, details? } }`.

| Method & path | Description |
| --- | --- |
| `GET /auth/csrf` · `GET /auth/me` | Anonymous token / current session + profile + stats |
| `POST /auth/session` | Exchange a Supabase access token for an app session (`201` on first creation, `200` afterwards) |
| `POST /auth/logout` | Revoke this device's session |
| `GET/PATCH /profile` · `GET /profile/alias-available` · `DELETE /profile/account` | Alias, timezone, consent, badges, deletion |
| `GET /dashboard` | Aggregated overview |
| `GET/POST /goals` · `GET/PATCH/DELETE /goals/:id` · `POST /goals/:id/archive\|unarchive` | Goals |
| `GET/POST /goals/:id/movements` | Savings ledger (deposit/withdrawal) |
| `GET/POST /transactions` · `GET/PATCH/DELETE /transactions/:id` · `GET /transactions/summary` | Cash flow |
| `GET /achievements` | Catalog, awards history, level ladder |
| `GET /competitions` · `GET /competitions/:id` · `GET /competitions/:id/leaderboard` | Discovery, detail, allowed-only leaderboard |
| `POST /competitions/:id/join` · `POST /competitions/:id/withdraw` | Participation |
| `GET/POST /groups` · `GET /groups/:id` · `POST /groups/join` · `POST /groups/:id/leave` | Groups |
| `POST/DELETE /groups/:id/invitations[/:invitationId]` | Invitation codes (plaintext shown once) |
| `POST /groups/:id/competitions` | Private group competition |
| `GET /health` | Liveness probe |

Amounts are always integer **öre** in the API (`amountOre: 125050` = 1 250,50 kr).

---

## 10. Tests

```bash
npm test
```

Environment: Node 22.22, vitest 5, supertest, **PGlite** (Postgres in WebAssembly) with a fresh
database and the real SQL migrations per suite, Supabase Auth replaced by a test identity provider
(`test:<uuid>:<email>` tokens, only available with `NODE_ENV=test`). Arc: 8 files,
**38 tests, 38 passed, 0 failed, 0 skipped** (~70 s). Database, HTTP layer and authorisation are
exercised end-to-end through the real Express app; time is frozen with the test-only clock.

| # | Requirement | Where it is verified | Result |
| --- | --- | --- | --- |
| 1 | Unauthenticated users cannot access financial data | `auth.test.ts` → "rejects every financial endpoint without a session", "forged session cookies are ignored" | Passed |
| 2 | User A cannot read or modify User B's transactions | `authorization.test.ts` → "hides and protects other users' transactions", "... goals, balances and ledgers" | Passed |
| 3 | Group members cannot access one another's balances | `authorization.test.ts` → "shares only aliases and roles inside a group" | Passed |
| 4 | Leaderboards never expose private financial fields | `authorization.test.ts` → "returns only alias, rank, score, class and approved badge" | Passed |
| 5 | Public participation is disabled by default | `auth.test.ts` → "defaults public consent to false…" | Passed |
| 6 | Invalid monetary amounts are rejected | `money.test.ts` → "rejects bad amounts on goals, movements and transactions" + parser unit tests | Passed |
| 7 | Deposits and withdrawals update balances correctly | `money.test.ts` → "updates the goal balance and appends to the savings ledger" | Passed |
| 8 | Income does not automatically count as savings | `money.test.ts` → "keeps transactions out of savings balances and ledgers" | Passed |
| 9 | Locked goals cannot change target during an active competition | `competitions.test.ts` → "rejects target changes, archiving and deletion…" | Passed |
| 10 | Scoring follows the specified formula | `competitions.test.ts` → "scores 100 × (current − starting) / locked target…" (5000/1000/1500 → 10 points, negatives, shared ranks) | Passed |
| 11 | Historical savings generate no competition points | `competitions.test.ts` → "ignores savings made before the competition starts", "snapshots upcoming competitions…" | Passed |
| 12 | Clients cannot modify locked snapshots or final scores | `competitions.test.ts` → "blocks score submission, snapshot edits and final result changes" (HTTP + direct SQL triggers) | Passed |
| 13 | Duplicate competition membership is rejected | `competitions.test.ts` → "rejects a second participation from the same user" | Passed |
| 14 | Expired and revoked invitation codes fail | `groups.test.ts` → "rejects revoked, expired and unknown codes" | Passed |
| 15 | Invitation usage limits hold under concurrent requests | `groups.test.ts` → "enforces max uses…", "keeps the usage limit correct under concurrent requests from separate connections" | Passed |
| 16 | Achievements cannot be granted repeatedly | `achievements.test.ts` → "awards each milestone once per goal and keeps the history", "grants the full ladder exactly once at 100 %" | Passed |
| 17 | Account deletion follows the documented policy | `account.test.ts` → "requires password confirmation and deletes all personal and financial data", "removes the user from competition leaderboards" | Passed |
| 18 | The application works on mobile and desktop | `ui.test.ts` → viewport/responsive/reduced-motion/6-destination checks, SPA deep-link delivery, API 404 + health | Passed (static + delivery checks; see below) |

Additional security tests included in the suite: CSRF missing/wrong/foreign-origin rejection,
session-exchange rate limiting (12 attempts → `429`, no user created), SQL-injection attempts leaving
data intact, no credential columns in the schema (`users` has no `password_hash`), duplicate e-mail
handling, per-device session isolation (two sessions, one revoked), profile validation (alias
uniqueness, timezone, length), group ownership transfer, private competitions hidden from outsiders,
and audit-log pseudonymisation.

**Not executed (reported honestly, not claimed as passed)**

* **Real browser E2E / visual regression / screenshots** — no browser binary (Chromium/Firefox) is
  available in this sandbox, so responsive rendering, keyboard navigation and the six-tab layout are
  verified by static assertions and manual CSS review, not by an automated viewport test. The suite
  does verify that the built SPA is served for deep links, which is the server-side part of mobile
  reload behaviour. Run Playwright/Cypress on a machine with a browser for pixel-level checks.
* **Mobile device farm testing** — unavailable here.
* **Supabase Auth over the network** — this sandbox has no outbound access to `*.supabase.co`, so
  the token-verification call is exercised against a test provider with the identical contract.
  What *is* verified from the deployed app: `/api/health` reaches Supabase Auth from Vercel and gets
  `200` (`"auth":{"reachable":true,"status":200}`). The remaining gap is the browser round trip —
  `signUp`/`signInWithPassword` → `POST /api/auth/session` → cookie → dashboard — which needs a
  real browser and a human click.
* **Live Supabase Postgres** — no direct database connection is possible from this sandbox; the
  suite runs the same migrations and queries on PGlite. Schema and queries are byte-identical.
* **E-mail delivery** — confirmation/recovery e-mails are sent by Supabase; whether they arrive
  depends on the project's SMTP configuration (the deployed project uses auto-confirm).

---

## 11. The mascot

The Sparly dog — a scruffy salt-and-pepper wirehaired dog with shaggy eyebrows, a beard, a big
black nose and a navy collar with a gold coin tag — is drawn from a photo of the real dog. It is
pre-rendered at the sizes the UI actually needs (`web/public/mascot/`), so a 64 px avatar never
downloads the 640 px artwork:

| File | Used for |
| --- | --- |
| `hund.png` (640 px) + `-128`, `-256`, `-320` | `<Mascot variant="full" />`, `srcSet`-driven |
| `hund-kropp.png` + `hund-svans.png` (same 992×1079 canvas) | `<Mascot variant="animated" />` — body and tail as separate layers |
| `hund-present.png`, `hund-party.png` (+ `-320` versions) | the celebration poses (`pose="gift"` / `pose="party"`) |
| `hund-ansikte.png` | `<Mascot variant="face" />` — portraits in empty states and the 404 page |
| `hund-ikon-192/512`, `hund-ikon-maskable-512`, `hund-ikon-180` | web app manifest + `apple-touch-icon` (add to home screen) |

**The wag.** The tail is a **separate layer**: `hund-kropp.png` is the dog without a tail and
`hund-svans.png` is the tail alone, both cut from the same 992 × 1079 drawing, so their positions
are exact fractions of that canvas (`Mascot.tsx` derives `left`/`top`/`width`/`transform-origin`
from those numbers). The tail rotates around the point where it meets the hip and sits *behind* the
body (z-index 1 vs 2), so the joint is always covered. The motion is one continuous CSS rotation
(`transform: rotate(-11deg)` → `rotate(11deg)`, 1.15 s, `alternate` with an ease-in-out curve) —
**not** a sequence of frames, which is what made the earlier version look choppy.

**Celebrating a finished goal.** When a deposit takes a goal from below its target to at or above it,
`GoalCelebration` (`web/src/components/Celebration.tsx`) opens in two steps: the dog arrives holding a
wrapped present ("Öppna presenten"), and pressing that button swaps him to the party-hat drawing while
64 CSS confetti pieces fall, spin and drift. A fully saved goal that has not been celebrated yet shows
a "Öppna presenten" card on the goal page, so the moment can always be re-opened. Which goals have been
celebrated is remembered in `localStorage` — that flag is cosmetic and never touches the money data;
deleting the goal clears it. The dialog traps focus, closes on Escape, and the confetti is skipped
entirely under reduced motion.

With `prefers-reduced-motion: reduce` the animation is off and the tail rests six degrees up, so the
dog still looks cheerful. `web/public/maskot-demo.html` shows the real animation at normal speed, at
3 s, on the dark hero background, with reduced motion, and in three sizes.

`web/src/components/Mascot.tsx` is the only place that knows the file names. It appears on the
login/registration screen (hero, bottom right on desktop, above the copy on mobile), as a small
companion in the desktop sidebar, in the empty states for goals/transactions, and on the 404 page.
The artwork is decorative (`aria-hidden`) everywhere except the 404 page, so screen readers are not
narrated a picture on every page.

The source render lives in `assets/mascot/hund-master.png` (not shipped to the browser).

## 12. Deployment

### Vercel (the public deployment)

`vercel.json` describes everything: `npm run build` builds SPA + server, `web/dist` is the static
output, and every `/api/*` request is handled by one function (`api/[...path].js` → `api/_app.js`)
that caches a single Express instance per warm lambda, migrates on first use and runs the
competition lifecycle sweep at most once a minute.

1. Create the project (framework preset **Other**, build `npm run build`, output `web/dist`).
2. Set the environment variables for Production **and** Preview:

   ```
   DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-<n>-<region>.pooler.supabase.com:6543/postgres
   DATABASE_POOL_SIZE=3
   SUPABASE_URL=https://<ref>.supabase.co
   SUPABASE_ANON_KEY=<anon key>
   SUPABASE_SERVICE_ROLE_KEY=<service_role key>
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon key>
   TRUST_PROXY=1
   ```

3. In Supabase → Authentication → URL configuration, set **Site URL** to the deployment URL and add
   `https://<deployment>/aterstall-losenord` to the redirect allow list (password recovery links).
4. Apply the schema: either let the function migrate on the first request, or run
   `DATABASE_URL=... node dist/index.js` once locally. Migrations live in
   `server/src/pg/migrations.ts` and are recorded in `schema_migrations`.
5. `GET /api/health` returns `{"status":"ok","database":"ok","databaseHost":"<pooler host>","auth":{...}}`
   when the connection string and the Supabase keys are right; a failure to connect returns `503`
   with the driver message and the boot stage that failed.

The deployment that is live right now was verified like this (note the cache-busting query — Vercel
caches `/api/health` responses on the CDN, so an old 503 can otherwise survive a redeploy):

```
GET https://sparly-zeta.vercel.app/api/health?diag=<commit sha>
{"status":"ok","time":"...","version":"1.0.0","database":"ok",
 "databaseHost":"aws-0-eu-north-1.pooler.supabase.com:6543",
 "auth":{"supabaseUrl":true,"anonKey":true,"serviceRoleKey":true,"reachable":true,"status":200}}
```

Serverless notes: the pool is small on purpose, Supavisor transaction mode is used, and nothing is
written to disk. Competition lifecycle, which a long-lived server runs on a timer, is swept lazily
per instance — results are recomputed from server time, so no background job is required.

### Docker / any Node host

The same build still runs as a normal process (`node dist/index.js`), which is handy for a
self-hosted instance against the same Supabase project:

```bash
docker build -t sparly .
docker run -d --name sparly -p 3000:3000 \
  -e DATABASE_URL=postgres://... -e SUPABASE_URL=https://<ref>.supabase.co \
  -e SUPABASE_ANON_KEY=... -e SUPABASE_SERVICE_ROLE_KEY=... \
  -e COOKIE_SECURE=1 -e TRUST_PROXY=1 sparly
```

The image runs as an unprivileged user, exposes a health check and serves both the API and the
built SPA. Backups are Supabase's responsibility (daily backups on paid plans; `pg_dump` with the
session-pooler string otherwise).

**Embedded / iframe hosts.** Browsers treat a page in a third-party iframe as cross-site, so the
session cookie must be `SameSite=None; Secure` there. Set `COOKIE_SAMESITE=None` **only** for such a
preview deployment; a normal top-level site keeps the default `Lax`.

### Verifying a deployment

```bash
curl -s https://<deployment>/api/health
curl -sI https://<deployment>/ | grep -i content-security-policy
```

---

## 12. Design notes

* Mobile-first: 360–430 px layouts with a six-item bottom tab bar; ≥ 900 px switches to a persistent
  dark pine sidebar with level card and account block.
* Surfaces: warm off-white `#f4f5f1`, white cards, pine navy `#0b2a24` hero panels, emerald
  `#0f6b52` actions, gold `#b8902f` only for achievements and milestones.
* Typography: system UI stack, tight negative tracking on headings, tabular numerals for all money.
* Illustrations are hand-built SVG (fjord hero, empty states, leaf logo) — no external image
  requests, which keeps CSP strict and the bundle ~380 kB (114 kB gzipped).
* Accessibility: semantic landmarks, skip link, visible `:focus-visible` rings, labelled inputs with
  inline errors, `role="switch"`/`aria-checked` toggles, `aria-live` toasts, focus-trapped modals with
  Escape handling, `role="progressbar"` values, 44 px touch targets and AA contrast on text.
* Motion is limited to short fades/slides and progress transitions, all disabled under
  `prefers-reduced-motion: reduce`.

---

## 13. Known limitations

* **No real money movement** — Sparly tracks savings, it is not a bank or payment provider.
* **E-mail deliverability depends on Supabase** — with the default (auto-confirm) setting a new
  account is usable immediately; if you enable e-mail confirmation you must configure SMTP in the
  Supabase project, otherwise confirmation links never arrive.
* **This sandbox cannot reach `*.supabase.co`** — auth and database traffic are only verifiable in a
  browser with internet access or on the deployed Vercel app; see section 10 for what was and was not
  executed here.
* Competitions are created automatically for 7/30 days or by a group owner; there is no admin UI for
  editing competitions after they start (by design — results are immutable).
* No push notifications; all state is pull-based.
* Public competition discovery lists every public competition (no pagination beyond 40).
* Serverless cold starts add ~0.5–1.5 s to the first request of an instance (migration check included).
