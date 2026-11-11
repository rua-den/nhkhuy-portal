# Project status

_Last updated: 2026-11-11_

## Repository

- Main: `a385dbe7f2356933903c042e0376dc0a45f71338`
- Authentication: PR [#3](https://github.com/rua-den/nhkhuy-portal/pull/3) merged (squash)
- Working branch: `docs/portal-auth-status-after-auth-merge` (status synchronization)
- Production: https://nhkhuy.run.place

## Delivery status

| Area | Status | Evidence |
|---|---|---|
| v0.1 production baseline | Preserved; no auth cutover | Existing production release/data untouched |
| Architecture ADR | Accepted | ADR-0001 |
| Repository/deploy inspection | Complete | Deployment scripts, systemd unit, CI reviewed |
| SQLite runtime | Verified | Node 22.23.2 built-in node:sqlite; x64 + ARM64 CI passed |
| Backend persistence | Implemented on main | SQLite schema, migrations, idempotent JSON import |
| Backend/auth | Merged; CI passed | Owner bootstrap, scrypt, opaque sessions, cookie, CSRF, IP-based throttling, audit events, protected service API |
| Frontend/admin | Basic static UI merged; Vue migration pending | Private owner-only portal, login page, authenticated admin console |
| CI | Passed on merged main commit | Unit/integration tests, HTTP smoke test, x64 + ARM64 SQLite runtime |
| Staging | Not started | No staging release/port/data directory created |
| Production cutover | Not deployed | Production deploy job was skipped; explicit manual dispatch and cutover gate required |

## Findings

- The v2 auth implementation is merged but has not been deployed to staging or production.
- Production data path is `/opt/nhkhuy-portal/shared/data`. Git's `config/services.json` is only a seed; production contents must be backed up and inspected before migration.
- The production deploy workflow now requires a manual dispatch on `main` and both `CD_ENABLED=true` and `PROD_CUTOVER_ENABLED=true`. Keep the latter unset/false until staging and rollback checks pass.
- Current deploy packaging and health checks still follow the v0.1 release contract; staging needs its own release, loopback port, and data directory.
- No production data, Caddy configuration, Wedding Online, or 9Router resources were changed.

## Next

1. Prepare isolated ARM64 staging release, port, and data directory without touching production.
2. Verify migrations, login/bootstrap, cookies, CSRF, rate limiting, service APIs, restart persistence, and rollback.
3. Only after staging sign-off, schedule a controlled production cutover.
4. Continue Vue 3 migration, account settings, and audit viewer separately.
