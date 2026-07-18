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

From your machine: push to `self-host-migration` (or `master` once merged). On the box:

```bash
ssh playmatch   # alias in ~/.ssh/config
cd ~/app && git pull
cd deploy && sudo docker compose build app && sudo docker compose up -d app
```

**Lockfile gotcha:** macOS npm and the build container's npm can disagree on optional
platform deps, breaking `npm ci` in Docker. If a build fails on `npm ci`, regenerate
the lockfile inside the build image and commit it:

```bash
ssh playmatch 'cd ~/app && sudo docker run --rm -v "$PWD":/work -w /work node:24-alpine \
  sh -c "npm install --package-lock-only && npm ci --dry-run"'
scp playmatch:app/package-lock.json ./package-lock.json && git commit -am "lockfile" && git push
```

For long builds, run detached so an SSH blip can't interrupt:
`nohup sh -c "sudo docker compose build app && sudo docker compose up -d app" > /tmp/deploy.log 2>&1 &`

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
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — `npx web-push generate-vapid-keys`
  (rotating invalidates existing push subscriptions; users re-enable in Settings).
- `POSTGRES_PASSWORD` / `DATABASE_URL` — keep in sync if changed.

---

## TLS / DNS

- Caddy auto-manages Let's Encrypt certs (renews automatically). Nothing to do.
- DNS at Porkbun: `A @ → 15.204.114.63`, `A www → 15.204.114.63` (+ AAAA). If the IP
  ever changes, update these two records.
