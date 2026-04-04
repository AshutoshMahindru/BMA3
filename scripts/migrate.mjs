import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const migrationsDir = path.join(repoRoot, 'db', 'migrations', 'pgm');
const binPath = path.join(repoRoot, 'node_modules', '.bin', 'node-pg-migrate');

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

const mode = process.argv[2] || 'up';
const additionalArgs = process.argv.slice(3);
const args = [mode, '--db-url', defaultDatabaseUrl(), '--migrations-dir', migrationsDir];

if (mode === 'create') {
  const migrationName = additionalArgs[0] || 'new-migration';
  args.push(migrationName);
}

if (mode !== 'create') {
  args.push('--migration-file-language', 'js');
  args.push(...additionalArgs);
}

const result = spawnSync(binPath, args, {
  cwd: repoRoot,
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status ?? 1);
