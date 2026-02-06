import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import {
  listAgents,
  getAgent,
  getLatestRiskReport,
  listAlerts,
  verifyLogFile,
  logFilePath,
} from '@irsb-watchtower/watchtower-core';

// ── XSS helper ──────────────────────────────────────────────────────────
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Layout ──────────────────────────────────────────────────────────────
function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} — Watchtower</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css">
  <link rel="stylesheet" href="/public/style.css">
</head>
<body>
  <header class="container">
    <nav>
      <ul>
        <li><a href="/" class="brand">Watchtower</a></li>
      </ul>
      <ul>
        <li><a href="/">Agents</a></li>
        <li><a href="/transparency">Transparency</a></li>
      </ul>
    </nav>
  </header>
  <main class="container">
    ${body}
  </main>
  <script src="/public/app.js"></script>
</body>
</html>`;
}

// ── Badge helpers ────────────────────────────────────────────────────────
function riskBadge(risk: number | null): string {
  if (risk === null) return '<span class="risk-none">N/A</span>';
  if (risk >= 80) return `<span class="risk-critical">${risk}/100</span>`;
  if (risk >= 50) return `<span class="risk-high">${risk}/100</span>`;
  if (risk >= 20) return `<span class="risk-medium">${risk}/100</span>`;
  if (risk > 0) return `<span class="risk-low">${risk}/100</span>`;
  return `<span class="risk-none">${risk}/100</span>`;
}

function severityBadge(severity: string): string {
  const s = severity.toLowerCase();
  return `<span class="severity-${s}">${escapeHtml(severity)}</span>`;
}

function formatTs(epoch: number): string {
  return new Date(epoch * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

// ── Routes ──────────────────────────────────────────────────────────────
export async function uiRoutes(
  fastify: FastifyInstance,
  opts: { db: Database.Database; logDir: string; publicKey?: string },
): Promise<void> {
  const { db, logDir, publicKey } = opts;

  // ── Home / Agent Overview ─────────────────────────────────────────────
  fastify.get('/', async (_request, reply) => {
    const agents = listAgents(db);
    const rows = agents.map((agent) => {
      const report = getLatestRiskReport(db, agent.agentId);
      const activeAlerts = listAlerts(db, { agentId: agent.agentId, activeOnly: true });
      const risk = report?.overallRisk ?? null;
      const confidence = report?.confidence ?? 'N/A';
      const lastUpdated = report?.generatedAt ?? agent.createdAt ?? 0;
      return `<tr>
        <td><a href="/agent/${encodeURIComponent(agent.agentId)}">${escapeHtml(agent.agentId)}</a></td>
        <td>${riskBadge(risk)}</td>
        <td>${escapeHtml(String(confidence))}</td>
        <td>${escapeHtml(agent.status ?? 'ACTIVE')}</td>
        <td>${activeAlerts.length}</td>
        <td class="muted">${formatTs(lastUpdated)}</td>
      </tr>`;
    });

    const body = `
    <h2>Agent Overview</h2>
    <input type="search" id="agent-search" placeholder="Filter agents..." oninput="filterAgents()">
    <table id="agent-table" role="grid">
      <thead>
        <tr>
          <th>Agent ID</th>
          <th>Risk</th>
          <th>Confidence</th>
          <th>Status</th>
          <th>Active Alerts</th>
          <th>Last Updated</th>
        </tr>
      </thead>
      <tbody>
        ${rows.join('\n        ')}
      </tbody>
    </table>
    ${agents.length === 0 ? '<p class="muted">No agents registered yet.</p>' : ''}`;

    return reply.type('text/html').send(layout('Agents', body));
  });

  // ── Agent Detail ──────────────────────────────────────────────────────
  fastify.get<{ Params: { agentId: string } }>('/agent/:agentId', async (request, reply) => {
    const { agentId } = request.params;
    const agent = getAgent(db, agentId);
    if (!agent) {
      return reply.status(404).type('text/html').send(
        layout('Not Found', `<h2>Agent Not Found</h2><p>No agent with ID <code>${escapeHtml(agentId)}</code></p>`),
      );
    }

    const report = getLatestRiskReport(db, agentId);
    const alerts = listAlerts(db, { agentId });

    let reportSection = '<p class="muted">No risk report available.</p>';
    if (report) {
      const evidenceRows = report.evidenceLinks
        .map((ev) => `<tr><td>${escapeHtml(ev.type)}</td><td class="mono">${escapeHtml(ev.ref)}</td></tr>`)
        .join('\n');

      reportSection = `
      <h3>Risk Report</h3>
      <table>
        <tbody>
          <tr><td>Overall Risk</td><td>${riskBadge(report.overallRisk)}</td></tr>
          <tr><td>Confidence</td><td>${escapeHtml(String(report.confidence))}</td></tr>
          <tr><td>Generated</td><td>${formatTs(report.generatedAt)}</td></tr>
          <tr><td>Report ID</td><td class="mono">${escapeHtml(report.reportId)}</td></tr>
        </tbody>
      </table>
      ${report.evidenceLinks.length > 0 ? `
      <h4>Evidence Links</h4>
      <table>
        <thead><tr><th>Type</th><th>Ref</th></tr></thead>
        <tbody>${evidenceRows}</tbody>
      </table>` : ''}
      <details>
        <summary>Full Report JSON</summary>
        <pre class="json">${escapeHtml(JSON.stringify(report, null, 2))}</pre>
      </details>`;
    }

    const alertRows = alerts
      .map(
        (a) => `<tr>
        <td>${severityBadge(a.severity)}</td>
        <td>${escapeHtml(a.type)}</td>
        <td>${escapeHtml(a.description)}</td>
        <td>${a.isActive ? '<span class="status-active">ACTIVE</span>' : '<span class="status-resolved">RESOLVED</span>'}</td>
        <td class="muted">${formatTs(a.createdAt)}</td>
      </tr>`,
      )
      .join('\n');

    const alertsSection =
      alerts.length > 0
        ? `<h3>Alerts</h3>
      <table>
        <thead><tr><th>Severity</th><th>Type</th><th>Description</th><th>Status</th><th>Created</th></tr></thead>
        <tbody>${alertRows}</tbody>
      </table>`
        : '<h3>Alerts</h3><p class="muted">No alerts.</p>';

    const labels = agent.labels ?? [];
    const labelsStr = labels.length > 0 ? labels.map((l) => escapeHtml(l)).join(', ') : 'none';

    const body = `
    <h2>${escapeHtml(agentId)}</h2>
    <p>Status: <strong>${escapeHtml(agent.status ?? 'ACTIVE')}</strong> &middot; Labels: ${labelsStr}</p>
    ${reportSection}
    ${alertsSection}`;

    return reply.type('text/html').send(layout(agentId, body));
  });

  // ── Transparency Status ───────────────────────────────────────────────
  fastify.get('/transparency', async (_request, reply) => {
    if (!publicKey) {
      return reply.status(503).type('text/html').send(
        layout('Transparency', '<h2>Transparency Log</h2><p>No signing key configured. Start the server with a valid key path.</p>'),
      );
    }

    const today = new Date();
    const verifications = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const date = new Date(dateStr + 'T00:00:00Z');
      const filePath = logFilePath(logDir, date);
      const result = verifyLogFile(filePath, publicKey);

      verifications.push({
        date: dateStr,
        totalLeaves: result.totalLeaves,
        validLeaves: result.validLeaves,
        invalidLeaves: result.invalidLeaves,
      });
    }

    const latest = verifications[0]!;
    const rows = verifications
      .map(
        (v) => `<tr>
        <td>${v.date}</td>
        <td>${v.totalLeaves}</td>
        <td>${v.validLeaves}</td>
        <td>${v.invalidLeaves}</td>
        <td>${v.invalidLeaves > 0 ? '<span class="risk-critical">CORRUPT</span>' : '<span class="risk-low">OK</span>'}</td>
      </tr>`,
      )
      .join('\n');

    const body = `
    <h2>Transparency Log</h2>
    <table>
      <tbody>
        <tr><td>Latest Date</td><td>${latest.date}</td></tr>
        <tr><td>Latest Leaf Count</td><td>${latest.totalLeaves}</td></tr>
        <tr><td>Public Key</td><td class="mono">${escapeHtml(publicKey)}</td></tr>
      </tbody>
    </table>
    <h3>7-Day Verification</h3>
    <table>
      <thead>
        <tr><th>Date</th><th>Total</th><th>Valid</th><th>Invalid</th><th>Status</th></tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>`;

    return reply.type('text/html').send(layout('Transparency', body));
  });
}
