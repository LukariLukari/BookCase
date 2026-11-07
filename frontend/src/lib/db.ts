import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { getCloudflareContext } from '@opennextjs/cloudflare';

type WorkerContext = { env: { HYPERDRIVE?: { connectionString: string } }; ctx: object };
const requestClients = new WeakMap<object, PrismaClient>();
const nodeGlobal = globalThis as typeof globalThis & { billyNodePrisma?: PrismaClient };

export function getDatabaseSource() {
  try {
    const context = getCloudflareContext() as WorkerContext;
    if (context.env.HYPERDRIVE?.connectionString) return 'HYPERDRIVE';
  } catch { /* Node.js has no Workers binding. */ }
  return ['DATABASE_URL', 'POSTGRES_PRISMA_URL', 'POSTGRES_URL', 'POSTGRES_URL_NON_POOLING'].find(key => process.env[key]) || null;
}

function createClient(connectionString: string, worker = false) {
  const adapter = new PrismaPg({
    connectionString,
    // Parallel reads (including backups) share a small request-local pool.
    // Do not discard a socket after every query; requests never share clients.
    ...(worker ? { max: 5, idleTimeoutMillis: 1000 } : {}),
  });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

function getClient(): PrismaClient {
  let context: WorkerContext | undefined;
  try {
    context = getCloudflareContext() as WorkerContext;
  } catch {
    // Node.js (local development or Vercel) has no Workers request context.
  }

  if (context) {
    if (!context.env.HYPERDRIVE?.connectionString) throw new Error('Cloudflare chưa cấu hình binding HYPERDRIVE.');
    // Workers cannot reuse sockets belonging to another request.
    let client = requestClients.get(context.ctx);
    if (!client) {
      client = createClient(context.env.HYPERDRIVE.connectionString, true);
      requestClients.set(context.ctx, client);
    }
    return client;
  }

  if (!nodeGlobal.billyNodePrisma) {
    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING;
    if (!connectionString) throw new Error('Máy chủ chưa cấu hình DATABASE_URL.');
    nodeGlobal.billyNodePrisma = createClient(connectionString);
  }
  return nodeGlobal.billyNodePrisma;
}

// Resolve the client when a query starts, keeping imports/builds free of DB access
// and preserving the existing prisma API used by the route handlers.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getClient();
    const value = Reflect.get(client, property);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
