# ADR-0001: Lightweight full-stack architecture for Portal v2

- Status: Accepted
- Date: 2026-11-10
- Decision owners: Portal maintainer

## Context

The production VPS is ARM64 (Neoverse-N1), has one vCPU and 5.8 GiB RAM, and already hosts Wedding, 9Router, Caddy, and the current Portal. The current Portal is a dependency-free Node.js HTTP server with a public directory and a token-protected admin API, but it has no browser login or proper admin experience.

Portal v2 needs a maintainable frontend/backend boundary and secure owner login without introducing a database daemon, container runtime, or additional always-on service.

## Decision

Keep one Node.js application process and use:

- **Frontend:** Vue 3 + Vite, compiled to static assets at CI time.
- **Backend:** Node.js 22 LTS in one HTTP/API process; avoid heavyweight frameworks.
- **Database:** SQLite through Node.js built-in `node:sqlite`; no native SQLite addon or database daemon.
- **Password hashing:** built-in `crypto.scrypt` with a unique random salt and explicit cost parameters.
- **Reverse proxy/TLS:** existing Caddy; do not alter Wedding or 9Router site blocks.
- **Deployment:** build/test in GitHub Actions; deploy to a separate release and port first. Preserve v0.1 on port 4189 as rollback.

## Authentication and security

- Single owner/admin account; no public registration.
- Server-side SQLite sessions; browser receives only a random opaque cookie.
- Cookie flags: HttpOnly, Secure in production, SameSite=Lax, narrow Path.
- No bearer token or password in localStorage/sessionStorage.
- Login rate limiting, generic authentication errors, CSRF protection, security headers, and audit events.
- First admin bootstrap is a one-time CLI/setup operation; never ship a default password.

## Data compatibility

- Existing `services.json` is the initial migration source.
- Migration must be repeatable/idempotent and preserve service metadata.
- Current JSON and production service remain untouched during staging.
- A verified backup is required before production data cutover.

## Consequences

Positive:
- One Node process and one local database file.
- No native addon compilation or platform-specific SQLite package in the release artifact.
- No paid service or additional always-on infrastructure.

Trade-offs:
- Node 22's `node:sqlite` API is experimental. The exact Node 22.23.2 runtime has passed the repository's x64 and ARM64 CI smoke test; production use still requires persistence/auth integration tests.
- SQLite suits this single-owner, low-write portal, not a high-concurrency multi-user product.
- Authentication, migration, and deployment need integration tests before cutover.

## Explicit non-goals

- Rewriting Wedding or 9Router.
- Replacing Caddy or changing existing site blocks.
- Docker/Kubernetes, Redis, PostgreSQL, microservices, or public registration.
- Automatic Caddy route provisioning in the first authentication release.
