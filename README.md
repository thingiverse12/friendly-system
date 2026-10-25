# Sparly — Små steg. Stora mål.

A complete, standalone, mobile-first savings app with gamified goals, achievements and optional
savings competitions. Swedish UI, Scandinavian visual language (deep pine navy, emerald accents,
restrained gold for achievements), server-rendered truth, no third‑party backend.

> **No Lovable. No Supabase.** React + TypeScript frontend, Node.js + TypeScript API, SQLite with
> parameterised SQL, Argon2id passwords and server-side sessions. Every account, transaction,
> competition result and permission lives in the server database — never in browser storage.

---

## 1. What is included

| Area | Implemented |
| --- | --- |
| Accounts | Registration, login, logout, password change, password reset, account deletion |
| Security | Argon2id, server-side sessions, HttpOnly cookies, CSRF double-submit, same-origin checks, rate limits, audit log |
| Savings goals | Create, edit, archive, delete, privacy flag, locked target during competitions |
| Transactions | Income/expenses with categories, optional private description, filters, search by period, edit/delete |
| Savings ledger | Append-only deposit/withdrawal ledger, exact integer öre, balances derived from movements |
| Progress | Saved / target / remaining / percentage, milestone timeline |
| Achievements | Five verified milestones, duplicate-proof awards, five levels, badge opt-in for leaderboards |
| Competitions | 7- and 30-day, public + private groups, automatic lifecycle, server-side scoring, frozen finals, sharing ranks |
| Groups | Create, invite by hashed one-time codes, revoke, leave, ownership transfer, group-only leaderboards |
| Privacy | Alias-only leaderboards, explicit public-competition consent (default **off**), badge sharing opt-in |
| UX | Mobile bottom navigation + desktop sidebar, loading/empty/error/success states, reduced-motion support, keyboard focus rings |
| Ops | Migrations, seed script, Docker image, health check, backups, test suite |

Screens: Dashboard, Savings goals, Goal detail, Transactions, Competitions, Competition leaderboard,
Private groups + group detail, Achievements, Profile & privacy, Login, Registration, Password reset,
404. Every button performs its action; every form validates server-side **and** client-side.

---

## 2. Architecture

```
┌──────────────────────────────┐        same origin, HttpOnly session cookie
│ React 19 + TypeScript (Vite) │  ───────────────────────────────────────────┐
│ web/src                      │                                             │
└──────────────────────────────┘                                             ▼
                                                   ┌─────────────────────────────────┐
                                                   │ Express 5 (TypeScript)          │
                                                   │ server/src                      │
                                                   │  routes/  → HTTP + validation   │
                                                   │  services/→ domain rules        │
                                                   │  lib/     → money, auth, limits │
                                                   └───────────────┬─────────────────┘
                                                                   │ parameterised SQL
                                                                   ▼
                                                   ┌─────────────────────────────────┐
                                                   │ SQLite (better-sqlite3, WAL)    │
                                                   │ data/sparly.db · integer öre    │
                                                   └─────────────────────────────────┘
```

**Why this stack**

* The environment has Node 22 and npm, but **no PostgreSQL server**. SQLite in WAL mode with
  `better-sqlite3` (synchronous, transactional, file-persistent) is the reliable choice for a
  single-server deployment, and the schema uses plain SQL with foreign keys, CHECK constraints,
  triggers and indexes so it ports to Postgres with minimal changes.
* `numeric`/decimal is emulated the safe way for SQLite: **all money is integer öre**
  (1 SEK = 100 öre). No `FLOAT`, no `Number` rounding in balances or scores.
* Sessions are server-managed rows, so revocation is immediate and nothing security-relevant is
  stored in the client.
* Vanilla React + a small `fetch` wrapper keeps the dependency surface (and the security surface)
  small. No state library, no CSS framework, no analytics.

### Project layout

```
server/src
  app.ts                 express app: security headers, sessions, CSRF, routes, SPA fallback
  index.ts               bootstrap: migrations, lifecycle sweep, graceful shutdown
  db.ts                  connection, migrations, audit helper, transactions
  migrations.ts          versioned SQL schema + achievement seed
  config.ts              environment configuration
  lib/                   money, password (Argon2id), cookies, http middleware, validation, time
  services/              accounts, goals, transactions, achievements, competitions, groups, dashboard, sessions, mailer
  routes/                auth+profile, goals, transactions, dashboard, achievements, competitions, groups
  tests/                 38 integration/unit tests (vitest + supertest)
web/src
  api.ts, types.ts, format.ts, auth.tsx, toast.tsx, hooks.ts
  components/            AppShell, UI primitives, Cards, Forms, Icon, illustrations
  pages/                 Auth, Dashboard, Goals, GoalDetail, Transactions, Competitions,
                         CompetitionDetail, GroupDetail, Achievements, Profile, NotFound
  styles.css, pages.css  design tokens, layout, components, responsive + reduced motion
scripts/seed-demo.ts     realistic demo data
```

