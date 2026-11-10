# Portal v2 implementation plan

## Goal

Replace the prototype experience with a real public portal + owner login + admin console while keeping the production v0.1 app available for rollback.

## Constraints / invariants

- Production VPS: ARM64, 1 vCPU, 5.8 GiB RAM, Node.js 22.23.2.
- Keep one app process; Vue is compiled to static files.
- Do not modify Wedding, 9Router, their data, processes, ports, or Caddy site blocks.
- Keep current v0.1 service on 127.0.0.1:4189 until v2 is verified.
- No production deployment from a feature branch. CI must test feature branches; production deploy remains gated to main.
- Do not expose secrets in GitHub Actions logs or browser storage.
- Preserve current public service URLs and service registry content.

## Delivery phases

### Phase 0 — Architecture and repository baseline
- [x] Record ADR-0001 for a lightweight Node/Vue/SQLite architecture.
- [ ] Add implementation plan and acceptance criteria.
- [ ] Inspect the complete deploy script and existing CI packaging contract before changing deployment.
- [ ] Confirm current production service registry schema and take a read-only backup plan.

### Phase 1 — Backend foundation
- [ ] Split API, configuration, persistence, auth, and static hosting into separate modules.
- [ ] Add SQLite schema/migrations for users, sessions, services, and audit events.
- [ ] Implement idempotent import from the existing services.json.
- [ ] Add one-time admin bootstrap; never create a default password.
- [ ] Implement login/logout/current-session endpoints.
- [ ] Use server-side opaque sessions and HttpOnly/Secure/SameSite cookies.
- [ ] Add CSRF validation, login throttling, generic auth errors, request limits, and security headers.
- [ ] Keep public service listing read-only and limited to enabled services.

### Phase 2 — Frontend
- [ ] Add Vue 3 + Vite frontend with the existing Control Deck visual direction.
- [ ] Public home: service registry and system status.
- [ ] Login page.
- [ ] Authenticated admin dashboard: list services, edit safe metadata, enable/disable.
- [ ] Account settings: change password and revoke sessions.
- [ ] Audit log view.
- [ ] Ensure no secrets/tokens are stored in browser storage.

### Phase 3 — Verification
- [ ] Unit tests for validation, password hashing, sessions, and authorization.
- [ ] Integration tests for login/logout, CSRF, rate limits, CRUD, and public data filtering.
- [ ] Dependency and production-build checks.
- [ ] Build and smoke-test a Linux ARM64 artifact; verify SQLite native dependency compatibility before selecting the final driver.
- [ ] Test migration against a copy of the current registry, including rollback.

### Phase 4 — Staging and cutover
- [ ] Deploy v2 to a separate loopback port and separate release directory.
- [ ] Use a separate staging data directory; never point staging at production data.
- [ ] Verify health, login, cookie flags, CSRF, service listing, admin CRUD, and restart persistence.
- [ ] Back up production data and current symlink.
- [ ] Cut over only the root-domain Caddy upstream after explicit verification; preserve Wedding and 9Router blocks byte-for-byte.
- [ ] Keep v0.1 release available for immediate rollback.

## Acceptance criteria

- Public root page works over HTTPS.
- Unauthenticated users can only see enabled public services.
- Admin pages and APIs reject unauthenticated requests.
- Login is rate-limited; session cookie is HttpOnly, Secure, and SameSite.
- State-changing authenticated requests require valid CSRF protection.
- Passwords are never stored or logged in plaintext.
- Service changes and sessions survive app restarts.
- No additional always-on service is introduced.
- Wedding and 9Router remain reachable and unchanged.
- A failed deployment automatically or manually rolls back to the current v0.1 release.

## Current status

Architecture is recorded in ADR-0001. Implementation has not started; the next code change follows after the deployment contract and ARM64 SQLite strategy are verified.
