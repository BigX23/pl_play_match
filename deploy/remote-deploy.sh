#!/usr/bin/env bash
#
# PlayMatch production deploy — runs ON the VPS.
#
# The GitHub Actions `deploy` job pipes this script into the box's shell over
# SSH (`ssh … 'bash -s' < deploy/remote-deploy.sh`) after CI passes on master.
# It fast-forwards the checkout to the pushed commit, rebuilds the app image,
# restarts it, health-checks the live site, and rolls back to the previous
# commit if the new build fails to serve.
#
# stdout/stderr stream back through SSH into the Actions log.
set -euo pipefail

REPO_DIR="$HOME/app"
COMPOSE_DIR="$REPO_DIR/deploy"
HEALTH_URL="https://aiplaymatch.com/"
HEALTH_RETRIES=30 # 30 × 5s = up to ~2.5 min for the container to come up
HEALTH_DELAY=5

cd "$REPO_DIR"

PREV_SHA="$(git rev-parse HEAD)"
echo "==> Currently deployed: $PREV_SHA"

git fetch --quiet origin master
git reset --hard origin/master # tracked files only; leaves deploy/.env untouched
NEW_SHA="$(git rev-parse HEAD)"

if [ "$NEW_SHA" = "$PREV_SHA" ]; then
  echo "==> No new commits (already at $NEW_SHA); rebuilding anyway to apply this deploy."
else
  echo "==> Deploying $NEW_SHA (was $PREV_SHA)"
fi

# Build the new image and (re)start the app container.
build_and_start() {
  cd "$COMPOSE_DIR"
  docker compose build app
  docker compose up -d app
}

# Poll the public URL until it serves HTTP 200, or give up.
health_ok() {
  local code
  for i in $(seq 1 "$HEALTH_RETRIES"); do
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$HEALTH_URL" || true)"
    if [ "$code" = "200" ]; then
      echo "==> Health check passed (HTTP 200) after ${i} attempt(s)."
      return 0
    fi
    echo "    health ${i}/${HEALTH_RETRIES}: HTTP ${code:-000} — retrying in ${HEALTH_DELAY}s"
    sleep "$HEALTH_DELAY"
  done
  return 1
}

echo "==> Building and starting new version…"
build_and_start

if health_ok; then
  echo "==> ✅ Deploy succeeded — $NEW_SHA is live."
  docker image prune -f >/dev/null 2>&1 || true # reclaim the old dangling image
  exit 0
fi

echo "!!! ❌ New version failed its health check — rolling back to $PREV_SHA"
cd "$REPO_DIR"
git reset --hard "$PREV_SHA"
build_and_start

if health_ok; then
  echo "!!! Rolled back — previous version ($PREV_SHA) restored. Deploy FAILED."
else
  echo "!!! CRITICAL: rollback ALSO failed its health check. Manual intervention needed."
fi
exit 1
