# Project status

_Last updated: 2026-11-11_

## Repository

- Main: `52ff549ac0bcb712532040fc5e59419e6533e930`
- Authentication: PR [#3](https://github.com/rua-den/nhkhuy-portal/pull/3) merged.
- Private owner-only route/UI: PR [#5](https://github.com/rua-den/nhkhuy-portal/pull/5) merged.
- Private HTTP workbench: PR [#7](https://github.com/rua-den/nhkhuy-portal/pull/7) merged.
- TT-REQ JSON import: PR [#9](https://github.com/rua-den/nhkhuy-portal/pull/9) merged; preview, validation, credential scrubbing, unsupported-workflow filtering, paused-by-default import.
- Production: https://nhkhuy.run.place

## Delivery status

| Area | Status | Evidence |
|---|---|---|
| Production deployment | Existing auth-enabled release remains deployed; TT-REQ not deployed | Successful production workflow [#42948430100](https://github.com/rua-den/nhkhuy-portal/actions/runs/42948430100) deployed main SHA `5037ce4`; PR #7 merge is newer |
| Architecture ADR | Accepted | ADR-0001 |
| SQLite runtime | Verified | Node 22 built-in SQLite; x64 + ARM64 CI |
| Backend persistence | Implemented on main | SQLite schema, migrations, idempotent legacy JSON import |
| Backend/auth | Merged and deployed | Owner bootstrap, scrypt, opaque sessions, secure cookie, CSRF, login throttling, audit events |
| Private portal UI | Merged | Owner-only dashboard and admin console |
| Private HTTP workbench + JSON import | Merged; production deployment pending | PRs #7 and #9; owner/CSRF-protected `/tt-req/`, JSON preview/import, credential scrubbing, paused-by-default jobs; CI run [#42958046614](https://github.com/rua-den/nhkhuy-portal/actions/runs/42958046614) green on x64 + ARM64 |
| SSRF protections | Implemented and CI-verified | Public DNS/IP validation with pinned lookup, private/reserved IPv4/IPv6 rejection, HTTP(S) standard ports, no redirects, bounded requests/responses |
| CI | Passed for PR #9 | Run [#42958046614](https://github.com/rua-den/nhkhuy-portal/actions/runs/42958046614); syntax, 14 tests, HTTP smoke, x64 + ARM64 runtime green |
| Staging | Not started | No isolated staging release, port, or data directory has been created |

## Findings

- PR #7 adds the workbench to the existing Portal process; it does not open a new listener or change Caddy.
- Runtime job definitions are stored in `PORTAL_DATA_DIR/tt-req.json` with mode `0600`. They are not committed to Git.
- The uploaded ZIP's job data was not imported because it contained embedded credentials. Rotate/revoke any credentials exposed in that archive before creating clean jobs.
- Production is still on the pre-workbench release at main SHA `5037ce4`. The post-merge `Deploy Portal` push run completed its preflight successfully but skipped the deploy job by design; production has not been changed by PR #7.
- Production deployment requires the manual workflow dispatch and both `CD_ENABLED=true` and `PROD_CUTOVER_ENABLED=true`. Do not dispatch until a separate staging release and rollback have been verified.
- No production data, Caddy configuration, Wedding Online, or 9Router resources were changed for this feature.

## Next

1. Create an isolated staging release with a separate loopback port and data directory; inspect the current deploy script and preserve production data.
2. Verify ARM64 runtime, owner login, CSRF, workbench APIs, outbound SSRF controls, job persistence, resource usage, and rollback on staging.
3. Only after staging passes, manually dispatch the production workflow on `main`, then verify `/tt-req/` and rollback readiness.