---

## 3. Quick start

```bash
npm install                # Node 22+
npm run build              # builds web (Vite) + server (tsc → dist/)
npm run seed:demo          # optional: demo accounts and competitions
npm start                  # http://localhost:3000
```

Demo accounts (password `SparlyDemo123`): `alex@sparly.se`, `emma@sparly.se`, `oskar@sparly.se`,
`frida@sparly.se`, `lukas@sparly.se`, `elin@sparly.se`. The seed prints a valid group invitation
code.

The seed is **development-only** and safe to skip — a fresh database is created and migrated
automatically on first start.

Useful scripts:

| Script | Purpose |
| --- | --- |
| `npm run dev` | Build the SPA and start the production server |
| `npm run dev:server` | API with `tsx watch` (port 3000) |
| `npm run dev:web` | Vite dev server with `/api` proxy (port 5173) |
| `npm run build` / `npm start` | Production build / run |
| `npm test` | Vitest suite (38 tests) |
| `npm run typecheck` | Server + web type check |
| `npm run seed:demo -- --force` | Rebuild demo data |

### Configuration

See `.env.example`. The important ones:

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` / `HOST` | `3000` / `0.0.0.0` | Bind all interfaces so previews/proxies work |
| `DATABASE_FILE` | `./data/sparly.db` | Put on a durable volume |
| `COOKIE_SECURE` | auto (`1` in production) | Must be `1` behind HTTPS; `0` only for local HTTP |
| `SESSION_TTL_HOURS` | `336` | Server-side expiry, validated per request |
| `ALLOWED_ORIGINS` | – | Extra origins allowed to call the API |
| `SMTP_URL`, `MAIL_FROM`, `APP_URL` | – | Password-reset delivery; without SMTP the link is logged (never returned in production) |
| `TRUST_PROXY` | – | `1` behind nginx/ALB so rate limits see the client IP |

---

## 4. Data model

Tables (all with primary keys, foreign keys, CHECK constraints and indexes):

`users` · `profiles` · `sessions` · `password_reset_tokens` · `audit_events` · `rate_limits` ·
`savings_goals` · `transactions` · `savings_movements` · `achievements` · `user_achievements` ·
`competitions` · `competition_participants` · `private_groups` · `group_members` · `invitation_codes`

Highlights:

* `users.id` is a UUID; `profiles` holds alias, normalized alias (unique), timezone,
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
* `savings_goals.balance_ore` is only ever changed by the movement service inside an IMMEDIATE
  transaction, together with the matching ledger row.

Migrations are ordered SQL files executed once inside a transaction and recorded in
`schema_migrations`, so a fresh database is reproducible (`npm start` migrates automatically).

---

## 5. Security model

**Authentication**

* Argon2id via `@node-rs/argon2` (m = 19 MiB, t = 2, p = 1, 32-byte output — OWASP baseline).
  Wrong e-mail and wrong password return the same message, and unknown accounts still pay a dummy
  verification to equalise timing.
* Password policy: ≥ 10 characters, letters + digits, rejected when identical to the previous one.
* Server-managed sessions: 256-bit random token, only `sha256(token)` stored; expiry, revocation and
  "logged out everywhere after a password change" are enforced server-side on every request.
* Cookies: `HttpOnly`, `Secure` (production), `SameSite=Lax`, `Path=/`.
* Password reset tokens: 256-bit, hashed at rest, single use, expire after 1 hour; requesting a new
  one invalidates the previous one. The endpoint always answers identically (no account enumeration).
* Rate limits (fixed windows persisted in SQLite, so they survive restarts and multi-process setups):
  login 8/15 min per IP+e-mail, register 5/h, reset request 5/h, reset 10/h, invitation joins 15/15 min,
  competition joins 20/h, group creation 10/h.

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

**Transport & headers** — `Content-Security-Policy` (no inline scripts, `frame-ancestors *` so the
sandbox preview can embed the app), `X-Content-Type-Options: nosniff`, `Referrer-Policy`,
`Permissions-Policy`, HSTS in production. All SQL uses bound parameters; every request body is
validated with a strict Zod schema; React escapes all rendered strings by default and the API only
serves JSON with `nosniff`.

**Not in scope / explicitly absent** — no card, bank or payment integrations, no bank credentials,
no third-party analytics, no secrets in the frontend bundle.

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

`DELETE /api/profile/account` requires the current password **and** the literal confirmation
`RADERA`. On success, and inside one transaction:

1. Group ownership is transferred to the earliest remaining member (groups without other members are
   deleted together with their private competitions).
2. All sessions and reset tokens are revoked.
3. The user row is deleted; `ON DELETE CASCADE` removes profile, goals, ledger movements,
   transactions, achievements, group memberships, invitations they created and competition
   participations.
4. Competitions keep working: the user simply no longer appears in any leaderboard.
5. The audit log keeps one pseudonymous `account.deleted` row (random UUID + counts, no e-mail,
   alias or amounts) plus a `account.deletion_policy_applied` marker, which is what regulators need
   to prove the erasure happened.

---

## 9. API summary

All endpoints are under `/api`; every mutating call needs `X-CSRF-Token` (the value from
`/api/auth/me`, also set as a readable cookie). Errors are `{ error: { code, message, details? } }`.

| Method & path | Description |
| --- | --- |
| `GET /auth/csrf` · `GET /auth/me` | Anonymous token / current session + profile + stats |
| `POST /auth/register` · `/auth/login` · `/auth/logout` | Account lifecycle |
| `POST /auth/password/request` · `/auth/password/reset` · `/auth/password/change` | Recovery and rotation |
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

Environment: Node 22.22, vitest 5, supertest, in-memory or temp-file SQLite per suite. Arc: 8 files,
**38 tests, 38 passed, 0 failed, 0 skipped** (~4–5 s). Database, HTTP layer and authorisation are
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

Additional security tests included in the suite: CSRF missing/wrong/foreign-origin rejection, login
rate limiting, SQL-injection attempts leaving data intact, Argon2id hashing (no plaintext), duplicate
e-mail handling, password reset flow (single use, old password invalidated), group ownership
transfer, private competitions hidden from outsiders, and audit-log pseudonymisation.

**Not executed (reported honestly, not claimed as passed)**

* **Real browser E2E / visual regression / screenshots** — no browser binary (Chromium/Firefox) is
  available in this sandbox, so responsive rendering, keyboard navigation and the six-tab layout are
  verified by static assertions and manual CSS review, not by an automated viewport test. The suite
  does verify that the built SPA is served for deep links, which is the server-side part of mobile
  reload behaviour. Run Playwright/Cypress on a machine with a browser for pixel-level checks.
* **Mobile device farm testing** — unavailable here.
* **Email delivery** — no SMTP server in this environment; the reset flow is tested with the
  development token. Set `SMTP_URL` in production to deliver real e-mails.
* **PostgreSQL** — no server available; SQLite is used instead (see section 11 for the migration path).

---

## 11. Deployment

### Docker (recommended)

```bash
docker build -t sparly .
docker run -d --name sparly -p 3000:3000 \
  -e COOKIE_SECURE=1 -e TRUST_PROXY=1 \
  -e ALLOWED_ORIGINS=https://sparly.example.com \
  -v sparly-data:/data sparly
