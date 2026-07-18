# Secrets Management — Implementation Plan

> **Status:** proposed, not yet executed. This is a one-time execution artifact.
> Once the work is done, the durable deliverable is `docs/SECRETS.md` (Phase 4) and
> this plan file can be deleted.
>
> **How to run:** `/goal implement the plan in docs/SECRETS_SETUP_PLAN.md`

## Objective

Right-size secret management for a **single-VPS, single-operator** app — no Vault, no
daemon. Close the two real gaps from the security review:

1. **No encrypted, offsite backup** of the irreplaceable `deploy/.env` (losing the VAPID
   keypair kills every push subscription; losing OAuth secrets breaks login).
2. **No leak prevention** — nothing stops the *next* accidental secret commit (the exact
   failure that leaked the now-dead Gemini key).

Approach: **SOPS + age** for encrypted-at-rest backup, **gitleaks + GitHub push
protection** for leak prevention, and a **`docs/SECRETS.md` SOP** tying it together.

## Design decisions (baked in)

- **`deploy/.env` stays the runtime source of truth on the box** (plaintext, perms `600`).
  We do **not** add a decrypt step to the boot/deploy critical path — that keeps the app's
  startup free of a new dependency and SPOF. SOPS is used for **backup**, not for
  boot-time secret injection. (GitOps decrypt-on-deploy is noted as a future option.)
- **The repo is PUBLIC**, so the encrypted `deploy/.env.enc` is **git-ignored here**, not
  committed. It is stored offsite (password manager, and optionally a private repo).
  SOPS-encrypted files are cryptographically safe to commit, but keeping them out of a
  public repo is defense-in-depth.
- **Two age recipients** encrypt the backup: the **box key** (on the VPS) and a
  **break-glass key** (held offline in your password manager). Either can decrypt — so a
  dead box is fully recoverable from the password manager alone.
- **gitleaks runs in two places:** a local **pre-commit** hook (`gitleaks protect
  --staged`, scans only staged changes) and a **CI** job (scans pushed commits). Neither
  scans full history, so the dead keys still in history won't cause perpetual failures; we
  also add a `.gitleaks.toml` allowlist documenting those known-dead fingerprints.

## Decisions you must make (Phase 0 inputs)

1. **Offsite store for `deploy/.env.enc` + the break-glass age private key.** Default:
   your password manager (1Password/Bitwarden secure note + attachment). Alternative: a
   new **private** GitHub repo `pl_play_match-secrets`. Pick one (password manager is
   simplest for one operator).
2. **Include the local secret files** (`ovh.env`, `.env.local`) in the same encrypted
   backup? Recommended yes — same mechanism, one more `sops -e`.

## Prerequisites / tools

- **Local (mac):** `gitleaks`, `sops`, `age` — `brew install gitleaks sops age`.
- **VPS (Debian):** `age` (`apt-get install -y age`, else release binary) and `sops`
  (release binary from `getsops/sops`, or apt if available). Both are small static Go
  binaries — negligible footprint, no daemon.
- `gh` CLI authenticated as the repo owner (already true).

---

## Phase 1 — age keypairs + SOPS backup of `deploy/.env`

**Goal:** an encrypted `deploy/.env.enc` that can be restored on a fresh box, protected by
two independent keys.

1. **Generate the box age key on the VPS:**
   ```bash
   ssh playmatch 'mkdir -p ~/.config/sops/age && \
     test -f ~/.config/sops/age/keys.txt || age-keygen -o ~/.config/sops/age/keys.txt && \
     chmod 600 ~/.config/sops/age/keys.txt && \
     grep "public key" ~/.config/sops/age/keys.txt'
   ```
   Record the **box public key** (`age1...`).

2. **Generate the break-glass key** (on the box, then move the private half OFF-box):
   ```bash
   ssh playmatch 'age-keygen -o /tmp/breakglass.txt && grep "public key" /tmp/breakglass.txt && cat /tmp/breakglass.txt'
   ```
   - Copy the **entire `/tmp/breakglass.txt`** contents into your password manager as
     "PlayMatch break-glass age key".
   - Then **shred it from the box:** `ssh playmatch 'shred -u /tmp/breakglass.txt'`.
   - Record the **break-glass public key**.

3. **Install `sops` + `age` on the box** (if not present) — release binaries or apt.

4. **Write `.sops.yaml`** in the repo root (public keys only — safe to commit):
   ```yaml
   creation_rules:
     - path_regex: (deploy/\.env|ovh\.env|\.env\.local)(\.enc)?$
       age: >-
         <BOX_PUBLIC_KEY>,
         <BREAKGLASS_PUBLIC_KEY>
   ```

5. **Encrypt on the box** (plaintext never leaves the box):
   ```bash
   ssh playmatch 'cd ~/app && sops --encrypt --input-type dotenv --output-type dotenv deploy/.env > deploy/.env.enc'
   ```
   Pull the encrypted file locally and store it offsite (per Phase 0 choice):
   ```bash
   scp playmatch:~/app/deploy/.env.enc /tmp/env.enc   # → password manager / private repo
   ```

6. **Add a helper** `deploy/env-backup.sh` (runs on the box) that re-encrypts and reminds
   you to refresh the offsite copy — to be run whenever a secret changes.

7. **Gitignore the encrypted + plaintext env** in this public repo: add
   `deploy/.env.enc` to `.gitignore` (plaintext `.env` already ignored).

