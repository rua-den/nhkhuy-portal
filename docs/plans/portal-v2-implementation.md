# Portal v2 implementation plan

## Goal

Replace the prototype with a public portal, owner login, and admin console while keeping production v0.1 available for rollback.

## Constraints

- VPS: ARM64, 1 vCPU, 5.8 GiB RAM, Node.js 22.23.2.
- One app process; Vue compiles to static files.
- Never modify Wedding, 9Router, their data/processes/ports, or their Caddy blocks.
- Keep v0.1 on 127.0.0.1:4189 until v2 is verified.
- Feature branches run CI; production deployment remains main-only.
- Never expose secrets or store auth tokens in browser storage.
- Preserve public service URLs and registry metadata.
- Avoid native SQLite addons unless target-OS ARM64 packaging is proven.

## Delivery phases

### Phase 0 — Architecture and repository baseline
- [x] Record ADR-0001.
- [x] Add implementation plan and acceptance criteria.
- [x] Inspect deploy-release.sh, bootstrap.sh, systemd unit, and CI packaging contract.
- [x] Confirm checked-in registry schema and production data path; production data itself remains uninspected and must not be assumed to match Git.
- [x] Select built-in Node 22 SQLite as candidate; ARM64 runtime verification remains a CI gate.

### Phase 1 — Backend foundation
- [ ] Split API, configuration, persistence, auth, and static hosting.
- [ ] Add SQLite schema/migrations for users, sessions, services, and audit events.
- [ ] Idempotently import existing services.json.
- [ ] Add one-time admin bootstrap; no default password.
- [ ] Implement login/logout/current-session endpoints.
- [ ] Use opaque server-side sessions and HttpOnly/Secure/SameSite cookies.
- [ ] Add CSRF, login throttling, generic auth errors, request limits, and security headers.
- [ ] Keep public service listing read-only and limited to enabled services.

### Phase 2 — Frontend
- [ ] Add Vue 3 + Vite using the existing Control Deck visual direction.
- [ ] Public home, login, authenticated admin dashboard, account settings, audit log.
- [ ] No secrets/tokens in browser storage.

### Phase 3 — Verification
- [ ] Unit tests for validation, password hashing, sessions, and authorization.
- [ ] Integration tests for login/logout, CSRF, rate limits, CRUD, and public filtering.
- [ ] Dependency and production-build checks.
- [ ] Verify built-in SQLite on Linux x64 and ARM64 before production adoption.
- [ ] Test migration against a copy of the registry, including rollback.

### Phase 4 — Staging and cutover
- [ ] Separate staging release, loopback port, and data directory.
- [ ] Verify health, login, cookie flags, CSRF, service listing, admin CRUD, and restart persistence.
- [ ] Back up production data and current symlink.
- [ ] Cut over only root-domain Caddy upstream; preserve Wedding and 9Router blocks byte-for-byte.
- [ ] Keep v0.1 release for immediate rollback.

## Acceptance criteria

- Public root page works over HTTPS.
- Unauthenticated users see only enabled public services.
- Admin pages and APIs reject unauthenticated requests.
- Login is rate-limited; session cookie is HttpOnly, Secure, and SameSite.
- State-changing authenticated requests require CSRF.
- Passwords are never stored/logged in plaintext.
- Service changes and sessions survive restarts.
- No extra always-on service.
- Wedding and 9Router remain reachable and unchanged.
- Failed deployment rolls back to v0.1.

## Current status

Phase 0 repository inspection is complete. The deploy script expects the v0.1 file layout and health-checks port 4189; v2 packaging and health-check changes must be coordinated. The checked-in registry has two legacy definitions, but production data has not been read or modified. Phase 1 has not started.
