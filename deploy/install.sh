#!/usr/bin/env bash
set -euo pipefail
# Review before running. This installs the portal account and directory only.
# It does NOT edit Caddy, firewall rules, or any other application.
APP_DIR=/opt/nhkhuy-portal
SERVICE_USER=nhkhuy-portal

if [[ $EUID -ne 0 ]]; then
  echo "Run with sudo."
  exit 1
fi

if ! command -v node >/dev/null || ! node -e 'process.exit(Number(process.versions.node.split(".")[0])>=20?0:1)'; then
  echo "Node.js >=20 is required. Install Node.js 20+ first."
  exit 1
fi

if ! id "$SERVICE_USER" >/dev/null 2>&1; then
  useradd --system --home-dir "$APP_DIR" --shell /usr/sbin/nologin "$SERVICE_USER"
fi

install -d -o "$SERVICE_USER" -g "$SERVICE_USER" -m 0750 "$APP_DIR"
install -d -o "$SERVICE_USER" -g "$SERVICE_USER" -m 0750 "$APP_DIR/data"

echo "Portal account and directories are ready."
echo "Copy/clone the repository contents into $APP_DIR, then run deploy/configure-env.sh."
echo "This script deliberately does not alter your existing Caddyfile or firewall."