**Verify:** `sops --decrypt deploy/.env.enc` on the box reproduces the original values;
`age --decrypt` with the break-glass key (test locally) also works.

---

## Phase 2 — Leak prevention: gitleaks (pre-commit + CI)

**Goal:** secrets can't be committed locally or slip through CI.

1. **`.gitleaks.toml`** in repo root: extend the default config and **allowlist the known
   dead fingerprints** still in history (Gemini + old Firebase keys), with a comment that
   they were revoked 2026-07-14. Generate fingerprints via a one-time
   `gitleaks detect --report-path /tmp/leaks.json` and copy the offending fingerprints.

2. **Local pre-commit hook** (committed, shareable — no Python framework needed):
   - Create `.githooks/pre-commit`:
     ```bash
     #!/usr/bin/env bash
     exec gitleaks protect --staged --redact -v
     ```
   - `chmod +x .githooks/pre-commit`
   - Wire it up: `git config core.hooksPath .githooks` (document in SECRETS.md so it's set
     on any clone).

3. **CI job** in `.github/workflows/ci.yml` — add a `secrets-scan` job (parallel to
   `verify`) using `gitleaks/gitleaks-action@v2`, scanning pushed/PR commits. Gate it so a
   finding fails the build (and therefore blocks the `deploy` job, which `needs: verify` —
   optionally also add `needs: [verify, secrets-scan]` to `deploy`).

**Verify:** a deliberately-staged fake secret is blocked by the pre-commit hook; a test
branch with a fake secret fails the CI `secrets-scan` job.

---

## Phase 3 — GitHub secret scanning + push protection

**Goal:** GitHub itself rejects pushes containing recognized secret patterns (free for
public repos).

1. Enable via API (repo owner):
   ```bash
   gh api -X PATCH repos/BigX23/pl_play_match \
     -f 'security_and_analysis[secret_scanning][status]=enabled' \
     -f 'security_and_analysis[secret_scanning_push_protection][status]=enabled'
   ```
   (Or Settings → Code security → enable *Secret scanning* + *Push protection*.)

**Verify:** `gh api repos/BigX23/pl_play_match --jq '.security_and_analysis'` shows both
`enabled`.

---

## Phase 4 — `docs/SECRETS.md` SOP (the durable deliverable)

Write `docs/SECRETS.md` containing:

1. **Inventory table** — every secret: name · where it lives (box `deploy/.env` / GitHub
   Actions / GCP OAuth) · purpose · how to rotate · last-rotated date. Seed it from
   `OPERATIONS.md` "Rotating secrets" + the CI/CD secrets + OAuth.
2. **Backup & restore** — the SOPS + age procedure from Phase 1, including full
   box-loss recovery using the break-glass key from the password manager.
3. **Leak prevention** — the gitleaks hook + CI + GitHub push protection setup, and how to
   set `core.hooksPath` on a fresh clone.
4. **Rotation runbook** — per-secret steps; reminder to re-run `env-backup.sh` after any
   change so the offsite backup can't drift.
5. **Incident response** — "if a secret leaks: revoke at source first (not just git),
   then rotate, then refresh backup" — with the lesson from the Gemini key (public repo =
   assume compromised the moment it lands).
6. Cross-link from `OPERATIONS.md` and `README.md`.

---

## Phase 5 — Commit & verify

- Commit the doc edits already pending (Gemini + Firebase close-outs in `OPERATIONS.md`)
  **plus** all of the above in one focused commit (e.g. `chore(security): SOPS+age
  backup, gitleaks, secrets SOP`).
- Confirm CI passes (including the new `secrets-scan` job).
- Confirm nothing secret is staged: `git diff --cached | gitleaks protect --staged` clean,
  and `git ls-files | grep -E '\.env|\.enc|secret|ovh'` returns nothing.

---

## Actions that will need your authorization at run time

These touch prod / external state and will prompt for approval when the goal runs:

- SSH commands that **write to the VPS** (installing `age`/`sops`, generating keys,
  creating `deploy/.env.enc`, adding `env-backup.sh`).
- **Enabling GitHub secret scanning / push protection** (repo settings change).
- **Committing and pushing** to `master`.
- Handling the **break-glass age private key** — you place it in your password manager;
  it is shredded from the box and never committed.

## Definition of done

- [ ] `deploy/.env.enc` exists, decryptable by **both** box key and break-glass key.
- [ ] Break-glass age key + `.env.enc` stored offsite (password manager / private repo).
- [ ] `deploy/.env.enc` git-ignored; no plaintext or encrypted secret tracked in the repo.
- [ ] `env-backup.sh` on the box re-encrypts in one command.
- [ ] gitleaks pre-commit hook blocks a staged fake secret.
- [ ] CI `secrets-scan` job green on clean code, red on a planted secret.
- [ ] GitHub secret scanning + push protection both `enabled`.
- [ ] `docs/SECRETS.md` written; `OPERATIONS.md`/`README.md` cross-linked.
- [ ] Everything committed; CI green.

## Rollback / safety

- All changes are additive or config-only; nothing alters the running app or its boot
  path. The app keeps reading the same `deploy/.env` throughout.
- If a phase misbehaves, it can be reverted independently (delete `.sops.yaml` /
  `.gitleaks.toml` / the CI job; `git config --unset core.hooksPath`) with no runtime
  impact.
- The plaintext `deploy/.env` on the box is never moved or deleted — only *copied* into an
  encrypted backup.
