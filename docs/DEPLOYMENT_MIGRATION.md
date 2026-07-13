# PlayMatch — Migration Plan: Firebase → Self-Hosted (OVH + Porkbun)

Moving PlayMatch off Firebase to a single VPS you own. The driver is **management
simplicity** — collapse ~5 vendor relationships down to two, with no per-call AI
billing.

**End state — two throats to choke:**
- **OVH** — one VPS running everything (app, Postgres, Ollama, Caddy), plus
  OVH's snapshot/automated-backup add-on (same account/bill).
- **Porkbun** — domain + DNS.

Google is used only as an OAuth identity provider (a free credential in the env,
not a bill or a service we run).

---

## Decisions made for you (veto any of these)

| Area | Pick | Why |
|---|---|---|
| Frontend | Keep **Next.js**, drop `output: 'export'`, run as a **Node server** | Auth, realtime, and server-side authz all need a running server; static export can't do them. |
| ORM | **Drizzle** | Typescript-native, thin, first-class Auth.js adapter, easy raw SQL when needed. |
| Auth | **Auth.js (NextAuth) v5**, Google provider only | Google login with no passwords, no email infra. |
| Realtime | **SSE + Postgres `LISTEN/NOTIFY`** | One-directional server→client push (new messages, unread) is all we need; SSE runs through Caddy, auto-reconnects, no separate WS server. |
| AI | **Ollama + gemma3:4b (Q4, 3.3 GB)** | Zero API cost, no key to leak. Chosen in Phase 5 after Gemma 4 E-variants proved too large for the 8 GB box (e4b 9.6 GB, e2b 7.2 GB). ~3s warm CPU replies. |
| Rally job | **`after()` from next/server** (in-process, post-response) | Simpler than a job queue; no extra dep. A reply lost on a mid-generation restart is acceptable (the user can just @rally again). |
| Push | **Web Push (VAPID)** via the `web-push` library | Drops FCM/Firebase entirely; standard, self-hosted. |
| Proxy/TLS | **Caddy** | Automatic Let's Encrypt certs, trivial config. |
| Packaging | **docker-compose** | Whole stack reproducible from one file. |
| OS / VPS | **Debian 13** on **OVH vps2-2027** (4 vCore x86, 8 GB, US) $10/mo | 8 GB fits a ~4B-class Q4 model + Postgres + app; 4 cores for CPU inference; US location matches the Pleasanton user base. |

## Open questions — RESOLVED (2026-07-10)

1. **Production data:** none to preserve — clean start. No Firestore export/import
   step; Phase 8 is just DNS + decommission.
2. **Domain:** **aiplaymatch.com** (registered at Porkbun). Caddyfile site block and
   Google OAuth redirect URI use it:
   `https://aiplaymatch.com/api/auth/callback/google`
3. **VPS / provider:** **OVH vps2-2027** — 4 vCore x86, 8 GB RAM, 75 GB NVMe, US,
   $10/mo. (Hetzner ARM had no availability; Hetzner's 4 GB CX23 fails the ~8 GB
   floor that a ~4B-class Q4 model + Postgres + app require; Hostinger was pricier with half
   the cores.) The two management planes become **OVH + Porkbun**. x86 is fine —
   every image in the stack is multi-arch. Use OVH's snapshot/backup add-on (same
   account) for the durability layer instead of Hetzner's.
   - **Storage check:** 75 GB is ample — steady state is ~15–20 GB (gemma3:4b Q4
     ~3.3 GB, Ollama image ~2–3 GB, OS + Docker ~5–8 GB, app image ~2–4 GB, DB and
     dumps trivial). Phase 1 hardening includes log rotation + periodic
     `docker system prune` so disk never creeps.

## Status

- **2026-07-13 — Phase 7/8 complete: Firebase decommissioned. Migration DONE. 🎉**
  - Removed all Firebase deps (firebase, @tanstack-query-firebase, @tanstack/
    react-query — 76 packages), config (functions/, firebase.json,
    firestore.rules/indexes, storage.rules, .firebaserc, .firebase/), and the
    firestore.ts shim (imports repointed to @/lib/data). Stale comments refreshed.
  - CI: `firebase-deploy.yml` → `ci.yml` (typecheck + lint + test + build).
  - Verified: 363 tests green; site fully functional with **two real Google
    users** (matching, requests, accepts, chat all working); **no Firebase
    strings in the served bundle**; all API endpoints auth-gated. Vendor surface
    is now exactly **OVH + Porkbun**.
  - See `docs/OPERATIONS.md` for the runbook and the 3 manual close-out steps
    (rotate the old Gemini key, delete the Firebase project, delete the local
    admin-SDK json).
