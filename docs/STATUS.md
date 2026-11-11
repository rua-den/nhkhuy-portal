# Project status

_Last updated: 2026-11-11_

## Repository

- Main: `78a80a60b2b49ca44f04c3e7939d21ad9ef1fc12`
- Authentication: PR [#3](https://github.com/rua-den/nhkhuy-portal/pull/3) merged (squash)
- Working branch: `docs/portal-auth-status-after-auth-merge` (status synchronization)
- Production: https://nhkhuy.run.place

## Delivery status

| Area | Status | Evidence |
|---|---|---|
| Production deployment | Auth-enabled release deployed | GitHub Actions run [#42946588667](https://github.com/rua-den/nhkhuy-portal/actions/runs/42946588667) succeeded on main SHA `78a80a6` |
| Architecture ADR | Accepted | ADR-0001 |
| Repository/deploy inspection | Complete | Deployment scripts, systemd unit, CI reviewed |
| SQLite runtime | Verified | Node 22.23.2 built-in node:sqlite; x64 + ARM64 CI passed |
| Backend persistence | Implemented on main | SQLite schema, migrations, idempotent JSON import |
| Backend/auth | Merged; CI passed | Owner bootstrap, scrypt, opaque sessions, cookie, CSRF, IP-based throttling, audit events, protected service API |
| Frontend/admin | Basic static UI merged; Vue migration pending | Private owner-only portal, login page, authenticated admin console |
| CI | Passed on merged main commit | Unit/integration tests, HTTP smoke test, x64 + ARM64 SQLite runtime |
| Staging | Not started | No staging release/port/data directory created |
| Production private-route update | Pending PR #5 | Owner-only route/API gate and larger typography are implemented on feature branch; not yet deployed |

## Findings

- The v2 authentication implementation is merged and deployed to production. Owner account bootstrap/login verification is a separate operational step.
- Production data path is `/opt/nhkhuy-portal/shared/data`. Git's `config/services.json` is only a seed; production contents must be backed up and inspected before migration.
- The production deploy workflow now requires a manual dispatch on `main` and both `CD_ENABLED=true` and `PROD_CUTOVER_ENABLED=true`. Keep the latter unset/false until staging and rollback checks pass.
- Current deploy packaging and health checks still follow the v0.1 release contract; staging needs its own release, loopback port, and data directory.
- No production data, Caddy configuration, Wedding Online, or 9Router resources were changed.

## Next

1. Merge PR #5 after CI passes; then verify production login and owner-only access.
2. Confirm the owner account is bootstrapped in the production SQLite database.
3. Continue Vue 3 migration, account settings, and audit viewer separately.
