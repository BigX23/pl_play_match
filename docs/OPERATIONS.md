# PlayMatch — Operations & Runbook

The app is fully self-hosted. **Two vendors:** OVH (the VPS) and Porkbun (domain/DNS).

- **Live site:** https://aiplaymatch.com
- **VPS:** OVH vps2-2027 · Debian 13 · `15.204.114.63` · user `debian` (SSH key-only)
- **Stack (docker-compose in `~/app/deploy`):** Caddy · Next.js app · Postgres 16 · Ollama (gemma3:4b)
- **Secrets:** `~/app/deploy/.env` on the box (never in git). Local creds in `ovh.env` (gitignored).

---

## Manual steps only you can do (do these to fully close out)

1. **Rotate the old Gemini API key.** It was public in the repo's git history (since
   April 2025) and in old built bundles. The app no longer uses it, but the key is
   still live until you rotate it: Google AI Studio → delete/rotate the key. Nothing
   in the app depends on it anymore.
2. **Delete the Firebase project** (`pl-play-match`) in the Firebase console once
   you've confirmed the site works — Auth, Firestore, Hosting, FCM, Storage are all
   unused now. This is the moment the vendor list truly drops to OVH + Porkbun.
3. **Delete the admin service-account key** from your local disk:
   `pl-play-match-firebase-adminsdk-*.json` (repo root). It's gitignored but useless
   now — remove it (and it's revoked automatically when the project is deleted).

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
