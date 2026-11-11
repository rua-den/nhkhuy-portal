# NHKHUY Portal

Personal portal and initial service registry for `nhkhuy.run.place`.

## v0.1 scope

- Responsive terminal-style (TUI-inspired) web console.
- Private owner-only portal and service listing.
- SQLite service registry with a one-time, metadata-preserving JSON import.
- Single-owner login and session-protected admin console.
- systemd deployment template for Oracle Linux/Ubuntu ARM64.
- DNS diagnostic helper.

**Important:** v0.1 registers metadata but does not yet automatically activate new Caddy routes. The Caddy provisioner is a gated next milestone. This is intentional: the current VPS Caddyfile has not been inspected, so no existing route should be overwritten.

## Existing services seeded

- `9router.nhkhuy.run.place/dashboard`
- `congchuavahoangtu.nhkhuy.run.place`

They are listed as `managedProxy: false`; existing routing stays under current Caddy ownership.

## Architecture

Browser -> existing Caddy HTTPS -> portal on `127.0.0.1:4189`.
Authenticated owner -> `/` -> private portal -> `/api/services` -> SQLite service registry.
Owner -> `/login.html` -> opaque server-side session cookie -> authenticated `/api/admin/*` and `/tt-req/` HTTP workbench.

No Caddy Admin API is exposed. The service binds only to loopback.

## Requirements

- Linux ARM64 or x86_64
- Node.js 22.23.2
- Existing Caddy installation
- DNS A/AAAA for root domain to VPS
- For future automatic subdomains: wildcard `*.nhkhuy.run.place` record to VPS

## Local run

```bash
npm run check
PORTAL_COOKIE_SECURE=false node src/server.js
```

Open `http://127.0.0.1:4189/login.html`. All portal pages and service data require an owner session; only login assets and health/auth bootstrap endpoints are public. Create the owner account once with `npm run admin:bootstrap -- owner`, then sign in at `/login.html`. For local HTTP only, set `PORTAL_COOKIE_SECURE=false`; never disable Secure cookies in production.

On the VPS, bootstrap against the shared database as the service user (after a verified staging deployment): `sudo -u nhkhuy-portal env PORTAL_DATA_DIR=/opt/nhkhuy-portal/shared/data node /opt/nhkhuy-portal/current/src/cli/bootstrap-admin.js owner`. The password is entered interactively and is not placed in shell history.

The admin API requires an authenticated session cookie. State-changing requests also require the CSRF token returned by `/api/auth/me` in the `X-CSRF-Token` header. No bearer token is exposed to browser code.

## Private HTTP workbench (`/tt-req/`)

- Uses the existing owner session and CSRF token; no extra listener or port is opened.
- Request/job data is stored in `PORTAL_DATA_DIR/tt-req.json` with mode `0600`; do not commit runtime data or exported credentials.
- Supports one-off HTTP requests, cURL parsing, JSON job import with preview, multi-step scheduled jobs, assertions, response extraction, run history, and job controls.
- JSON import accepts a `jobs` array, skips invalid/unsupported entries, strips recognized credential headers/fields, and always imports jobs paused. Files are limited to 32 KiB and the 30-job capacity limit still applies. Review every preview before confirming; do not import secrets or automation for artificial engagement.
- Outbound destinations are limited to public HTTP(S) hosts on ports 80/443. DNS answers are checked and pinned for the request; loopback, private, link-local, reserved and metadata ranges are rejected. Redirects are not followed. Request bodies are capped at 32 KiB, responses at 1 MiB, at most four outbound requests run concurrently, and request timeout is 12 seconds.
- Scheduled intervals must be at least 60 seconds. Up to 30 jobs and 12 steps per job are supported. Run history is in memory and resets on process restart.
- ZIP-supplied job data is deliberately not imported: it contained embedded credentials. Create clean jobs after rotating any exposed credentials.

## Deployment outline

1. SSH to VPS and inspect OS/architecture, Node, Caddy, ports, current Caddyfile and systemd units.
2. Back up `/etc/caddy/Caddyfile` and Caddy data/config.
3. Verify root DNS and wildcard DNS using `scripts/check-dns.sh`.
4. Install Node.js 22.23.2 if needed.
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

- Production deployment runs automatically after a push to `main` (with `workflow_dispatch` on `main` as a manual fallback) and requires repository variables `CD_ENABLED=true` and `PROD_CUTOVER_ENABLED=true`, plus the prod environment secrets `VPS_HOST`, `VPS_USER`, `VPS_SSH_PRIVATE_KEY`, and `VPS_KNOWN_HOSTS`. Keep the latter variable unset/false until the merged release has passed staging verification and rollback checks.
- Never expose port 4189 publicly; Caddy should proxy to loopback.
- Keep `/etc/nhkhuy-portal/portal.env` mode 0600.
- Bootstrap one owner account interactively with `npm run admin:bootstrap -- owner`; there is no default account or public registration.
- Passwords use Node.js `crypto.scrypt` with a random salt. Opaque 256-bit session IDs and CSRF tokens are stored only as SHA-256 hashes. The session cookie is HttpOnly, Secure in production, SameSite=Lax and Path=/. All portal HTML and service APIs require a session; state changes require CSRF and same-origin validation. Login failures are generic and throttled.
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
