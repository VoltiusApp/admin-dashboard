# Voltius Admin Dashboard

Internal admin panel. Runs privately — access via Tailscale, not exposed to the internet.

## Environment variables

Copy `.env.example` to `.env.local` (local dev) or `.env` (Docker) and fill in:

| Variable | Description |
|---|---|
| `ADMIN_API_URL` | Base URL of the Voltius backend, no trailing slash (e.g. `http://voltius-server:8080`) |
| `ADMIN_SECRET` | Shared secret sent as `X-Admin-Key` — must match `ADMIN_SECRET` on the server |
| `ADMIN_EMAILS` | Comma-separated list of emails allowed to log in |
| `ADMIN_PASSWORD` | Single shared password for all admin emails |

## Local dev

```bash
cp .env.example .env.local
# fill in .env.local
pnpm install
pnpm dev
# open http://localhost:3000/admin/login
```

## Docker (Tailscale host)

```bash
cp .env.example .env
# fill in .env

docker compose up -d
# dashboard on http://<tailscale-ip>:3001/admin/login
```

The container binds to port `3001` on the host. Restrict access at the firewall level so only Tailscale traffic can reach it — do not expose port 3001 to the public internet.

### Updating

```bash
git pull
docker compose up -d --build
```
