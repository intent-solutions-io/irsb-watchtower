#!/usr/bin/env node
import { Command } from 'commander';
import pc from 'picocolors';
import { readFileSync } from 'node:fs';
import {
  initDb,
  initDbWithInlineMigrations,
  upsertAgent,
  getAgent,
  insertSnapshot,
  getLatestSnapshots,
  scoreAgent,
  insertRiskReport,
  insertAlerts,
  getLatestRiskReport,
  listAlerts,
  AgentStatusEnum,
  SignalSchema,
  canonicalJson,
  sha256Hex,
} from '@irsb-watchtower/watchtower-core';
import { z } from 'zod';

const program = new Command();

program
  .name('wt')
  .description('IRSB Watchtower CLI — local-first agent monitoring')
  .version('0.3.0');

function openDb(): ReturnType<typeof initDb> {
  const dbPath = process.env['WATCHTOWER_DB_PATH'] ?? './data/watchtower.db';
  return initDbWithInlineMigrations(dbPath);
}

// ── init-db ──────────────────────────────────────────────────────────────
program
  .command('init-db')
  .description('Create or migrate the SQLite database')
  .option('--db-path <path>', 'Database file path')
  .action((options: { dbPath?: string }) => {
    const dbPath = options.dbPath ?? process.env['WATCHTOWER_DB_PATH'] ?? './data/watchtower.db';
    console.log(pc.bold('\nInitializing Watchtower DB\n'));
    const db = initDbWithInlineMigrations(dbPath);
    db.close();
    console.log(`  ${pc.green('✓')} Database ready at ${pc.cyan(dbPath)}`);
    console.log('');
  });

// ── upsert-agent ─────────────────────────────────────────────────────────
program
  .command('upsert-agent')
  .description('Create or update an agent')
  .requiredOption('--agentId <id>', 'Agent identifier')
  .option('--labels <labels>', 'Comma-separated labels')
  .option('--status <status>', 'Agent status (ACTIVE, PROBATION, BLOCKED)', 'ACTIVE')
  .action((options: { agentId: string; labels?: string; status?: string }) => {
    const statusResult = AgentStatusEnum.safeParse(options.status ?? 'ACTIVE');
    if (!statusResult.success) {
      console.error(pc.red(`  Invalid status: '${options.status}'. Must be one of: ${AgentStatusEnum.options.join(', ')}`));
      process.exit(1);
    }

    const db = openDb();
    try {
      upsertAgent(db, {
        agentId: options.agentId,
        labels: options.labels ? options.labels.split(',').map((l) => l.trim()) : undefined,
        status: statusResult.data,
      });
      console.log(`  ${pc.green('✓')} Agent ${pc.cyan(options.agentId)} upserted`);
    } finally {
      db.close();
    }
  });

// ── add-snapshot ─────────────────────────────────────────────────────────
program
  .command('add-snapshot')
  .description('Add a snapshot from a JSON file of signals')
  .requiredOption('--agentId <id>', 'Agent identifier')
  .requiredOption('--signals <path>', 'Path to JSON file with signals array')
  .action((options: { agentId: string; signals: string }) => {
    let raw: string;
    try {
      raw = readFileSync(options.signals, 'utf-8');
    } catch (err) {
      console.error(pc.red(`  Error reading signals file: ${options.signals}`));
      console.error(pc.gray(`  ${(err as Error).message}`));
      process.exit(1);
    }

    const db = openDb();
    try {
      const parsed = JSON.parse(raw) as unknown;
      const signals = z.array(SignalSchema).parse(parsed);

      const observedAt = Math.floor(Date.now() / 1000);

      // Deterministic snapshot ID
      const snapshotPayload = {
        agentId: options.agentId,
        observedAt,
        signals,
      };
      const snapshotId = sha256Hex(canonicalJson(snapshotPayload));

      insertSnapshot(db, {
        snapshotId,
        agentId: options.agentId,
        observedAt,
        signals,
      });

      console.log(`  ${pc.green('✓')} Snapshot ${pc.cyan(snapshotId.slice(0, 16))}... added (${signals.length} signals)`);
    } finally {
      db.close();
    }
  });

