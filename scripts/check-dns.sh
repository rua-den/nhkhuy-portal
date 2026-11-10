#!/usr/bin/env bash
set -euo pipefail
DOMAIN="${1:-nhkhuy.run.place}"
echo "A/AAAA records for root:"
getent ahosts "$DOMAIN" || true
echo
echo "Wildcard test (random label):"
LABEL="dnscheck-$RANDOM.$DOMAIN"
getent ahosts "$LABEL" || echo "No wildcard answer observed. Check DNS provider for *.${DOMAIN} A/AAAA or CNAME."
echo
echo "Compare the returned address(es) with the VPS public IP."
