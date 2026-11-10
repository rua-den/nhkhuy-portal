#!/usr/bin/env bash
set -euo pipefail
if [[ $EUID -ne 0 ]]; then echo "Run with sudo."; exit 1; fi
install -d -m 700 /etc/nhkhuy-portal
TOKEN="$(openssl rand -hex 32)"
cat > /etc/nhkhuy-portal/portal.env <<EOF
ADMIN_TOKEN=$TOKEN
BASE_DOMAIN=nhkhuy.run.place
HOST=127.0.0.1
PORT=4180
EOF
chmod 600 /etc/nhkhuy-portal/portal.env
echo "Admin token saved in /etc/nhkhuy-portal/portal.env (keep it secret)."
