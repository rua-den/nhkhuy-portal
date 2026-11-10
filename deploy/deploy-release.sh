#!/usr/bin/env bash
set -euo pipefail

APP_ROOT=/opt/nhkhuy-portal
SERVICE=nhkhuy-portal
SERVICE_USER=nhkhuy-portal
DEPLOY_HOME=/home/rua
ARTIFACT="$DEPLOY_HOME/nhkhuy-portal-artifacts/$1.tar.gz"
SHA="${1:-}"

if [[ $EUID -ne 0 ]]; then echo "Must run as root."; exit 1; fi
if [[ $# -ne 1 || ! "$SHA" =~ ^[0-9a-f]{40}$ ]]; then echo "Usage: deploy-nhkhuy-portal <40-char-commit-sha>"; exit 2; fi
if [[ ! -f "$ARTIFACT" ]]; then echo "Artifact not found: $ARTIFACT"; exit 3; fi

RELEASE="$APP_ROOT/releases/$SHA"
STAGING="$APP_ROOT/releases/.staging-$SHA"
CURRENT="$APP_ROOT/current"
PREVIOUS=""
if [[ -L "$CURRENT" ]]; then PREVIOUS="$(readlink -f "$CURRENT" || true)"; fi

rm -rf "$STAGING"
install -d -o root -g "$SERVICE_USER" -m 0750 "$STAGING"
tar -tzf "$ARTIFACT" >/dev/null
tar -xzf "$ARTIFACT" -C "$STAGING" --no-same-owner --no-same-permissions
for required in src/server.js public/index.html public/app.js config/services.json; do
  [[ -f "$STAGING/$required" ]] || { echo "Artifact missing $required"; rm -rf "$STAGING"; exit 4; }
done
chown -R root:"$SERVICE_USER" "$STAGING"
find "$STAGING" -type d -exec chmod 0750 {} +
find "$STAGING" -type f -exec chmod 0640 {} +
rm -rf "$RELEASE"
mv "$STAGING" "$RELEASE"

ln -s "$RELEASE" "$APP_ROOT/current.next"
mv -Tf "$APP_ROOT/current.next" "$CURRENT"
chown -h root:"$SERVICE_USER" "$CURRENT"

systemctl restart "$SERVICE"
healthy=0
for attempt in $(seq 1 30); do
  if curl --fail --silent http://127.0.0.1:4189/api/health | grep -q '"status":"ok"'; then
    healthy=1
    break
  fi
  sleep 1
done

if [[ $healthy -ne 1 ]]; then
  echo "Health check failed; rolling back."
  if [[ -n "$PREVIOUS" && -d "$PREVIOUS" ]]; then
    ln -s "$PREVIOUS" "$APP_ROOT/current.rollback"
    mv -Tf "$APP_ROOT/current.rollback" "$CURRENT"
    systemctl restart "$SERVICE" || true
  else
    systemctl stop "$SERVICE" || true
    rm -f "$CURRENT"
  fi
  exit 5
fi

rm -f "$ARTIFACT"
# Keep the five newest releases; never touch shared data.
find "$APP_ROOT/releases" -mindepth 1 -maxdepth 1 -type d ! -name '.staging-*' -printf '%T@ %p\n' |
  sort -nr | awk 'NR > 5 { $1=""; sub(/^ /,""); print }' |
  while IFS= read -r old; do [[ "$old" == "$RELEASE" ]] || rm -rf -- "$old"; done

echo "DEPLOY_OK $SHA"
