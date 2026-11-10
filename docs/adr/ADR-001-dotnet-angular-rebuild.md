# ADR-001: Rebuild the portal as .NET + Angular

- Status: Accepted
- Date: 2026-11-10
- Decision owners: Portal maintainer

## Context

The v0.1 portal is a small Node.js HTTP server with static HTML/JavaScript and a JSON service registry. It is deployed on the production VPS at `127.0.0.1:4189`, behind Caddy at `https://nhkhuy.run.place`.

The portal now needs a real authentication experience and a maintainable backend/frontend separation. The current production deployment must remain available throughout the rebuild.

## Decision

Build v2 as a modular full-stack application:

- Backend: ASP.NET Core Web API on .NET 10 LTS.
- Frontend: Angular + TypeScript, built as static assets and served by the ASP.NET Core host initially.
- Persistence: SQLite with EF Core migrations.
- Authentication: server-side cookie authentication; cookies are HttpOnly, Secure in production, and SameSite=Lax (or stricter where compatible). Do not store bearer credentials in browser localStorage/sessionStorage.
- Authorization: explicit Admin policy. No public registration.
- Initial account: provision one administrator through a one-time, documented bootstrap flow; never commit credentials or place a permanent plaintext password in appsettings.
- Security: antiforgery protection for cookie-authenticated state-changing requests, login throttling/lockout, password hashing using ASP.NET Core Identity password hasher, security headers, strict input validation, and audit events for administrative actions.
- Runtime: independent systemd service and loopback port during migration. Keep v0.1 running until v2 passes acceptance checks.

## Boundaries

- The portal is a service directory and management UI. It does not own Wedding or 9Router application data.
- It must not modify the Wedding repository, PM2 process, port 3000, or Wedding Caddy site block.
- It must not modify the 9Router service or its Caddy site block.
- New service registration in v2 must not silently edit the live Caddyfile. Proxy provisioning remains a separately gated feature requiring backup, validation, and rollback.
- SQLite data and key material live outside immutable release directories with restrictive filesystem permissions.

## Deployment strategy

1. Build and test v2 in CI for Linux ARM64.
2. Deploy v2 side-by-side on a separate loopback port and separate data directory.
3. Verify health, migrations, login, logout, authorization, antiforgery, and admin CRUD.
4. Back up the Caddyfile and switch only the root portal site to v2.
5. Keep the v0.1 release, data, service unit, and rollback instructions available until the new deployment is proven stable.

## Consequences

- More maintainable separation and stronger authentication boundaries.
- More moving parts than the v0.1 single-file server.
- .NET runtime and Angular build become part of CI/CD.
- Existing v0.1 JSON registry requires an explicit, tested import into SQLite; it must never be overwritten or deleted during migration.
