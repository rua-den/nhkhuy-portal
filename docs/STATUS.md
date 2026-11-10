# Project status

_Last updated: 2026-11-10_

## Repository

- Main: `f9abb6fe44997c7f8189c35f71063b49ae722148`
- Working branch: `feat/portal-authentication`
- PR: [#3](https://github.com/rua-den/nhkhuy-portal/pull/3) (ready for review; CI pending)
- Production: https://nhkhuy.run.place

## Delivery status

| Area | Status | Evidence |
|---|---|---|
| v0.1 production baseline | Running before v2 work | User-verified systemd health |
| Architecture ADR | Accepted | ADR-0001 |
| Repository/deploy inspection | Complete | deploy-release.sh, bootstrap.sh, systemd unit, CI |
| SQLite runtime choice | Verified in CI | Node 22.23.2 built-in node:sqlite; x64 + ARM64 CI passed |
| Backend persistence | First slice implemented | SQLite schema, migrations, JSON import, tests |
| Backend/auth | Implemented on feature branch; CI pending | Owner bootstrap, scrypt, opaque sessions, cookie, CSRF, throttling, audit events, authenticated service API |
| Frontend/admin | Basic static login and owner console implemented; Vue migration pending | login.html/login.js and protected admin.html/admin.js |
| Staging | Not started | No staging service/data/port created |
| Production cutover | Not started | v0.1 remains rollback target |

## Findings

- Current deployment expects the v0.1 file layout and health-checks port 4189. V2 packaging and health-check changes must be coordinated.
- Deployment switches a release symlink and rolls back on failed health checks; it does not provide a v2 staging port.
- Production data path is `/opt/nhkhuy-portal/shared/data`. Git's `config/services.json` is only the seed, not proof of production contents.
- systemd runs as `nhkhuy-portal` with `ProtectSystem=strict`; persistent writes must stay under shared data.
- No Caddy or other application configuration has been changed.

## Next

1. Verify CI and review any test failures.
2. Build the Vue admin UI, account settings, and audit viewer.
3. Update release packaging and staging only after the backend contracts are stable.

