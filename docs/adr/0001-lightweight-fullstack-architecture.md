# ADR-0001: Lightweight full-stack architecture for Portal v2

- Status: Accepted
- Date: 2026-11-10
- Decision owners: Portal maintainer

## Context

The production VPS is ARM64 (Neoverse-N1), has one vCPU and 5.8 GiB RAM, and already hosts the Wedding application, 9Router, Caddy, and the current Portal. The current Portal is a dependency-free Node.js HTTP server with a public directory and a token-protected admin API, but it has no browser login or proper admin experience.

Portal v2 needs a maintainable frontend/backend boundary and secure owner login without introducing a database daemon, container runtime, or additional always-on service.

## Decision

Keep one Node.js application process and use:

- **Frontend:** Vue 3 + Vite. Build at CI time into static assets; do not run a separate frontend server in production.
- **Backend:** Node.js 22 LTS. Keep the HTTP/API process in one service. Prefer a small routing layer (Fastify) only if its operational value justifies the dependency; avoid heavyweight frameworks.
- **Database:** SQLite in a single persistent file under the existing shared data directory. No PostgreSQL/MySQL/Redis service.
- **Reverse proxy/TLS:** Keep the existing Caddy instance and root-domain route. Do not alter the Wedding or 9Router Caddy blocks.
- **Deployment:** Build/test in GitHub Actions; deploy to a separate release and port first. Preserve the existing Node v0.1 release and port 4189 as rollback until v2 passes smoke/security checks.

## Authentication and security

- Single owner/admin account; no public registration.
- Passwords are stored using a modern password hash (Argon2id where an ARM64-compatible deployment artifact is available, otherwise Node's built-in scrypt with per-user salt and calibrated parameters).
- Server-side sessions stored in SQLite; browser receives only a random opaque cookie.
- Cookie flags: HttpOnly, Secure in production, SameSite=Lax, narrow Path.
- No bearer token or password in localStorage/sessionStorage.
- Login rate limiting, generic authentication errors, CSRF protection for state-changing cookie-authenticated requests, security headers, and audit events.
- First admin bootstrap must be a one-time CLI/setup operation or a short-lived setup secret; never ship a default password.

## Data compatibility

- Existing `services.json` remains the source for the initial migration.
- Migration must be repeatable/idempotent and must preserve all current service metadata.
- The current JSON file and current production service remain untouched during staging.
- A verified backup is required before any production data cutover.

## Consequences

Positive:
- One long-lived Node process and one local database file.
- Static frontend assets have no runtime process.
- No paid service or recurring infrastructure cost.
- Existing Node.js 22 installation is reused.

Trade-offs:
- SQLite is appropriate for this single-owner, low-write portal, not a high-concurrency multi-user product.
- Native SQLite bindings must be built/tested for Linux ARM64; CI must not accidentally package x64 native modules.
- Authentication, migration, and deployment need careful integration tests before production cutover.

## Explicit non-goals

- Rewriting Wedding or 9Router.
- Replacing Caddy or changing its existing site blocks.
- Docker/Kubernetes, Redis, PostgreSQL, microservices, or public account registration.
- Automatic Caddy route provisioning in the first authentication release.