```

The image runs as an unprivileged user, stores the database in `/data`, exposes a health check and
serves both the API and the built SPA.

### Any Node host

1. `npm ci && npm run build`
2. Run `node dist/index.js` under a process manager (systemd, pm2, ECS, Fly, Render...).
3. Terminate TLS at the edge (nginx, Caddy, ALB) and keep `COOKIE_SECURE=1`, `TRUST_PROXY=1`.
4. Persist `DATABASE_FILE` (or `/data`) on a block volume; back up the SQLite file and its `-wal`
   with `sqlite3 sparly.db ".backup 'backup.db'"` on a schedule.
5. Optionally set `SMTP_URL`/`MAIL_FROM`/`APP_URL` so password resets are delivered.

**Scaling note:** SQLite is a single-writer database. This build is designed for one application
server (which is enough for a friends-and-family product). The whole data layer is isolated in
`server/src/services/*` with plain SQL, so moving to PostgreSQL means swapping the driver, replacing
`INTEGER` öre with `NUMERIC(14,2)` or keeping öre, and translating `INSERT OR IGNORE`/triggers — no
domain rules change.

### Verifying a deployment

```bash
curl -s https://sparly.example.com/api/health
curl -sI https://sparly.example.com/ | grep -i content-security-policy
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

* Single-server SQLite deployment (see scaling note).
* No real money movement — Sparly tracks savings, it is not a bank or payment provider.
* Competitions are created automatically for 7/30 days or by a group owner; there is no admin UI for
  editing competitions after they start (by design — results are immutable).
* No push notifications; all state is pull-based.
* Public competition discovery currently lists every public competition (no pagination beyond 40).
