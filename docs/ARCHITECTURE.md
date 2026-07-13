# PlayMatch — Architecture & Operations

The complete reference for how PlayMatch is built, runs, and operates. If you are an
agent (or human) picking this codebase up cold, read this end to end — it is written to
give you a full working model of the system.

Companion docs: [`OPERATIONS.md`](./OPERATIONS.md) (day-to-day runbook),
[`MATCHING_ENGINE.md`](./MATCHING_ENGINE.md) (scoring detail),
[`DEPLOYMENT_MIGRATION.md`](./DEPLOYMENT_MIGRATION.md) (the phased Firebase→self-hosted
history and rationale).

---

## 1. What it is

A tennis & pickleball partner-matching PWA for the Pleasanton community. Players onboard
with a profile (NTRP rating, sports, availability, partner preferences), get weighted
compatibility matches, send/accept match requests, chat in real time (with an AI coach
named **Rally**), and receive push notifications.

It is a **single self-hosted Next.js application** — one Node server that renders the UI,
serves the API, streams realtime events, and generates AI replies. No external SaaS
backend. **Two vendors total: OVH** (the VPS) and **Porkbun** (domain/DNS). Google is
used only as an OAuth identity provider (a free credential, not a running dependency).

> History: the app was originally built on Firebase (Auth, Firestore, Hosting, FCM, Cloud
> Functions, Gemini API). It was fully migrated off Firebase in July 2026. No Firebase code
> or dependency remains. See `DEPLOYMENT_MIGRATION.md`.

---

## 2. Tech stack

