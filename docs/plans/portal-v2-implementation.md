# NHKHUY Portal v2 — Implementation Plan

## Goal

Replace the v0.1 prototype with a maintainable .NET + Angular application featuring a public service directory and authenticated single-owner administration.

## Non-negotiable production constraints

- Keep v0.1 running until v2 is accepted.
- Use a separate systemd unit, loopback port, release root, environment file, and SQLite database for v2.
- Never edit the Wedding application, its data/uploads/.env, PM2 process, port 3000, or Caddy site block.
- Never edit the 9Router application, port 20128, or Caddy site block.
- Switch only the root portal host after acceptance; back up and validate Caddy before reload.
- Preserve the old release and registry JSON for rollback and migration verification.

## Target architecture

```
Browser
  └── Caddy HTTPS (root portal host only)
       └── ASP.NET Core host
            ├── Angular SPA
            ├── Authentication / Authorization
            ├── Public Services API
            ├── Admin Services API
            ├── Audit API
            └── EF Core
                 └── SQLite (persistent data directory)
```

### Backend

- .NET 10 LTS / ASP.NET Core Web API.
- EF Core SQLite migrations.
- Cookie authentication with HttpOnly, Secure, SameSite cookies.
- ASP.NET Core Identity password hashing; no plaintext password persistence.
- Admin-only policy; no public sign-up.
- One-time admin bootstrap flow.
- Antiforgery protection for state-changing cookie-authenticated requests.
- Login throttling/lockout and generic authentication error responses.
- DTO validation, bounded request bodies, safe error responses.
- Audit records for login success/failure and admin mutations (never passwords, cookies, or secrets).
- Health/readiness endpoint that does not disclose sensitive configuration.

### Frontend

- Angular + TypeScript.
- Public Home / Service Directory.
- Login page.
- Admin Dashboard.
- Service CRUD and enable/disable.
- Account security: change password and logout.
- Audit log view.
- Responsive design retaining the current dark terminal/control-deck visual identity, but with accessible forms and clear loading/error states.
- No authentication secrets in localStorage or sessionStorage.

## Milestones and acceptance gates

### M1 — Foundation
- [ ] Create solution and projects.
- [ ] Create Angular workspace and app shell.
- [ ] Add formatting, analyzers, environment configuration, and CI build.
- [ ] Add architecture and local development docs.
- Gate: clean checkout builds both projects; no production deployment.

### M2 — Backend identity and data
- [ ] Define Service, AdminUser, and AuditEvent entities.
- [ ] Add EF Core SQLite and initial migration.
- [ ] Implement one-time admin bootstrap.
- [ ] Implement login, logout, current-user, antiforgery, and admin authorization.
- [ ] Add login throttling and security headers.
- Gate: integration tests prove unauthenticated requests are denied and authenticated admin requests work.

### M3 — Service management
- [ ] Public read-only service listing.
- [ ] Admin list/create/update/enable/disable endpoints.
- [ ] Import v0.1 registry JSON into a new SQLite database without changing the source JSON.
- [ ] Audit all administrative mutations.
- Gate: API tests cover validation, authorization, duplicate IDs, and safe URL rules.

### M4 — Angular experience
- [ ] Recreate public Control Deck.
- [ ] Add login/logout.
- [ ] Add protected admin dashboard and service editor.
- [ ] Add password change and audit view.
- [ ] Add route guards for UX; backend authorization remains authoritative.
- Gate: browser-level smoke tests cover login, logout, session expiry, and admin CRUD.

### M5 — Production readiness
- [ ] CI builds/tests backend and frontend.
- [ ] Publish self-contained or framework-dependent Linux ARM64 artifact (choose based on VPS runtime verification).
- [ ] Add separate v2 deployment script/systemd unit and health-check rollback.
- [ ] Deploy to a separate loopback port and data directory.
- [ ] Verify restart persistence, file permissions, backup/restore, and rollback.
- Gate: no change to public Caddy routing yet.

### M6 — Cutover
- [ ] Back up existing Caddyfile.
- [ ] Switch only `nhkhuy.run.place` to the v2 loopback port.
- [ ] Validate and reload Caddy.
- [ ] Verify portal login and public pages.
- [ ] Verify 9Router and Wedding URLs remain healthy.
- [ ] Retain v0.1 service/release and documented rollback path.

## Initial v2 data model

- `Service`: Id, Name, Description, Url, Category, Icon, IsEnabled, SortOrder, CreatedAtUtc, UpdatedAtUtc.
- `AdminUser`: Id, Email, PasswordHash, IsActive, CreatedAtUtc, PasswordChangedAtUtc, FailedLoginCount, LockoutEndUtc.
- `AuditEvent`: Id, ActorUserId (nullable for failed login), EventType, TargetType, TargetId, OccurredAtUtc, RemoteAddress (privacy-minimized), MetadataJson (allowlisted fields only).

## Explicitly out of scope for initial v2

- Multi-tenant or public user registration.
- OAuth/social login.
- Automatic DNS provisioning.
- Automatic live Caddyfile editing or reverse-proxy activation.
- General-purpose remote command execution.
