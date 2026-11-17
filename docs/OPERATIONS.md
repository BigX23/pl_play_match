# PlayMatch — Operations & Runbook

The app is fully self-hosted. **Two vendors:** OVH (the VPS) and Porkbun (domain/DNS).

- **Live site:** https://aiplaymatch.com
- **VPS:** OVH vps2-2027 · Debian 13 · `15.204.114.63` · user `debian` (SSH key-only)
- **Stack (docker-compose in `~/app/deploy`):** Caddy · Next.js app · Postgres 16 · Ollama (gemma3:4b)
- **Secrets:** `~/app/deploy/.env` on the box (never in git). Local creds in `ovh.env` (gitignored).

---

## Manual steps only you can do (do these to fully close out)

1. ~~**Rotate the old Gemini API key.**~~ ✅ **Done (2026-07-14).** All keys were
   deleted in Google AI Studio, so the old key — still present as a dead string in
   git history (`.env`, `firebase-messaging-sw.js`) — is now permanently unusable.
   No history rewrite needed; the credential is neutralized at the source.
2. ~~**Delete the Firebase project.**~~ ✅ **Partially done (2026-07-14).** All
   Firebase *services* (Auth, Firestore, Hosting, FCM, Storage) were deleted. The
   underlying **Google Cloud project must stay** — it hosts the OAuth 2.0 client that
   powers Google sign-in (`AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`). Deleting the
   Firebase project deletes the GCP project and would break login. ⚠️ **Do not delete
   `pl-play-match` in the Google Cloud / Firebase console.** Runtime vendors are now
   OVH (hosting) + Porkbun (domain) + Google (free OAuth identity only, no billed use).
3. ~~**Revoke the leftover Firebase Admin service-account key.**~~ ✅ **Done (2026-07-14).**
   The `firebase-adminsdk-*` service account was deleted in Google Cloud IAM (revoking the
   key at the source), and the local `pl-play-match-firebase-adminsdk-*.json` was deleted
   from disk. No Firebase Admin credential remains anywhere.

---

## Deploying a change

**Deploys are automatic (CI/CD).** Push/merge to `master` → GitHub Actions
(`.github/workflows/ci.yml`) runs the `verify` job (typecheck/lint/test/build), then the
gated `deploy` job SSHes to the VPS and runs `deploy/remote-deploy.sh`:

> fetch → hard-reset to the pushed commit → `docker compose build app` → `up -d app` →
> health-check `https://aiplaymatch.com/` → **auto-rollback** to the previous commit if the
> new build fails to serve.

The `deploy` job runs only on push to `master`, never on PRs, and is serialized (a
concurrency group). Watch a deploy:

```bash
gh run list  --repo BigX23/pl_play_match --branch master --limit 3
gh run watch <run-id> --repo BigX23/pl_play_match --exit-status
```

Deploy secrets (`DEPLOY_SSH_KEY`, `VPS_HOST`, `VPS_USER`, `VPS_KNOWN_HOSTS`) are GitHub
Actions secrets; a dedicated deploy key sits in the VPS `~/.ssh/authorized_keys`
(`github-actions-deploy@pl_play_match`). Do **not** run a manual deploy concurrently.

**Manual deploy (fallback only — normally unnecessary):**

```bash
ssh playmatch
cd ~/app && git pull --ff-only
cd deploy && docker compose build app && docker compose up -d app
```

**Lockfile gotcha:** macOS npm and the build container's npm can disagree on optional
platform deps, breaking `npm ci` in Docker. If a build fails on `npm ci`, regenerate
the lockfile inside the build image and commit it:

```bash
ssh playmatch 'cd ~/app && sudo docker run --rm -v "$PWD":/work -w /work node:24-alpine \
  sh -c "npm install --package-lock-only && npm ci --dry-run"'
scp playmatch:app/package-lock.json ./package-lock.json && git commit -am "lockfile" && git push
```

---

## Common operations

```bash
# Status / logs
sudo docker compose -f ~/app/deploy/docker-compose.yml ps
sudo docker logs deploy-app-1 --since 10m

# Postgres shell
sudo docker exec -it deploy-postgres-1 psql -U playmatch -d playmatch

# Ollama: list / swap the model (edit OLLAMA_MODEL in deploy/.env, then restart app)
sudo docker exec deploy-ollama-1 ollama list
sudo docker exec deploy-ollama-1 ollama pull <model>

# Disk / memory
df -h / ; free -h ; sudo docker system df
sudo docker system prune -f            # reclaim dangling images/layers
```

---

## Incident runbook

