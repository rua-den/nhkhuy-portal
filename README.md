# NHKHUY Portal

Personal portal and initial service registry for `nhkhuy.run.place`.

## v0.1 scope

- Responsive terminal-style (TUI-inspired) web console.
- Public read-only service listing.
- Local JSON registry.
- Token-protected admin API to list, register, enable/disable services.
- systemd deployment template for Oracle Linux/Ubuntu ARM64.
- DNS diagnostic helper.

**Important:** v0.1 registers metadata but does not yet automatically activate new Caddy routes. The Caddy provisioner is a gated next milestone. This is intentional: the current VPS Caddyfile has not been inspected, so no existing route should be overwritten.

## Existing services seeded

- `9router.nhkhuy.run.place/dashboard`
- `congchuavahoangtu.nhkhuy.run.place`

They are listed as `managedProxy: false`; existing routing stays under current Caddy ownership.

## Architecture

Browser -> existing Caddy HTTPS -> portal on `127.0.0.1:4189`.
Portal -> `/api/services` -> SQLite service registry.
Owner -> `/login.html` -> opaque server-side session cookie -> authenticated `/api/admin/*`.

No Caddy Admin API is exposed. The service binds only to loopback.

## Requirements

- Linux ARM64 or x86_64
- Node.js 20+
- Existing Caddy installation
- DNS A/AAAA for root domain to VPS
- For future automatic subdomains: wildcard `*.nhkhuy.run.place` record to VPS

## Local run

```bash
npm run check
PORTAL_COOKIE_SECURE=false node src/server.js
```

Open `http://127.0.0.1:4189`. Create the owner account once with `npm run admin:bootstrap -- owner`, then sign in at `/login.html`. For local HTTP only, set `PORTAL_COOKIE_SECURE=false`; never disable Secure cookies in production.

Admin API example:

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://127.0.0.1:4189/api/admin/services
```

Register service:

```bash
curl -X POST http://127.0.0.1:4189/api/admin/services \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id":"demo","name":"Demo","port":4000,"description":"Example app","category":"Experiments"}'
```

## Deployment outline

1. SSH to VPS and inspect OS/architecture, Node, Caddy, ports, current Caddyfile and systemd units.
2. Back up `/etc/caddy/Caddyfile` and Caddy data/config.
3. Verify root DNS and wildcard DNS using `scripts/check-dns.sh`.
4. Install Node.js 20+ if needed.
5. Copy project to `/opt/nhkhuy-portal`; create service account.
6. Run `sudo deploy/configure-env.sh`.
7. Install `deploy/nhkhuy-portal.service` to `/etc/systemd/system/`, then `systemctl daemon-reload`, enable and start.
8. Verify `curl http://127.0.0.1:4189/api/health`.
9. Review existing Caddyfile. Add only the root site block from `deploy/Caddyfile.import.example` (or a safe import) without touching existing site blocks.
10. Run `caddy validate` before reload; reload only after successful validation.
11. Verify HTTPS root domain and existing 9Router/wedding routes.

## DNS

A wildcard DNS record is not assumed. Check with:

```bash
bash scripts/check-dns.sh nhkhuy.run.place
```

Expected:
- `nhkhuy.run.place` resolves to the VPS public IP.
- `*.nhkhuy.run.place` resolves to the same VPS IP (A/AAAA or suitable CNAME).

Wildcard DNS does not itself issue TLS certificates; Caddy obtains certificates for each hostname when configured and reachable.

## Security / limitations

- Never expose port 4189 publicly; Caddy should proxy to loopback.
- Keep `/etc/nhkhuy-portal/portal.env` mode 0600.
- Bootstrap one owner account interactively with `npm run admin:bootstrap -- owner`; there is no default account or public registration.
- Passwords use Node.js `crypto.scrypt` with a random salt. Opaque 256-bit session IDs and CSRF tokens are stored only as SHA-256 hashes. The session cookie is HttpOnly, Secure in production, SameSite=Lax and Path=/. Admin HTML and APIs require a session; state changes require CSRF and same-origin validation. Login failures are generic and throttled.
- Registration accepts only a local port, not arbitrary upstream URLs.
- New service metadata is not equivalent to a working reverse-proxy route yet.
- No DNS provider API credentials are stored by this app.
- No existing Caddy config is changed by the installer.

## Roadmap

- [ ] v0.1 portal + registry, safe read-only public UI
- [ ] VPS deployment and root hostname
- [ ] Confirm wildcard DNS
- [ ] v0.2 Caddy provisioner: generate managed fragment, validate, backup, reload, rollback
- [x] v0.3 owner authentication API, session security, CSRF, audit log, login/admin UI (feature branch; CI pending)
- [ ] v0.4 optional DNS provider integration and one-click service onboarding