- **2026-07-13 — Phase 6 complete: Web Push (VAPID) live; FCM removed entirely.**
  - `src/server/push.ts` sends via the `web-push` library to a user's
    `push_subscriptions`, pruning dead ones (404/410). Configured from VAPID_*
    env. Higher-level triggers (new message, match request, match accepted)
    mirror the old FCM Cloud Functions and fire via `after()` post-response.
  - Routes: `/api/push/{subscribe,unsubscribe,vapid}`. The public key is served
    at runtime (`/api/push/vapid`) — no build-time injection, survives rotation.
  - Client `enablePushNotifications` registers the SW, subscribes via
    PushManager with the fetched key, and persists the subscription; `sw.js`
    handles `push` (show notification) + `notificationclick` (focus/open the
    linked page). `firebase-messaging-sw.js` deleted.
  - Verified in the live browser: SW registered + active (site-wide scope),
    `/api/push/vapid` returns the key, subscribe endpoint runs and validates
    (403 on a malformed body). Server send/prune/truncate logic is unit-tested.
    Final step — granting the OS notification permission — is a user action
    (via Settings → Enable Push Notifications); browsers forbid programmatic
    permission grants.
  - Tests: push + Web-Push client suites; 363 green; coverage gate passing.
- **2026-07-13 — Phase 5 complete and verified in production. Rally is live on
  local Gemma — zero AI API cost, no key anywhere.**
  - Model: **gemma3:4b** (3.3 GB Q4) via Ollama on the VPS. Gemma 4 didn't fit:
    e4b is 9.6 GB and e2b 7.2 GB (the "effective" models are memory-heavy),
    both too large for the 8 GB box alongside Postgres. gemma3:4b is the current
    small Gemma, comfortable fit, coherent. Added 4 GB swap + capped Ollama at
    6 GB as inference safety nets.
  - `src/server/rally.ts`: on an `@rally` mention, builds the prompt from the
    conversation (shared ai-assistant helpers), calls Ollama `/api/chat`, clamps
    to 80 words, and posts back as the Rally system user — which NOTIFYs, so the
    reply streams in over SSE. Static fallback if Ollama is down.
  - Triggered via `after()` from next/server in the message route (a plain
    fire-and-forget was garbage-collected once the response returned).
  - Verified end-to-end in the browser: `@rally what number do I call to reserve
    a court?` → a warm-model reply in ~3s: *"Hi Matt! Lifetime Activities
    Pleasanton is your best bet… (925) 460-8600…"* — correct voice, used the
    name, streamed live. Test data cleaned up (DB 0/0). Memory healthy: ~5.1 GB
    used with the model warm, 2.5 GB free + 4 GB swap.
  - Tests: rally + pglite data-fn suites; 357 green.
