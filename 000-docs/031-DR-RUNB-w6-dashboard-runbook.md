# 031 DR-RUNB: W6 Dashboard & CLI Runbook

## Start the Dashboard

```bash
# From repo root
pnpm dev:dashboard            # starts on :3100

# Or directly
pnpm --filter @irsb-watchtower/watchtower-api dev
```

Requires a seeded database. See W1 runbook for `wt init-db` + `wt upsert-agent`.

## Route Table

### HTML Dashboard

| Route | Description |
|-------|-------------|
| `GET /` | Agent overview table (filterable) |
| `GET /agent/:agentId` | Agent detail: risk, evidence, alerts |
| `GET /transparency` | 7-day transparency log status |

### JSON API

| Route | Description |
|-------|-------------|
| `GET /v1/agents` | All agents with risk enrichment |
| `GET /v1/agents/:agentId/risk` | Latest risk report |
| `GET /v1/agents/:agentId/alerts` | Agent alerts |
| `GET /v1/transparency/status` | 7-day verification summary |
| `GET /v1/transparency/leaves?date=YYYY-MM-DD` | Leaves for a date |
| `GET /v1/transparency/verify?date=YYYY-MM-DD` | Verify a date's log |

## curl Examples

```bash
# Agent list (JSON)
curl -s http://localhost:3100/v1/agents | jq

# Transparency status
curl -s http://localhost:3100/v1/transparency/status | jq

# Agent risk report
curl -s http://localhost:3100/v1/agents/agent-1/risk | jq

# HTML dashboard (open in browser)
open http://localhost:3100/
```

## CLI Examples

```bash
# List agents (pretty)
wt agents:list

# List agents (JSON, pipe to jq)
wt agents:list --json | jq '.[].agentId'

# Limit results
wt agents:list --limit 10

# Transparency tail (today)
wt transparency:tail

# Transparency tail (specific date, last 20)
wt transparency:tail --date 2025-01-15 --n 20

# Transparency tail as JSON
wt transparency:tail --json | jq

# Risk report as JSON
wt risk-report agent-1 --json | jq

# Alerts as JSON
wt list-alerts --agentId agent-1 --json | jq
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WATCHTOWER_API_PORT` | `3100` | API + dashboard port |
| `WATCHTOWER_API_HOST` | `127.0.0.1` | Bind address |
| `WATCHTOWER_DB_PATH` | `./data/watchtower.db` | SQLite database |
| `WATCHTOWER_KEY_PATH` | `./data/watchtower-key.json` | Signing keypair |
| `WATCHTOWER_LOG_DIR` | `./data/transparency` | Transparency log dir |
| `WATCHTOWER_API_KEY` | _(unset)_ | Optional API key for /v1/* |

## Troubleshooting

**Dashboard shows "No agents registered yet"**
- Seed the DB: `wt init-db && wt upsert-agent --agentId my-agent`

**Transparency page shows "No signing key configured"**
- Generate a key: `wt keygen`
- Or start server with valid `WATCHTOWER_KEY_PATH`

**Static assets 404**
- Ensure `public/` directory exists alongside `dist/` in watchtower-api
- The `@fastify/static` plugin serves from `../public` relative to `dist/`
