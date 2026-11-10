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
- [x] Verify built-in Node 22.23.2 SQLite on Linux x64 and ARM64 CI runners.

### Phase 1 — Backend foundation
- [x] Add the first persistence module boundary (database + migration CLI); API/auth/static split remains.
- [x] Add initial SQLite schema/migration for users, sessions, services, and audit events.
- [x] Add idempotent legacy JSON importer with source fingerprint and metadata preservation.
- [x] Add one-time interactive admin bootstrap; no default password.
- [x] Implement login/logout/current-session endpoints.
- [x] Use opaque server-side sessions and HttpOnly/Secure/SameSite cookies.
- [x] Add CSRF, login throttling, generic auth errors, request limits, and security headers.
- [x] Keep public service listing read-only and limited to enabled services.

### Phase 2 — Frontend
- [ ] Add Vue 3 + Vite using the existing Control Deck visual direction.
- [x] Public home, owner login, and authenticated basic admin dashboard (static JS).
- [ ] Vue migration, account settings, and audit log viewer.
- [ ] No secrets/tokens in browser storage.

### Phase 3 — Verification
- [ ] Unit tests for password hashing, owner bootstrap, sessions, throttling, and authorization (implemented; CI pending).
- [ ] HTTP integration tests for login/logout, CSRF, admin access control, and registry updates (implemented; CI pending).
- [ ] Dependency and production-build checks.
- [x] Verify built-in SQLite on Linux x64 and ARM64 CI runners; production adoption still requires end-to-end tests.
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

Phase 0 repository inspection and SQLite x64/ARM64 runtime verification are complete. The backend persistence slice and authentication API are implemented on the authentication feature branch; CI verification and Vue migration remain next. The deploy script expects the v0.1 file layout and health-checks port 4189; v2 packaging and health-check changes must be coordinated. The checked-in registry has two legacy definitions, but production data has not been read or modified. Phase 1 is in progress: initial persistence schema, migration runner, and legacy registry importer are implemented and covered by CI tests.
