#!/usr/bin/env bash
set -euo pipefail

APP_ROOT=/opt/nhkhuy-portal
SERVICE_USER=nhkhuy-portal
DEPLOY_USER=rua
DEPLOY_HOME=/home/rua
ARTIFACT_DIR="$DEPLOY_HOME/nhkhuy-portal-artifacts"

if [[ $EUID -ne 0 ]]; then echo "Run with sudo."; exit 1; fi
command -v node >/dev/null
node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 20 ? 0 : 1)' || { echo "Node.js >=20 required."; exit 1; }
id "$DEPLOY_USER" >/dev/null 2>&1 || { echo "Expected VPS deploy user $DEPLOY_USER was not found."; exit 1; }

if ! id "$SERVICE_USER" >/dev/null 2>&1; then
  useradd --system --home-dir "$APP_ROOT" --shell /usr/sbin/nologin "$SERVICE_USER"
fi

# Keep the existing Git clone and its contents untouched. Only add runtime directories beside it.
install -d -o root -g root -m 0755 "$APP_ROOT"
install -d -o root -g "$SERVICE_USER" -m 0750 "$APP_ROOT/releases"
install -d -o root -g "$SERVICE_USER" -m 0750 "$APP_ROOT/shared"
install -d -o "$SERVICE_USER" -g "$SERVICE_USER" -m 0750 "$APP_ROOT/shared/data"
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 0750 "$ARTIFACT_DIR"
install -d -m 0700 /etc/nhkhuy-portal

if [[ ! -s /etc/nhkhuy-portal/portal.env ]]; then
  TOKEN="$(openssl rand -hex 32)"
  cat > /etc/nhkhuy-portal/portal.env <<EOF
ADMIN_TOKEN=$TOKEN
BASE_DOMAIN=nhkhuy.run.place
HOST=127.0.0.1
PORT=4189
EOF
  chmod 600 /etc/nhkhuy-portal/portal.env
else
  chmod 600 /etc/nhkhuy-portal/portal.env
fi

install -o root -g root -m 0644 "$APP_ROOT/deploy/nhkhuy-portal.service" /etc/systemd/system/nhkhuy-portal.service
install -o root -g root -m 0755 "$APP_ROOT/deploy/deploy-release.sh" /usr/local/sbin/deploy-nhkhuy-portal

SUDOERS_FILE=/etc/sudoers.d/nhkhuy-portal-deploy
printf '%s ALL=(root) NOPASSWD: /usr/local/sbin/deploy-nhkhuy-portal\n' "$DEPLOY_USER" > "$SUDOERS_FILE"
chmod 0440 "$SUDOERS_FILE"
visudo -cf "$SUDOERS_FILE"

systemctl daemon-reload
systemctl enable nhkhuy-portal.service
echo "Bootstrap ready. No application was started and Caddy was not changed."
echo "Next: set GitHub Environment variable CD_ENABLED=true only after reviewing the workflow."