- **2026-07-12 — Phase 4 complete and verified in production.**
  - Realtime is now SSE over Postgres LISTEN/NOTIFY, replacing the 5s polling.
    One shared LISTEN connection fans NOTIFY payloads out via a process-local
    EventEmitter, so many SSE clients share a single DB connection. Mutations
    emit a tiny `{conversationId, participants}` signal (ids only — no content
    over NOTIFY); the client re-fetches through the normal authorized API.
  - Routes: `/api/conversations/stream` (wakes on the user's conversations) and
    `/api/conversations/[id]/messages/stream` (participant-gated). Session-gated,
    heartbeat, full teardown on disconnect. Caddy streams them unbuffered
    (`flush_interval -1`, no gzip).
  - Client `subscribe*` use EventSource with an automatic polling fallback
    (SSR / no EventSource / stream closed).
  - Verified end-to-end in the browser against the live stack: opening a stream
    yielded `ping`, a DB write (create conversation / send message) fired
    pg_notify → LISTEN → SSE `change` in the browser through Caddy. Both the
    conversation-list and per-conversation message streams confirmed; test data
    cleaned up (DB back to 0 conversations / 0 messages).
  - Tests: realtime/sse/EventSource-client suites added; 348 green; coverage gate passing.
- **2026-07-12 — Phase 3 complete and verified in production.**
  - Entire data layer runs on Postgres behind 20 session-authorized API routes
    (matches, requests, conversations + per-user unread, messages, contacts,
    notifications). Authorization (the old firestore.rules) enforced server-side:
    senders/creators stamped from the session, participant-gated chat,
    recipient-only accept/decline, creator-only delete, transactional open-match
    join, server-computed stats on completion (winner validated as a match player).
  - Client `src/lib/data.ts` keeps the old firestore.ts signatures (re-exported)
    so pages were untouched; subscribe* poll every 5s until Phase 4 SSE.
  - Profile photos: upload to a VPS volume (/api/me/photo) served by
    /api/photos/[file] — replaces Firebase Storage. Firebase fully removed.
  - Verified in-browser with the real session: created an open match through the
    UI → row persisted in Postgres with correct creator → deleted via UI. All
    endpoints 401 without a session.
  - Tests: 337 green; server data layer covered by an in-memory pglite suite
    (100% stmts). Coverage gate passes (97% stmts / 93% funcs / 89% branch).
    Two authz bugs the tests caught (forged winner stats, roster rewrite) were
    fixed before deploy. Fixed a suite-wide hang (a login test's mocked async
    rejection through onClick tripped vitest's unhandled-rejection tracker) and
    capped the vitest worker pool (pglite WASM + many jsdom workers deadlock).
- **2026-07-12 — Phase 2 complete and verified in production.**
  - Postgres 16 running in compose (healthcheck, volume); Drizzle migrations
    apply automatically at app boot (`src/instrumentation.ts`).
  - Auth.js v5 Google-only sign-in live at aiplaymatch.com — verified end to
    end: real Google OAuth created a user + oidc account + session in Postgres,
    and the incomplete profile correctly gated to /onboarding.
  - /api/me GET/PATCH/DELETE serves the profile (session-guarded, allow-listed
    fields); auth-context is now a thin shim keeping the old useAuth interface.
  - login/register collapsed to one Google flow; Change Password replaced with
    a Google Account link; firebase auth lib deleted.
  - Fixes along the way: trailingSlash removed (its 308s would corrupt the
    OAuth callback), ufw now allows 443/udp (Caddy advertises HTTP/3 — QUIC was
    firewalled, black-holing Chrome), lockfile now generated inside the
    node:24-alpine build image so macOS/container npm can't drift.
  - Note: browsers that visited during the trailing-slash era may hold a cached
    308 on /login, /dashboard etc. — a hard refresh (Cmd+Shift+R) clears it.
  - Remaining: user completes onboarding once to confirm the profile
    persistence round-trip in prod (code path already unit-tested).
- **2026-07-11 — SITE LIVE: https://aiplaymatch.com** (valid Let's Encrypt cert;
  www 301s to apex; A + AAAA records for apex and www set via the Porkbun API —
  parking ALIAS/wildcard-CNAME removed, MX/NS left untouched). App is in mock
  mode until Phases 2–3. Still pending (user): Google OAuth client (Phase 2
  blocker), OVH backup add-on.
- **2026-07-11 — Phase 1 complete on the box.**
  - VPS live: `vps-17f0b082.vps.ovh.us` / 15.204.114.63 (Debian 13.4, x86_64).
  - Hardened: SSH key-only (password auth + root login disabled), ufw deny-all
    except 22/80/443, fail2ban (systemd backend, sshd jail — already banning
    brute-forcers), unattended security upgrades, Docker Engine + compose with
    log rotation (20 MB × 3).
  - Deployed: repo cloned at `~/app` (branch `self-host-migration`); `deploy/`
    stack (Caddy + app) built and running; app serves the UI internally; port 80
    reachable from the internet (308 → HTTPS).
  - Caddy is auto-retrying Let's Encrypt issuance; it will succeed as soon as
    DNS points here — no action needed on the box.
  - **Blocked on (user):**
    1. Porkbun DNS: delete the parking A records; add `A @ → 15.204.114.63`,
       `A www → 15.204.114.63` (optionally `AAAA @ → 2604:2dc0:222::143`).
    2. Google OAuth client (redirect `https://aiplaymatch.com/api/auth/callback/google`) — needed for Phase 2.
    3. OVH backup add-on — enable in the OVH panel.
- **2026-07-11 — Phase 0 done.** OVH vps2-2027 purchased (Debian 13); SSH key
  access established.

---

## Vendor surface: before → after

| Concern | Today | After |
|---|---|---|
| Hosting | Firebase Hosting | OVH VPS (Caddy) |
| Auth | Firebase Auth | Auth.js + Google OAuth (Google = free credential) |
| Database | Firestore | Postgres on the VPS |
| Realtime | Firestore `onSnapshot` | SSE + Postgres `LISTEN/NOTIFY` |
| AI | Gemini API (metered) | Ollama + gemma3:4b on the VPS |
| Push | FCM | Web Push (VAPID) |
| DNS / domain | (various) | Porkbun |
| **Bills to manage** | **~5** | **2 (OVH, Porkbun)** |

---

## What survives vs. what gets replaced

The recent `improvement-plan` work is **not** thrown away — most of it is
framework-agnostic and carries straight over. Only the Firebase-coupled backend
is replaced.

**Survives (keep as-is or with light edits):**
- `src/lib/matching-engine.ts` and its tests — pure functions, no Firebase.
- `src/lib/mock-data.ts` **types** (Player, Match, Conversation, Message, …) — reused as the app's domain types.
- `src/lib/ai-assistant.ts` — the pure helpers (`shouldRallyRespond`, `buildHistory`, `buildRallyPrompt`, `clampWords`, `buildMatchIntro`, static fallback). Only the *provider* changes (Ollama instead of Gemini).
- All React UI: pages and components, the token/font pass, the landing redesign, accessibility fixes.
- The bug fixes that were logic, not transport (unread model, declined-request rule, double-submit guards, stats-on-score, calm Rally voice, etc.).

**Replaced:**
- `src/lib/firestore.ts` → server-side Drizzle data functions behind API routes.
- `src/lib/firebase.ts`, `src/lib/auth.ts`, `src/lib/auth-context.tsx` → Auth.js.
- `src/lib/notifications.ts` (FCM) → web-push client + subscription API.
- `functions/` Cloud Functions → in-app API routes + a pg-boss worker.
- `firestore.rules` → server-side authorization checks in the API routes (the rule *logic* moves here).
- `output: 'export'`, the static-export routing workarounds, and the placeholder-rewrite hack in `firebase.json` → normal Next.js server routing.
- The Firebase-branch tests → tests against the Postgres data layer (mock/pglite or a test DB).

---

## Data model: Firestore → Postgres

Postgres actually models this **more cleanly** than Firestore did — the per-user
unread map becomes a proper join table.

```
users                      -- Auth.js base + app profile columns
  id (text, pk)            -- Auth.js user id (or google sub)
  email, name, image
  first_name, last_name, age, gender, avatar, photo_url
  ntrp_rating, sport, sports (jsonb), match_formats (jsonb),
  game_type, weekly_availability (jsonb), partner_preferences (jsonb),
  profile_complete (bool), matches_played, wins, losses,
  bio, about_me, location, created_at

accounts, sessions, verification_tokens   -- Auth.js adapter tables

matches            (id, player1_id, player2_id, status, date, time, location,
                    sport, match_type, score, compatibility_score,
                    created_by, accepted_by, conversation_id, participants (jsonb),
                    created_at, updated_at)

match_requests     (id, from_user_id, to_user_id, status, score,
                    conversation_id, created_at)

conversations      (id, type, name, match_id, created_by,
                    last_message, last_message_at, created_at)

conversation_participants  (conversation_id, user_id, unread_count,
                            last_read_at)          -- replaces the unread map

messages           (id, conversation_id, sender_id, sender_name, text,
                    is_ai (bool), created_at)      -- server-generated ids/timestamps

contacts           (user_id, contact_id, name, email, avatar, added_at)

notifications      (id, user_id, type, title, body, read (bool), link, created_at)

push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at)  -- web-push
```

Rally stays a reserved system user (`id = 'rally'`), seeded once.

---

## Feature-by-feature mapping

| Feature | Firebase now | Self-hosted |
|---|---|---|
| Google sign-in | Firebase Auth popup | Auth.js Google provider (OAuth redirect) → session cookie |
| Session / `useAuth` | AuthProvider over Firebase | Auth.js `auth()` (server) + `useSession()` (client); thin `useAuth` shim keeps call sites stable |
| Read/write data | Browser → Firestore (rules) | Browser → **API routes** → Drizzle → Postgres; **authz in the route** (the old rule logic) |
| Live chat / unread | `onSnapshot` | `EventSource` → `/api/.../stream`; server `LISTEN/NOTIFY` fans out inserts |
| Rally reply | Gemini in a Cloud Function | On @rally mention: after() → Ollama (gemma3:4b) → insert Rally reply → NOTIFY (→ SSE) |
| Push notifications | FCM | Web Push (VAPID); send from the same server events |
| Match request / accept notifications | Cloud Functions | Same server-side write path emits notification + web-push |

**Authorization** (the `firestore.rules` logic, now in code): every API route
resolves the session user and checks it — e.g. only conversation participants can
read/post messages; only `toUserId` can accept a request; only the owner edits
their profile. Same rules, enforced in one place.

---

## Mobile app — decision: PWA now, Capacitor later

**Decision:** ship as a **PWA** for now. No app stores.

The app is already a PWA (`manifest.json`, service worker, icons, mobile-first
layout), so it is simultaneously a website *and* an installable, push-capable
mobile app from one codebase — Android installs to the home screen with Web Push,
and iOS 16.4+ supports install + Web Push once added to the home screen. This adds
**zero vendors**, which is exactly the goal. The migration preserves it (Phase 6
swaps the FCM service worker for a standard Web Push one).

**Deferred:** native App Store / Play Store presence via **Capacitor** (wrap the
same web frontend — one codebase, two store listings). We'll only reach for this
if store discoverability becomes a real requirement, and with eyes open that it
adds an Apple Developer account ($99/yr) + Google Play ($25), their review/console
overhead, and native push (APNs/FCM) — i.e. it *increases* management surface.
**React Native is explicitly rejected** (second codebase). Capacitor bolts on
after this migration without changing anything below.

---

## Target topology (single VPS, docker-compose)

Only Caddy is exposed to the internet; Postgres and Ollama live on the internal
Docker network.

```
                    Porkbun DNS  A record → VPS public IP
                                   │
                         ┌─────────▼─────────┐   :443/:80
                         │       Caddy       │  (auto TLS)
                         └─────────┬─────────┘
                                   │ reverse proxy
                         ┌─────────▼─────────┐
                         │   next app (Node) │  SSE, API routes, Auth.js
                         │   + pg-boss worker│
                         └──────┬─────────┬──┘
                internal net    │         │   internal net
                     ┌──────────▼──┐   ┌──▼───────────┐
                     │  postgres   │   │   ollama     │
                     │  Postgres   │   │ gemma3:4b    │
                     └─────────────┘   └──────────────┘
```

`docker-compose.yml` (skeleton):

```yaml
services:
  caddy:
    image: caddy:2
    ports: ["80:80", "443:443"]
    volumes: [./Caddyfile:/etc/caddy/Caddyfile, caddy_data:/data]
  app:
    build: .
    env_file: .env
    depends_on: [postgres, ollama]
  postgres:
    image: postgres:16
    environment: { POSTGRES_PASSWORD: ${DB_PASSWORD} }
    volumes: [pg_data:/var/lib/postgresql/data]
  ollama:
    image: ollama/ollama
    volumes: [ollama_models:/root/.ollama]
    # one-time: ollama pull gemma3:4b
volumes: { caddy_data: {}, pg_data: {}, ollama_models: {} }
```

`Caddyfile`:

```
aiplaymatch.com {
    reverse_proxy app:3000
}
```

**Security hardening (Phase 1):** non-root sudo user; SSH key-only (disable
password + root login); `ufw` allowing only 22/80/443; `fail2ban`; unattended
security upgrades; Postgres/Ollama never published to the host — internal network
only.

---

## Backups & durability (non-negotiable, stays in the OVH plane)

- **OVH automated backup / snapshot add-on** on the VPS (same account/bill).
- **Nightly `pg_dump`** cron kept on-box + shipped into the OVH backup add-on
  (or OVH Object Storage if we want offsite copies), 30-day retention.
- Ollama model + Docker images are reproducible, so backups only need Postgres +
  `.env` + the compose/Caddy files (keep those in the repo).
- Document a **restore drill** and actually test it once.

---

## Secrets / env inventory (`.env` on the box)

```
DATABASE_URL=postgres://…
AUTH_SECRET=…                 # openssl rand -base64 32
AUTH_GOOGLE_ID=…              # from Google Cloud Console OAuth client
AUTH_GOOGLE_SECRET=…
NEXTAUTH_URL=https://aiplaymatch.com
VAPID_PUBLIC_KEY=…            # web-push generate-vapid-keys
VAPID_PRIVATE_KEY=…
OLLAMA_URL=http://ollama:11434
OLLAMA_MODEL=gemma3:4b
```

---

## Phased plan

Each phase is independently verifiable so we never do a big-bang cutover.

**Phase 0 — Provision (you).** VPS up (Debian 13, OVH vps2-2027); domain at Porkbun with
an A record to the VPS IP; Google OAuth client created (redirect
`https://<domain>/api/auth/callback/google`); OVH backups enabled; SSH key
access for me. *Deliverable: I can `ssh` in and the domain resolves.*

**Phase 1 — Box + skeleton.** Harden the OS; install Docker; commit
`docker-compose.yml` + `Caddyfile`; convert Next to a server build (drop
`output: 'export'`, remove the placeholder/rewrite hacks); ship a "hello world"
over HTTPS. *Verify: `https://<domain>` serves the app with a valid cert.*

**Phase 2 — Auth.** Add Auth.js (Google-only) + Drizzle adapter tables; replace
`auth-context`/`login`/`register` with the OAuth flow behind a thin `useAuth`
shim; onboarding writes the profile to Postgres; protected routes use the session.
*Verify: sign in with Google, complete onboarding, refresh persists.*

**Phase 3 — Data layer.** Drizzle schema + migrations for all tables; port every
`firestore.ts` function to server data functions behind API routes with authz
guards; point pages at the API. *Verify: dashboard, matches, requests, contacts,
profile all read/write against Postgres.*

**Phase 4 — Realtime.** SSE endpoints for a conversation's messages and for the
conversation-list/unread; Postgres `LISTEN/NOTIFY` on insert; swap
`subscribeMessages`/`subscribeConversations` to `EventSource`. *Verify: two
browsers, a message appears live; unread badges update.*

**Phase 5 — Rally AI.** Ollama + gemma3:4b; on `@rally` mention the message route uses after() to
calling Ollama with the existing prompt builder; insert reply → NOTIFY delivers
it. *Verify: `@rally where do we play?` gets a sensible reply in ~10–20s.*

**Phase 6 — Push.** Generate VAPID keys; subscription API + `push_subscriptions`
table; replace `firebase-messaging-sw.js` with a standard web-push service worker;
send on new-message / match-request / match-accepted. *Verify: background tab
receives a push.*

**Phase 7 — Tests & hardening.** Migrate the suite to the Postgres data layer
(test DB or pglite); keep the pure-logic tests (matching engine, ai-assistant
helpers) as-is; wire `test:ci`; verify backups + restore; add basic uptime
monitoring (a simple external ping is fine). *Verify: green CI, restore drill
passes.*

**Phase 8 — Cutover & decommission.** (If preserving data) one-time
Firestore→Postgres export/import; flip DNS if not already; **delete the Firebase
project** and the Vercel/other accounts. *Deliverable: two vendors remain.*

---

## Testing strategy

- **Pure logic** (matching engine, ai-assistant helpers) — unchanged, already ≥95%.
- **Data layer** — integration tests against a disposable Postgres (Docker) or
  `pglite`, replacing the Firestore-mock tests.
- **API routes** — test authz guards directly (participant checks, ownership).
- **Components/pages** — mostly survive; swap the data/auth mocks from Firebase
  shapes to the new API/session shapes.

---

## Rollback / safety

- Do the whole migration on a branch (`self-host-migration`); master/Firebase
  stays deployable until Phase 8.
- Because the site is currently down, there's no live traffic to disrupt — we can
  build and validate the VPS fully before pointing the domain at it.
- Nothing is deleted from Firebase until Phase 8, and only after the VPS is
  verified end-to-end.

---

## What I need from you to start "cooking"

1. Answers to the three open questions (data-to-preserve?, domain, ARM/x86).
2. Phase 0 done: VPS reachable, domain A-record set, Google OAuth client created,
   OVH backups on, my SSH key added.
3. The Google OAuth **client ID + secret** and the chosen **domain** (I'll place
   them in `.env` on the box; they never go in the repo).

Once that's in place I'll start at Phase 1 and work down, checking in at each
phase boundary so you can see it working before we move on.
