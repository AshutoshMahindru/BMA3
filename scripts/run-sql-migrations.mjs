import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const migrationsDir = path.join(repoRoot, 'db', 'migrations');
const require = createRequire(import.meta.url);
const { Client } = require(path.join(repoRoot, 'api', 'node_modules', 'pg'));

function defaultDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const host = process.env.DB_HOST || '127.0.0.1';
  const port = process.env.DB_PORT || '5433';
  const database = process.env.DB_NAME || 'fpe_db';
  const user = process.env.DB_USER || 'fpe_admin';
  const password = process.env.DB_PASSWORD || 'fpe_password';
  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

async function main() {
  const client = new Client({ connectionString: defaultDatabaseUrl() });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS sql_migration_runs (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const applied = await client.query('SELECT filename FROM sql_migration_runs');
    const appliedSet = new Set(applied.rows.map((row) => String(row.filename)));

    const files = fs.readdirSync(migrationsDir)
      .filter((file) => /^\d+.*\.sql$/.test(file))
      .sort((left, right) => left.localeCompare(right));

    for (const file of files) {
      if (appliedSet.has(file)) {
        process.stdout.write(`> SQL migration already applied: ${file}\n`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      process.stdout.write(`> Applying SQL migration: ${file}\n`);
      await client.query(sql);
      await client.query('INSERT INTO sql_migration_runs (filename) VALUES ($1)', [file]);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  process.stderr.write(`SQL migration runner failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