// ── score-agent ──────────────────────────────────────────────────────────
program
  .command('score-agent')
  .description('Score an agent and store the report + alerts')
  .requiredOption('--agentId <id>', 'Agent identifier')
  .option('--limit <n>', 'Max snapshots to consider', '20')
  .action((options: { agentId: string; limit: string }) => {
    const db = openDb();
    try {
      const agent = getAgent(db, options.agentId);
      if (!agent) {
        console.log(pc.red(`  Agent ${options.agentId} not found`));
        process.exit(1);
      }

      const snapshots = getLatestSnapshots(db, options.agentId, parseInt(options.limit, 10));
      if (snapshots.length === 0) {
        console.log(pc.yellow(`  No snapshots found for agent ${options.agentId}`));
        process.exit(0);
      }

      const generatedAt = Math.floor(Date.now() / 1000);
      const { report, newAlerts } = scoreAgent(agent, snapshots, generatedAt);

      insertRiskReport(db, report);
      if (newAlerts.length > 0) {
        insertAlerts(db, newAlerts);
      }

      console.log(pc.bold(`\n  Risk Report for ${pc.cyan(options.agentId)}\n`));
      console.log(`  Overall Risk: ${riskColor(report.overallRisk)}`);
      console.log(`  Confidence:   ${pc.white(report.confidence)}`);
      console.log(`  Signals:      ${report.signals.length}`);
      console.log(`  New Alerts:   ${newAlerts.length}`);
      console.log(`  Report ID:    ${pc.gray(report.reportId.slice(0, 16))}...`);
      console.log('');
    } finally {
      db.close();
    }
  });

// ── risk-report ──────────────────────────────────────────────────────────
program
  .command('risk-report')
  .description('Show the latest risk report for an agent')
  .argument('<agentId>', 'Agent identifier')
  .action((agentId: string) => {
    const db = openDb();
    try {
      const report = getLatestRiskReport(db, agentId);
      if (!report) {
        console.log(pc.yellow(`  No risk report found for agent ${agentId}`));
        process.exit(0);
      }

      console.log(pc.bold(`\n  Risk Report: ${pc.cyan(agentId)}\n`));
      console.log(`  Report ID:     ${pc.gray(report.reportId)}`);
      console.log(`  Version:       ${report.reportVersion}`);
      console.log(`  Generated:     ${new Date(report.generatedAt * 1000).toISOString()}`);
      console.log(`  Overall Risk:  ${riskColor(report.overallRisk)}`);
      console.log(`  Confidence:    ${report.confidence}`);
      console.log('');

      if (report.reasons.length > 0) {
        console.log(pc.bold('  Reasons:'));
        for (const reason of report.reasons) {
          console.log(`    - ${reason}`);
        }
        console.log('');
      }

      if (report.signals.length > 0) {
        console.log(pc.bold('  Signals:'));
        for (const sig of report.signals) {
          console.log(`    ${severityColor(sig.severity)} ${pc.gray(sig.signalId)}`);
        }
        console.log('');
      }

      if (report.evidenceLinks.length > 0) {
        console.log(pc.bold('  Evidence:'));
        for (const ev of report.evidenceLinks) {
          console.log(`    [${ev.type}] ${pc.gray(ev.ref)}`);
        }
        console.log('');
      }
    } finally {
      db.close();
    }
  });

// ── list-alerts ──────────────────────────────────────────────────────────
program
  .command('list-alerts')
  .description('List alerts')
  .option('--agentId <id>', 'Filter by agent')
  .option('--active-only', 'Show only active alerts')
  .action((options: { agentId?: string; activeOnly?: boolean }) => {
    const db = openDb();
    try {
      const alerts = listAlerts(db, {
        agentId: options.agentId,
        activeOnly: options.activeOnly,
      });

      if (alerts.length === 0) {
        console.log(pc.gray('  No alerts found'));
        return;
      }

      console.log(pc.bold(`\n  Alerts (${alerts.length})\n`));
      for (const alert of alerts) {
        const active = alert.isActive ? pc.green('ACTIVE') : pc.gray('RESOLVED');
        console.log(`  ${severityColor(alert.severity)} [${active}] ${alert.type}`);
        console.log(`    Agent: ${pc.cyan(alert.agentId)}`);
        console.log(`    ${pc.gray(alert.description)}`);
        console.log(`    ID: ${pc.gray(alert.alertId.slice(0, 16))}...`);
        console.log('');
      }
    } finally {
      db.close();
    }
  });

// ── helpers ──────────────────────────────────────────────────────────────
function riskColor(risk: number): string {
  if (risk >= 80) return pc.red(pc.bold(`${risk}/100`));
  if (risk >= 50) return pc.yellow(`${risk}/100`);
  if (risk >= 20) return pc.cyan(`${risk}/100`);
  return pc.green(`${risk}/100`);
}

function severityColor(severity: string): string {
  switch (severity) {
    case 'CRITICAL':
      return pc.red(pc.bold(severity));
    case 'HIGH':
      return pc.red(severity);
    case 'MEDIUM':
      return pc.yellow(severity);
    case 'LOW':
      return pc.green(severity);
    default:
      return severity;
  }
}

program.parse();
