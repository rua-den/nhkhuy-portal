# Project status

_Last updated: 2026-11-10_

## Repository

- Main: `38454bce19fcf148c2744c76444c759a1fe6f3e5`
- Working branch: `feat/portal-v2-foundation`
- Draft PR: [#1](https://github.com/rua-den/nhkhuy-portal/pull/1)
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
| Frontend/admin | Not started | Existing public static UI remains v0.1 |
| Staging | Not started | No staging service/data/port created |
| Production cutover | Not started | v0.1 remains rollback target |

## Findings

- Current deployment expects the v0.1 file layout and health-checks port 4189. V2 packaging and health-check changes must be coordinated.
- Deployment switches a release symlink and rolls back on failed health checks; it does not provide a v2 staging port.
- Production data path is `/opt/nhkhuy-portal/shared/data`. Git's `config/services.json` is only the seed, not proof of production contents.
- systemd runs as `nhkhuy-portal` with `ProtectSystem=strict`; persistent writes must stay under shared data.
- No Caddy or other application configuration has been changed.

## Next

1. Run auth/API integration tests and complete login UI.
2. Add API integration tests and then build the Vue admin UI.
3. Update release packaging and staging only after the backend contracts are stable.