| Concern | Technology |
|---|---|
| Framework | **Next.js 15** (App Router, `output: 'standalone'`, Node runtime) |
| Language | TypeScript 5 (strict) |
| UI | React 18, **shadcn/ui** + Radix primitives, **Tailwind CSS**, `next-themes` (dark/light), Lucide icons |
| Auth | **Auth.js (NextAuth v5)** — Google provider only, database sessions |
| Database | **PostgreSQL 16** via **Drizzle ORM** (`postgres.js` driver) |
| Realtime | **Server-Sent Events** backed by **Postgres `LISTEN`/`NOTIFY`** |
| AI (Rally) | **Ollama** running **`gemma3:4b`** (local, CPU inference) |
| Push | **Web Push (VAPID)** via the `web-push` library + a service worker |
| Proxy / TLS | **Caddy** (automatic Let's Encrypt) |
| Packaging | **docker-compose** (Caddy · app · Postgres · Ollama) |
| Host | **OVH VPS** (Debian 13, 4 vCore, 8 GB) |
| Tests | **Vitest** + Testing Library + jsdom; **pglite** (in-memory Postgres) for the data layer |

Runs on **http://localhost:9002** in dev (`npm run dev`), **https://aiplaymatch.com** in prod.

---

## 3. High-level architecture

```
                          Porkbun DNS → OVH VPS public IP
                                       │
                          ┌────────────▼────────────┐  :443 (auto-TLS, HTTP/3)
                          │          Caddy          │  SSE paths: flush_interval -1
                          └────────────┬────────────┘
                                       │ reverse_proxy
                          ┌────────────▼────────────┐
                          │   Next.js app (Node)    │
                          │  • React UI (SSR/CSR)   │
                          │  • /api/* route handlers│
                          │  • Auth.js session      │
                          │  • SSE streams          │
                          │  • after(): Rally + push│
                          └───┬─────────────────┬───┘
             internal network │                 │ internal network
                    ┌─────────▼──────┐   ┌──────▼─────────┐
                    │  Postgres 16   │   │    Ollama      │
                    │  (Drizzle)     │   │  gemma3:4b     │
                    │  LISTEN/NOTIFY │   │  /api/chat     │
                    └────────────────┘   └────────────────┘
```

Only Caddy is exposed to the internet (ports 80/443). Postgres and Ollama are reachable
only on the internal Docker network.

**The core request pattern:** the browser never talks to the database directly. It calls
JSON API routes under `/api/*`; each route resolves the Auth.js session, enforces
authorization, and uses the Drizzle data layer. Realtime is layered on top via SSE.

---

## 4. Directory map

```
src/
├── app/
│   ├── layout.tsx                 # Root layout: fonts (Geist), ThemeProvider, AuthProvider, Toaster, SW registration
│   ├── page.tsx                   # Landing page (/)
│   ├── login/page.tsx             # "Continue with Google" (/login)
│   ├── register/page.tsx          # Re-exports login — registration IS the Google flow
│   ├── onboarding/                # 4-step profile setup; gates the dashboard until complete
│   ├── dashboard/
│   │   ├── layout.tsx             # → dashboard-shell.tsx
│   │   ├── dashboard-shell.tsx    # ProtectedRoute + DesktopSidebar + BottomNav
│   │   ├── page.tsx               # Dashboard home: stats, requests, top matches
│   │   ├── open-matches/page.tsx  # Browse/create/join/manage matches
│   │   ├── messages/
│   │   │   ├── page.tsx           # Conversation list + contacts
│   │   │   └── [conversationId]/  # page.tsx (wrapper) + chat-client.tsx (live chat)
│   │   ├── notifications/page.tsx
│   │   ├── profile/page.tsx
│   │   └── settings/page.tsx      # Theme, notification prefs, enable push, delete account
│   └── api/                       # ALL server endpoints (see §7)
│
├── auth.ts                        # Auth.js config: Google provider + Drizzle adapter + session callback
├── instrumentation.ts            # Runs once at server boot: apply DB migrations + seed the Rally user
│
├── db/
│   ├── schema.ts                  # Drizzle table definitions (§5)
│   └── index.ts                   # getDb() — lazy postgres.js + Drizzle client
│
├── server/                        # SERVER-ONLY modules (never imported by client components)
│   ├── data.ts                    # The data layer: all domain ops + authorization (§6)
│   ├── route-helpers.ts           # withUser() wrapper: session gate + error→HTTP mapping
│   ├── realtime.ts                # LISTEN/NOTIFY fan-out (§8)
│   ├── sse.ts                     # sseResponse(): session-gated event stream
│   ├── rally.ts                   # maybeReplyAsRally(): Ollama call + fallback (§9)
│   └── push.ts                    # web-push send + higher-level triggers (§10)
│
├── lib/
│   ├── data.ts                    # CLIENT data layer: fetch() wrappers over /api + subscribe* (SSE)
│   ├── auth-context.tsx           # useAuth() — thin client shim over /api/me + next-auth/react
│   ├── ai-assistant.ts            # Pure Rally helpers: prompt, history, clamp, static fallback, shouldRallyRespond
│   ├── matching-engine.ts         # Pure weighted scoring (§11)
│   ├── mock-data.ts               # Domain TYPES (Player, Match, …) + RALLY_USER + a few pure helpers
│   ├── notifications.ts           # Client Web Push enable/disable + notification preferences (localStorage)
│   └── utils.ts                   # cn() classname helper
│
├── components/                    # App components (bottom-nav, chat-input, message-bubble, …) + ui/ (shadcn)
├── hooks/                         # use-nav-badges (live unread), use-mobile, use-toast
└── types/next-auth.d.ts           # Session type augmentation (user.id, profileComplete)

drizzle/                           # Generated SQL migrations (applied at boot)
deploy/                            # docker-compose.yml, Caddyfile, .env (secrets, on the box only)
Dockerfile                         # Multi-stage standalone build (node:24-alpine)
public/sw.js                       # Service worker: offline shell + push + notificationclick
```

**Key naming note:** `src/lib/mock-data.ts` is misleadingly named — its live `players`/
`matches`/etc. arrays are **empty in production**; it exists for the shared domain **types**
(`Player`, `Match`, `Conversation`, `Message`, `Notification`, `Contact`) and the `RALLY_USER`
constant. The real data lives in Postgres.

---

## 5. Data model (Postgres)

Defined in `src/db/schema.ts`; migrations in `drizzle/*.sql` are applied automatically at
boot by `src/instrumentation.ts`. Tables:

**Auth.js core**
- `users` — the Auth.js user row **plus** the PlayMatch profile columns (firstName,
  lastName, age, gender, avatar, photoUrl, ntrpRating, sport, sports (jsonb), matchFormats
  (jsonb), gameType, weeklyAvailability (jsonb), partnerPreferences (jsonb), profileComplete,
  matchesPlayed, wins, losses, bio, aboutMe, location). `email` is present but treated as
  private (never returned in the public player shape).
- `accounts`, `sessions`, `verification_tokens` — Auth.js adapter tables.

**Domain**
- `matches` — player1Id (creator), player2Id, status (`open|pending|confirmed|scheduled|
  in_progress|completed|cancelled`), date/time/location/sport/matchType, score,
  compatibilityScore, participants (jsonb), createdBy/acceptedBy/conversationId, timestamps.
- `match_requests` — fromUserId, toUserId, status (`pending|accepted|declined|expired`),
  score, conversationId.
- `conversations` — type (`direct|group`), name, matchId, createdBy, lastMessage,
  lastMessageAt.
- `conversation_participants` — (conversationId, userId) PK, **unreadCount per user**,
  lastReadAt. This join table replaces Firestore's per-doc unread map.
- `messages` — conversationId, senderId, senderName, text, isAi, createdAt.
- `contacts` — (userId, contactId) PK, denormalized name/email/avatar.
- `notifications` — userId, type, title, body, read, link.
- `push_subscriptions` — userId, endpoint (unique), p256dh, auth (Web Push keys).

`rally` is a reserved system user id (seeded at boot) that owns all AI messages.

To change the schema: edit `schema.ts`, run `npx drizzle-kit generate --name <desc>`,
commit the new `drizzle/*.sql`. It applies on the next deploy's boot.

---

## 6. Auth & sessions

- **Provider:** Google only (`src/auth.ts`). No passwords, no email infrastructure.
  "Register" and "Login" are the same `signIn("google")` flow; new users get a `users` row
  automatically via the Drizzle adapter.
- **Sessions** are database-backed (rows in `sessions`), delivered as an httpOnly cookie.
  The session callback exposes `user.id` and `user.profileComplete` (see
  `src/types/next-auth.d.ts`).
- **Client side:** `src/lib/auth-context.tsx` provides `useAuth()`. It is a thin shim: on
  mount it GETs `/api/me` for the full profile; `updateUserProfile()` optimistically updates
  local state and PATCHes `/api/me` (re-syncing on failure). The exported interface
  (`user`, `login`, `logout`, `updateUserProfile`, `deleteAccount`, …) is intentionally
  stable so pages don't know or care about the backend.
- **Onboarding gate:** `profileComplete` is false until the 4-step onboarding finishes.
  `ProtectedRoute` / dashboard routes redirect incomplete profiles to `/onboarding`.
- **Dev mock:** set `NEXT_PUBLIC_MOCK_AUTH=true` for a localStorage fake user (no server).

---

## 7. Data layer & API

There are **two** data layers with matching function names:

**Server** — `src/server/data.ts`. Every function takes `(db, me, …)` where `me` is the
**session user id**, and enforces authorization inline (this is where the old Firestore
security-rule logic now lives). Examples of the rules it enforces:
- Senders/creators are always stamped from the session — a client can't forge `fromUserId`,
  `player1Id`, or a message `senderId`.
- Conversations and messages are **participant-gated** (read and write).
- Match requests: only the recipient may accept/decline; only the sender may cancel.
- Matches: only the creator may delete; roster fields can only be *cleared* via PATCH
  (joining goes through a transactional `joinOpenMatch`); a completing match's `winnerId`
  must be one of the two players.
- Public player shape omits `email` and other private fields.

It throws `AuthzError` (→ 403) and `NotFoundError` (→ 404).

**Route handlers** — `src/app/api/**/route.ts`. Thin. Almost all wrap the shared
`withUser()` helper (`src/server/route-helpers.ts`), which resolves the session (401 if
none), runs the handler with `(db, me, req, params)`, JSON-serializes the result, and maps
`AuthzError/NotFoundError/*` to 403/404/500.

**Client** — `src/lib/data.ts`. `fetch()` wrappers over the API with the same function
names the pages already used (`getMatches`, `sendMessage`, `subscribeMessages`, …), so page
code is backend-agnostic. `subscribe*` use SSE (§8) with a polling fallback.

### Endpoint reference

| Method(s) | Path | Purpose |
|---|---|---|
| GET/POST | `/api/auth/[...nextauth]` | Auth.js (Google sign-in, callback, session, signout) |
| GET/PATCH/DELETE | `/api/me` | Signed-in user's profile: read / update / delete account |
| POST | `/api/me/photo` | Upload profile photo (multipart) → VPS volume |
| GET | `/api/photos/[file]` | Serve a profile photo (session-gated, filename allow-list) |
| GET | `/api/players` | Public player list (no emails) |
| GET | `/api/players/[id]` | One public player |
| GET | `/api/players/lookup?email=` | Exact-email lookup (for adding a contact) |
| GET/POST | `/api/matches` | List (`?mine=1`) / create a match |
| PATCH/DELETE | `/api/matches/[id]` | Update / delete a match |
| POST | `/api/matches/[id]/join` | Transactional join of an open match |
| GET/POST | `/api/match-requests` | List / create; POST also pushes the recipient |
| PATCH | `/api/match-requests/[id]` | Accept/decline/cancel; accept pushes the sender |
| GET/POST | `/api/conversations` | List / create (direct or group) |
| GET/DELETE | `/api/conversations/[id]` | Get / delete a conversation |
| POST | `/api/conversations/[id]/read` | Zero the caller's unread count |
| GET/POST | `/api/conversations/[id]/messages` | List / send; POST also fires push + Rally |
| GET (SSE) | `/api/conversations/stream` | Live conversation-list/unread changes |
| GET (SSE) | `/api/conversations/[id]/messages/stream` | Live messages for one conversation |
| GET/PATCH | `/api/notifications` · `/api/notifications/[id]` | List / mark read |
| GET/POST | `/api/contacts` · DELETE `/api/contacts/[id]` | List / add / remove |
| POST | `/api/push/subscribe` · `/api/push/unsubscribe` | Register / drop a Web Push subscription |
| GET | `/api/push/vapid` | Public VAPID key (for PushManager.subscribe) |

---

## 8. Realtime (SSE + Postgres LISTEN/NOTIFY)

Replaces polling. Files: `src/server/realtime.ts`, `src/server/sse.ts`, client `subscribe*`
in `src/lib/data.ts`.

1. **Write** → a data mutation (`sendMessage`, `createGroupConversation`,
   `deleteConversation`, `markConversationRead`) calls `notifyChange(db, payload)`, which
   issues `SELECT pg_notify('playmatch', <json>)`. The payload is tiny — `{ conversationId,
   participants }` (ids only; **no message content travels over NOTIFY**).
2. **Fan-out** → `realtime.ts` holds **one** dedicated `LISTEN` connection (a singleton on
   `globalThis`) that re-emits every notification through a process-local `EventEmitter`. So
   N concurrent SSE clients share a single DB connection.
3. **Stream** → the two SSE routes call `sseResponse(req, shouldWake, { onOpen })`. It gates
   on the session, runs an authz check in `onOpen` (e.g. "am I a participant of this
   conversation?"), then streams: an initial `ping`, a `change` event whenever `shouldWake`
   matches a payload, and a heartbeat comment every 25s. It tears everything down on client
   disconnect (`req.signal` abort + stream cancel).
4. **Client** → `subscribeSSE()` opens an `EventSource`; on `ping`/`change` it **re-fetches**
   through the normal authorized API (so the SSE never carries data, only a "something
   changed" nudge). If `EventSource` is unavailable or the stream closes, it falls back to a
   5s poll.

Caddy is configured (`deploy/Caddyfile`) to proxy the two `*/stream` paths with
`flush_interval -1` and no gzip so events are delivered unbuffered.

---

## 9. Rally AI (local Gemma via Ollama)

Files: `src/server/rally.ts`, pure helpers in `src/lib/ai-assistant.ts`, model in the
`ollama` container.

- **Trigger:** a human message containing an `@rally` mention (`shouldRallyRespond`). The
  message `POST` route calls `after(() => maybeReplyAsRally(...))` — **`after()` from
  `next/server`** runs the work *after* the HTTP response is sent, so the sender isn't
  blocked and the reply lands asynchronously. (A plain un-awaited promise is **not** safe —
  Next garbage-collects it once the response returns; this was a real bug we hit.)
- **Generation:** `maybeReplyAsRally` builds the prompt from the conversation history +
  the shared system prompt (`RALLY_SYSTEM_PROMPT`), POSTs to Ollama `/api/chat`
  (`model = OLLAMA_MODEL`, default `gemma3:4b`), clamps the reply to ~80 words, and inserts
  it as the `rally` user via `insertRallyMessage`. That insert NOTIFYs, so the reply streams
  to the browser over SSE (§8). Warm-model latency is ~3–12s on CPU.
- **Fallback:** if Ollama is unreachable or errors, it uses `getStaticResponse` (a small
  deterministic keyword responder) so Rally still replies.
- **Model choice:** `gemma3:4b` (3.3 GB Q4). Gemma 4's E-variants (7–10 GB) don't fit the
  8 GB box alongside Postgres. Swap models by editing `OLLAMA_MODEL` in `deploy/.env` and
  `ollama pull`ing the new tag.

---

## 10. Web Push (VAPID)

Files: `src/server/push.ts`, client `src/lib/notifications.ts`, `public/sw.js`.

- **Keys:** a VAPID keypair lives in `deploy/.env` (`VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`). The public key is served at runtime via
  `/api/push/vapid` (no build-time inlining; rotating keys needs no rebuild).
- **Subscribe:** Settings → "Enable Push Notifications" calls
  `enablePushNotifications()`, which requests permission, registers the SW, subscribes via
  `PushManager` with the fetched key, and POSTs the subscription to `/api/push/subscribe`
  (stored in `push_subscriptions`).
- **Send:** `sendPushToUser(db, userId, payload)` sends to all of a user's subscriptions and
  prunes ones the browser dropped (404/410). Higher-level triggers — `pushNewMessage`,
  `pushMatchRequest`, `pushMatchAccepted` — mirror the old FCM functions and fire via
  `after()` from the message and match-request routes.
- **Receive:** `public/sw.js` has `push` (show notification) and `notificationclick` (focus
  an open tab or open the linked page) handlers. Granting OS permission is inherently a user
  action; browsers forbid programmatic grants.

---

## 11. Matching engine

`src/lib/matching-engine.ts` — pure functions, fully unit-tested, no I/O. Weighted score
(0–100) across availability (0.25, symmetric with slot-merge), sport (0.20), NTRP (0.20),
game type (0.10), match format (0.10), gender (0.10), age (0.05) — weights sum to 1.0. A
**hard exclusion** drops pairs where neither player accepts the other's NTRP band. Partner
sport/format preferences refine those sub-scores. The dashboard runs it client-side over the
public player list. Full detail: [`MATCHING_ENGINE.md`](./MATCHING_ENGINE.md).

---

## 12. Environment variables

**On the box** in `deploy/.env` (never committed). `docker-compose` reads it for both
container runtime (`env_file`) and `${VAR}` interpolation.

| Var | Purpose |
|---|---|
| `DATABASE_URL` | `postgres://playmatch:<pw>@postgres:5432/playmatch` |
| `POSTGRES_PASSWORD` | Postgres superuser password (must match DATABASE_URL) |
| `AUTH_SECRET` | Auth.js session/JWT signing (`openssl rand -base64 32`) |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth client credentials |
| `AUTH_URL` / `AUTH_TRUST_HOST` | `https://aiplaymatch.com` / `true` (behind Caddy) |
| `OLLAMA_URL` / `OLLAMA_MODEL` | `http://ollama:11434` / `gemma3:4b` |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web Push keys + `mailto:` contact |
| `UPLOAD_DIR` | Profile-photo dir (`/app/uploads`, a mounted volume) |
| `NEXT_PUBLIC_MOCK_AUTH` | Dev only: `true` for the localStorage fake user |

The **Google OAuth redirect URI** must be
`https://aiplaymatch.com/api/auth/callback/google`.

---

## 13. Deployment

**Compose stack** (`deploy/docker-compose.yml`): `caddy` (80/443, auto-TLS, SSE-aware) →
`app` (Next standalone) → depends on `postgres` (healthchecked, `pg_data` volume) and
`ollama` (`ollama_models` volume, 6 GB memory cap). Volumes: `pg_data`, `ollama_models`,
`uploads`, `caddy_data`, `caddy_config`. A 4 GB swapfile on the host is an inference safety
net.

**Build:** `Dockerfile` is a multi-stage `node:24-alpine` build producing Next's
`standalone` output; it also copies `drizzle/` (migrations) and creates `/app/uploads`.

**Migrations & seed** run automatically at server boot via `src/instrumentation.ts` (Drizzle
migrator + idempotent `INSERT` of the `rally` user). No manual migration step.

**Deploy flow** (from `docs/OPERATIONS.md`):
```bash
ssh playmatch
cd ~/app && git pull
cd deploy && sudo docker compose build app && sudo docker compose up -d app
```
Prefer running long builds detached (`nohup … &`) so an SSH blip can't interrupt them. The
box tracks the `master` branch.

**CI:** `.github/workflows/ci.yml` runs typecheck + lint + `test:ci` (with coverage gate) +
build on every push to `master` and on PRs.

---

## 14. Testing

- **Runner:** Vitest (`npm test` / `test:watch` / `test:ci`). jsdom environment; the
  worker pool is capped to 2 forks in `vitest.config.ts` (the pglite WASM Postgres + many
  jsdom workers otherwise deadlock on constrained machines).
- **Server data layer** (`src/server/data.test.ts`) runs against **pglite** — a real
  in-memory Postgres — applying the same `drizzle/*.sql` migrations. This exercises the
  actual SQL and authorization logic (100% of `data.ts`).
- **Client, components, pages** use Testing Library with mocked `@/lib/data`, `useAuth`, and
  `next/navigation`. Realtime/push/rally have dedicated suites.
- **Coverage gate** (`vitest.config.ts`): ≥90% statements/functions, ≥80% branches. Thin
  API-route glue and the boot instrumentation are excluded (integration-tested live). ~363
  tests currently pass.
- `typecheck` runs the app tsconfig **and** `tsconfig.test.json` so test files are type-safe.

---

## 15. Conventions, gotchas & non-obvious decisions

- **`after()` for post-response work.** Any work that should happen after a mutation but not
  block the response (Rally replies, push sends) MUST use `after()` from `next/server`. A
  bare `void promise()` is dropped by Next once the response returns.
- **SSE carries no data.** `NOTIFY` payloads and SSE events are "something changed" nudges;
  the client re-fetches via the authorized API. This keeps payloads tiny and reuses the
  tested read path.
- **Lockfile drift.** macOS npm and the `node:24-alpine` build npm disagree on optional
  platform deps, which breaks `npm ci` in Docker. If a build fails on `npm ci`, regenerate
  `package-lock.json` **inside** the build image and commit it (command in `OPERATIONS.md`).
- **No trailing slash.** `next.config.ts` uses `output: 'standalone'` and does NOT set
  `trailingSlash` — it 308-redirects API routes and would corrupt the OAuth callback.
- **Server vs client boundary.** `src/server/*` and `src/db/*` are server-only (they import
  `postgres`, `web-push`, secrets). Never import them from a `"use client"` component — go
  through `src/lib/data.ts` (fetch) instead.
- **`mock-data.ts` is types, not data** (see §4). Its arrays are empty in prod.
- **Authorization is centralized** in `src/server/data.ts`, not scattered in routes. Add new
  rules there.

### Adding a new API endpoint (the pattern)

1. Add the operation + its authorization to `src/server/data.ts` (takes `(db, me, …)`,
   throws `AuthzError`/`NotFoundError`).
2. Create `src/app/api/<path>/route.ts` wrapping `withUser(async (db, me, req, params) =>
   …)`.
3. Add a matching client function to `src/lib/data.ts` (fetch wrapper).
4. If a write should notify other users, call `notifyChange(db, { conversationId,
   participants })` and/or a `push*` trigger (via `after()` in the route).
5. Add tests: a pglite case in `data.test.ts` and/or a client/page test.

---

## 16. The three manual close-out items (post-migration)

Not code — they need account access (documented in `OPERATIONS.md`):
1. Rotate the old Gemini API key in Google AI Studio (still live in git history; unused now).
2. Delete the Firebase project `pl-play-match` in the Firebase console.
3. Delete the local `pl-play-match-firebase-adminsdk-*.json` from the repo root (gitignored).
