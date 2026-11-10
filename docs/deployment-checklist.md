# VPS deployment checklist

## Read-only discovery first

```bash
uname -m
cat /etc/os-release
node --version || true
caddy version
sudo systemctl status caddy --no-pager
sudo systemctl cat caddy
sudo caddy validate --config /etc/caddy/Caddyfile
sudo sed -n '1,240p' /etc/caddy/Caddyfile
sudo ss -lntp
```

Do not paste secrets, environment files, private keys, or tokens into chat.

## DNS

```bash
bash scripts/check-dns.sh nhkhuy.run.place
```

If root or wildcard DNS is absent, add records at the DNS provider:
- `@` A -> VPS public IPv4
- `*` A -> VPS public IPv4
- optionally matching AAAA only if IPv6 is configured and reachable

Do not add an AAAA record pointing somewhere that does not serve the VPS.

## Backup

```bash
sudo cp -a /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.bak.$(date +%Y%m%d%H%M%S)"
```

Also back up any imported Caddy snippets discovered during inspection.

## Acceptance

- [ ] Portal service active
- [ ] `curl -fsS http://127.0.0.1:4189/api/health`
- [ ] root HTTPS loads
- [ ] `/api/services` returns seeded services
- [ ] 9Router dashboard still works
- [ ] Wedding website still works
- [ ] Caddy config validates
- [ ] no public listener on 4189