### Rally slow / app container pegging CPU — SSE zombie-stream leak
**Symptom:** Rally replies crawl and/or the "typing" indicator times out; `docker stats`
shows `deploy-app-1` burning most cores (~390%) and GBs of RAM, while `ollama` sits idle.
**Cause:** disconnected SSE clients whose Postgres LISTEN/NOTIFY listeners never tore down,
buffering forever (Next.js standalone doesn't reliably fire `req.signal` "abort").

- **Immediate relief:** `ssh playmatch 'cd ~/app/deploy && docker compose restart app'`
  (CPU drops to single digits, RAM resets; Rally is fast again within seconds).
- **Root cause** is fixed in `src/server/sse.ts` (5-min max-lifetime cap + backpressure
  teardown; the client `EventSource` reconnects seamlessly). If it recurs despite that,
  re-check stream teardown before suspecting Ollama.
- First observed 2026-07-28; it took ~10 days of traffic to build up to 2.4 GB / ~390% CPU.

### Rally not responding at all
Rally only replies to messages matching `shouldRallyRespond` (an `@rally` mention). Server
trigger: `src/server/rally.ts`, run via `after()` in the message POST route; the client
"typing" indicator uses the same gate. Confirm the model is warm:
`ssh playmatch 'docker exec deploy-ollama-1 ollama ps'` (should show `UNTIL: Forever`).

---

## Backups (durability — don't skip)

- **OVH automated backup add-on** is enabled on the VPS (whole-disk snapshots).
- **Recommended additional layer:** nightly `pg_dump` off-box. Example cron on the VPS:
  ```bash
  0 3 * * * sudo docker exec deploy-postgres-1 pg_dump -U playmatch playmatch | gzip > ~/backups/pg-$(date +\%F).sql.gz
  ```
  Keep ~30 days; copy to OVH Object Storage or a Storage Box for offsite. **Test a
  restore once** so you know it works.
- Reproducible from git: `deploy/docker-compose.yml`, `Caddyfile`, the Dockerfile,
  and `drizzle/` migrations. Only Postgres data + `deploy/.env` are irreplaceable.

---

## Rotating secrets

All live in `~/app/deploy/.env`; edit then `docker compose up -d app` (or `restart`):

- `AUTH_SECRET` — `openssl rand -base64 32` (rotating logs everyone out).
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — from Google Cloud Console OAuth client.
- `AUTH_GOOGLE_IOS_CLIENT_ID` / `AUTH_GOOGLE_ANDROID_CLIENT_ID` — the iOS and
  Android OAuth client IDs (GCP project `pl-play-match` → Credentials). Not secret;
  `POST /api/auth/native` accepts Google ID tokens whose `aud` is the web, iOS, or
  Android client ID. Unset → native Google sign-in answers 503 (`AUTH_GOOGLE_ID`
  must be set for the app's Google button to work at all). See "Native-app sign-in" below.
- `AUTH_APPLE_TEAM_ID` / `AUTH_APPLE_KEY_ID` / `AUTH_APPLE_PRIVATE_KEY` — the Sign in with
  Apple key from Apple Developer → Keys (download the `.p8` once; paste its contents, `\n`
  escapes are fine). Rotating: create a new key, swap all three values, restart, then revoke
  the old key. Existing refresh tokens keep working (they belong to the client, not the key).
  `AUTH_APPLE_ID` — the web **Services ID**. Without these, Apple sign-in is off.
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — `npx web-push generate-vapid-keys`
  (rotating invalidates existing push subscriptions; users re-enable in Settings).
- `POSTGRES_PASSWORD` / `DATABASE_URL` — keep in sync if changed.

---

## Native-app sign-in (`/api/auth/native`)

The iOS/Android apps can't run Google OAuth in their WebView, so they sign in with the
native SDK and POST the ID token to `/api/auth/native`, which verifies it (Google/Apple
JWKS, `iss`, `aud`, `exp`, nonce) and sets a normal Auth.js session cookie.

- **Rate limit:** 10 requests/minute per client IP, **in memory**. That's correct for
  the single `app` container we run; with several replicas each keeps its own count.
- Rejections are logged as `[auth/native] google sign-in rejected: <code>` (e.g.
  `invalid_aud` after a client-ID change, `token_expired` for a bad device clock).
- New env vars arrive through `env_file: .env` in `deploy/docker-compose.yml`, like
  every other app secret.
- **Google client IDs** live in GCP project `pl-play-match` → APIs & Services →
  Credentials. The web client (`AUTH_GOOGLE_ID`) is also what Android's Credential Manager
  puts in `aud`. The iOS client (bundle ID `com.aiplaymatch.app`) is
  `AUTH_GOOGLE_IOS_CLIENT_ID`, and its *reversed* form must be the URL scheme in
  `ios/App/App/Info.plist` (placeholder `com.googleusercontent.apps.REPLACE-WITH-IOS-CLIENT-ID`;
  changing it needs a new app build). The Android client (package `com.aiplaymatch.app`)
  needs the SHA-1 of every signing key that ships: the debug keystore for local builds
  and the Play App Signing key for store builds. A missing SHA-1 shows up on the device as
  `[28444] Developer console is not set up correctly`.
- **Sign in with Apple:** App ID `com.aiplaymatch.app` needs the *Sign in with Apple*
  capability (the project already has `App/App.entitlements`). The web Services ID's return
  URL is `https://aiplaymatch.com/api/auth/callback/apple` (domain `aiplaymatch.com`;
  Apple doesn't allow localhost/http, so web Apple sign-in can only be tested on the live
  site). The client-secret JWT is minted at runtime and lives 24 h, so nothing expires
  every 6 months.
- **Account deletion revokes Apple tokens** first. A failed revoke is logged as
  `[apple] revoke failed for user <id> (client <id>): …` or `cannot revoke tokens … env vars
  are not set` and deletion continues. Follow up by hand if you see one (the user can also
  remove the app under Settings → Apple ID → Sign in with Apple).

---

## TLS / DNS

- Caddy auto-manages Let's Encrypt certs (renews automatically). Nothing to do.
- DNS at Porkbun: `A @ → 15.204.114.63`, `A www → 15.204.114.63` (+ AAAA). If the IP
  ever changes, update these two records.
