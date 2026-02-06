# 030 PR-ADDM: W6 Operator UI — Dashboard & CLI

## Summary

W6 adds a minimal server-rendered HTML dashboard and CLI improvements so an
operator can see agents, risk reports, alerts, and transparency log status at a
glance. No frontend package or bundler — HTML is generated from TypeScript
template literals in the existing `watchtower-api` package.

## Approach

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Rendering | Server-side HTML (template literals) | Lowest maintenance, no bundler |
| CSS | PicoCSS v2 via CDN + custom badges | Classless styling, professional look |
| Interactivity | Vanilla JS (`app.js`) | Only need agent table filtering |
| New package? | No | Extends `watchtower-api` |

## Dashboard Routes

| Route | Type | Description |
|-------|------|-------------|
| `GET /` | HTML | Agent overview table with search filter |
| `GET /agent/:agentId` | HTML | Agent detail: risk report, evidence, alerts |
| `GET /transparency` | HTML | 7-day log verification status |

## API Additions

| Route | Type | Description |
|-------|------|-------------|
| `GET /v1/agents` | JSON | List all agents with risk enrichment |
| `GET /v1/transparency/status` | JSON | 7-day verification summary |

## CLI Additions

| Command | Description |
|---------|-------------|
| `wt agents:list [--limit N] [--json]` | List agents with risk scores |
| `wt transparency:tail [--date] [--n] [--json]` | Show last N transparency leaves |
| `wt risk-report <agentId> --json` | JSON output for risk report |
| `wt list-alerts --json` | JSON output for alerts |

## Data Flow

```
Browser → GET / → uiRoutes (server.ts)
                    ↓
         listAgents(db) → getLatestRiskReport(db, agentId)
                        → listAlerts(db, { agentId, activeOnly: true })
                    ↓
         layout() + escapeHtml() → HTML response

Browser → GET /transparency → uiRoutes
                    ↓
         7 × (logFilePath → verifyLogFile) → HTML table
```

## Security

- All user-derived strings pass through `escapeHtml()` (XSS prevention)
- API key auth applies to `/v1/*` routes only (dashboard is read-only)
- No state mutations from dashboard routes

## Files Changed

- `packages/watchtower-api/src/routes/ui.ts` (new)
- `packages/watchtower-api/public/style.css` (new)
- `packages/watchtower-api/public/app.js` (new)
- `packages/watchtower-api/src/server.ts` (register static + UI)
- `packages/watchtower-api/src/routes/agents.ts` (add GET /v1/agents)
- `packages/watchtower-api/src/routes/transparency.ts` (add GET /v1/transparency/status)
- `packages/watchtower-api/package.json` (add @fastify/static)
- `packages/watchtower-api/test/api.test.ts` (6 new tests)
- `packages/watchtower-cli/src/cli.ts` (2 new commands + --json flags)
- `package.json` (root: dev:dashboard script)
