# Architecture decisions

## ADR-001: preserve current Caddy ownership

Existing routes are treated as external/legacy and are not rewritten until the live Caddyfile is inspected. New generated routes must live in a dedicated managed fragment imported by the root Caddyfile.

## ADR-002: registry is source of truth

Service metadata lives in a versioned JSON shape initially. A later migration to SQLite is straightforward once concurrent writes/audit history are needed.

## ADR-003: bind registry to loopback

The API binds to `127.0.0.1`; public access is through Caddy only. Admin endpoints require a bearer token. No Caddy Admin API exposure.

## ADR-004: staged provisioning

Registering metadata and activating a reverse-proxy route are separate operations in v0.1. v0.2 must:
1. Validate subdomain slug and reserved names.
2. Restrict upstream to loopback/private allowlist.
3. Write managed Caddy fragment atomically.
4. Run `caddy validate`.
5. Reload Caddy only if validation passes.
6. Restore previous fragment if reload fails.
7. Record audit event and provisioning state.
