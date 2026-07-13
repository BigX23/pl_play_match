# 🎾 Pleasanton PlayMatch

A tennis & pickleball partner-matching PWA for the Pleasanton community. Players onboard
with a profile, get weighted compatibility matches, send/accept match requests, chat in
real time with an AI coach (**Rally**), and get push notifications — mobile-first,
installable, and **entirely self-hosted**.

**Live:** https://aiplaymatch.com

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)
![Self-hosted](https://img.shields.io/badge/self--hosted-OVH%20%2B%20Porkbun-success)
![PWA](https://img.shields.io/badge/PWA-installable-green)

> **Fully self-hosted, no external backend.** The app runs as a single Next.js server on a
> VPS you own, alongside Postgres, Ollama (local AI), and Caddy — **two vendors total: OVH
> and Porkbun.** It was migrated off Firebase in July 2026; no Firebase code remains.

---

## ✨ Features

- **Google sign-in** (Auth.js) — no passwords, no email infrastructure.
- **Mandatory onboarding** — 4 steps (Basic Info → Play Preferences → Availability →
  Partner Preferences); the dashboard is gated until the profile is complete.
- **Weighted matching engine** — availability, sport, NTRP, game type, match format,
  gender, age → a 0–100 compatibility score, with a hard NTRP-mismatch exclusion.
- **Match request flow** — send/accept/decline; accepting spins up a group chat with a
  Rally intro.
- **Open matches** — browse, create, and join community matches (transactional join).
- **Real-time chat** — Server-Sent Events over Postgres `LISTEN/NOTIFY`; unread badges,
  date separators, delete-with-confirm.
- **Rally, the AI coach** — replies to `@rally` mentions using a **local Gemma model
  (Ollama)** on the server. Zero AI API cost, no key.
- **Web Push** notifications (VAPID) — new messages, match requests, accepts.
- **Profile** with photo upload, stats, availability, and preferences.
- **PWA** — installable, offline shell, dark/light mode.

---

## 🧱 Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, standalone server) |
| Language | TypeScript 5 |
| UI | React 18, shadcn/ui + Radix, Tailwind CSS, Lucide, next-themes |
| Auth | Auth.js (NextAuth v5) — Google only, DB sessions |
| Database | PostgreSQL 16 + Drizzle ORM (postgres.js) |
| Realtime | Server-Sent Events + Postgres LISTEN/NOTIFY |
| AI | Ollama running `gemma3:4b` (local) |
| Push | Web Push (VAPID) + service worker |
| Proxy / TLS | Caddy (automatic Let's Encrypt) |
| Hosting | OVH VPS (Debian 13), docker-compose |
| Tests | Vitest + Testing Library + pglite |

---

## 🚀 Getting started (local dev)

**Prerequisites:** Node.js 24+, a PostgreSQL 16 database, and (optional) Ollama for Rally.

```bash
git clone https://github.com/BigX23/pl_play_match.git
cd pl_play_match
npm install
```

Create `.env` (or `.env.local`) with at least:

```env
DATABASE_URL=postgres://user:pass@localhost:5432/playmatch
AUTH_SECRET=            # openssl rand -base64 32
AUTH_GOOGLE_ID=         # Google OAuth client (redirect: http://localhost:9002/api/auth/callback/google)
AUTH_GOOGLE_SECRET=
AUTH_URL=http://localhost:9002
# Optional — Rally AI:
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=gemma3:4b
# Optional — Web Push (npx web-push generate-vapid-keys):
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:you@example.com
```

```bash
npm run dev        # http://localhost:9002
```

Database migrations and the Rally system user are applied automatically at server boot
(`src/instrumentation.ts`). To edit the schema, change `src/db/schema.ts` then
`npx drizzle-kit generate --name <desc>` and commit the new `drizzle/*.sql`.

**No Google client yet?** Set `NEXT_PUBLIC_MOCK_AUTH=true` to sign in as a fake local user
(localStorage, no server) for UI work.

### Scripts

| Command | Does |
|---|---|
| `npm run dev` | Dev server on :9002 (Turbopack) |
| `npm run build` / `npm start` | Production standalone build / run |
| `npm run typecheck` | `tsc` for app + test configs |
| `npm run lint` | ESLint (next lint) |
| `npm test` / `npm run test:ci` | Vitest / Vitest with coverage gate |

---

## 🏗️ How it works (short version)

The browser never touches the database. It calls JSON API routes under `/api/*`; each route
resolves the Auth.js session, enforces authorization in `src/server/data.ts`, and uses
Drizzle against Postgres. Realtime is Server-Sent Events nudged by Postgres `LISTEN/NOTIFY`
(the client re-fetches on a "something changed" signal). Rally's replies and push
notifications are generated **after** the response via `after()` from `next/server`.

```
Browser ──HTTPS──▶ Caddy ──▶ Next.js (UI + /api + SSE) ──▶ Postgres
                                     │
                                     └──▶ Ollama (gemma3:4b, Rally)
```

**Full detail for contributors and agents: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).**

---

## 📚 Documentation

| Doc | What |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Complete design, data model, request flow, conventions — start here |
| [`docs/OPERATIONS.md`](docs/OPERATIONS.md) | Runbook: deploying, backups, secret rotation, DNS/TLS |
| [`docs/MATCHING_ENGINE.md`](docs/MATCHING_ENGINE.md) | Compatibility scoring reference |
| [`docs/DEPLOYMENT_MIGRATION.md`](docs/DEPLOYMENT_MIGRATION.md) | The Firebase → self-hosted migration history & rationale |

---

## 📦 Deployment

Deployed via `docker-compose` (Caddy · Next app · Postgres · Ollama) on an OVH VPS; Caddy
handles TLS automatically. See [`docs/OPERATIONS.md`](docs/OPERATIONS.md) for the deploy
flow, and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) §13 for the topology.

---

## 📄 License

Private project.
