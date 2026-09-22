import { spawnSync } from 'node:child_process';

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING;

const env = { ...process.env };
if (databaseUrl) env.DATABASE_URL = databaseUrl;

function run(command, args) {
  const result = spawnSync(command, args, { env, stdio: 'inherit', shell: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('npx', ['prisma', 'generate']);
if (databaseUrl) {
  console.log('[BookCase] Synchronizing Prisma schema with PostgreSQL...');
  run('npx', ['prisma', 'db', 'push', '--skip-generate']);
} else {
  console.warn('[BookCase] No PostgreSQL URL found during build. Runtime login requires DATABASE_URL, POSTGRES_PRISMA_URL, or POSTGRES_URL.');
}
run('npx', ['next', 'build']);
