import Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, 'migrations');

/**
 * Initialize (or open) the SQLite database.
 * Runs pragmas and applies pending migrations.
 */
export function initDb(dbPath?: string): Database.Database {
  const resolvedPath = dbPath ?? process.env['WATCHTOWER_DB_PATH'] ?? './data/watchtower.db';

  // Ensure parent directory exists
  const dir = dirname(resolvedPath);
  mkdirSync(dir, { recursive: true });

  const db = new Database(resolvedPath);

  // Performance pragmas
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');

  // Run migrations
  runMigrations(db);

  return db;
}

function runMigrations(db: Database.Database): void {
  // Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    )
  `);

  const applied = new Set(
    db
      .prepare('SELECT name FROM _migrations')
      .all()
      .map((row) => (row as { name: string }).name),
  );

  // Read migration files in order
  let migrationFiles: string[];
  try {
    migrationFiles = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();
  } catch {
    // migrations dir not found (bundled build) — fall back to inline migrations
    applyInlineMigrations(db, applied);
    return;
  }

  if (migrationFiles.length === 0) {
    applyInlineMigrations(db, applied);
    return;
  }

  for (const file of migrationFiles) {
    if (applied.has(file)) continue;

    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');
    db.exec(sql);
    db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)').run(
      file,
      Math.floor(Date.now() / 1000),
    );
  }
}

function applyInlineMigrations(db: Database.Database, applied: Set<string>): void {
  if (!applied.has('001_init.sql')) {
    db.exec(MIGRATION_001);
    db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)').run(
      '001_init.sql',
      Math.floor(Date.now() / 1000),
    );
  }
}

/**
 * Initialize DB with inline SQL (for built/bundled environments where migration files
 * may not be on disk). This is also useful for tests.
 */
export function initDbWithInlineMigrations(dbPath: string): Database.Database {
  const dir = dirname(dbPath);
  mkdirSync(dir, { recursive: true });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    )
  `);

  const applied = new Set(
    db
      .prepare('SELECT name FROM _migrations')
      .all()
      .map((row) => (row as { name: string }).name),
  );

  if (!applied.has('001_init.sql')) {
    db.exec(MIGRATION_001);
    db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)').run(
      '001_init.sql',
      Math.floor(Date.now() / 1000),
    );
  }

  return db;
}

const MIGRATION_001 = `
CREATE TABLE IF NOT EXISTS agents (
  agent_id TEXT PRIMARY KEY,
  created_at INTEGER,
  status TEXT DEFAULT 'ACTIVE',
  labels_json TEXT DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS snapshots (
  snapshot_id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(agent_id),
  observed_at INTEGER NOT NULL,
  signals_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_snapshots_agent ON snapshots(agent_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS alerts (
  alert_id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(agent_id),
  severity TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence_json TEXT DEFAULT '[]',
  created_at INTEGER NOT NULL,
  is_active INTEGER DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_alerts_agent ON alerts(agent_id, is_active, created_at DESC);

CREATE TABLE IF NOT EXISTS risk_reports (
  report_id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(agent_id),
  generated_at INTEGER NOT NULL,
  overall_risk INTEGER NOT NULL,
  confidence TEXT NOT NULL,
  report_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reports_agent ON risk_reports(agent_id, generated_at DESC);
`;
