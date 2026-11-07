// Check client lifetimes without opening database connections.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function fixture(env = {}) {
  const clients = [];
  let context;
  class PrismaPg { constructor(config) { this.config = config; } }
  class PrismaClient {
    constructor(options) { this.options = options; this.user = { client: this }; clients.push(this); }
    $transaction(callback) { return callback(this); }
  }
  const imports = {
    '@prisma/client': { PrismaClient },
    '@prisma/adapter-pg': { PrismaPg },
    '@opennextjs/cloudflare': { getCloudflareContext: () => { if (!context) throw new Error('No Workers context'); return context; } },
  };
  const source = fs.readFileSync(new URL('../src/lib/db.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, process: { env }, require: name => imports[name] });
  return { prisma: exports.prisma, clients, context: value => { context = value; } };
}

test('Build-time imports do not initialize a database or require credentials', () => {
  const f = fixture();
  assert.equal(f.clients.length, 0);
  assert.throws(() => f.prisma.user, /DATABASE_URL/);
});

test('Node reuses its pool and transaction methods retain the correct client', () => {
  const f = fixture({ DATABASE_URL: 'postgresql://test.local/node' });
  const first = f.prisma.user.client;
  assert.equal(f.prisma.user.client, first);
  assert.equal(f.prisma.$transaction(client => client), first);
  assert.equal(first.options.adapter.config.connectionString, 'postgresql://test.local/node');
});

test('Workers reuse clients within a request and never share them across requests', () => {
  const f = fixture({ DATABASE_URL: 'postgresql://test.local/unused' });
  const requestA = { env: { HYPERDRIVE: { connectionString: 'postgresql://hyperdrive/request-a' } }, ctx: {} };
  f.context(requestA);
  const first = f.prisma.user.client;
  assert.equal(f.prisma.$transaction(client => client), first);
  f.context({ env: { HYPERDRIVE: { connectionString: 'postgresql://hyperdrive/request-b' } }, ctx: {} });
  const second = f.prisma.user.client;
  assert.notEqual(first, second);
  assert.equal(first.options.adapter.config.connectionString, 'postgresql://hyperdrive/request-a');
  assert.equal(first.options.adapter.config.max, 5);
  assert.equal(first.options.adapter.config.maxUses, undefined);
  assert.equal(second.options.adapter.config.connectionString, 'postgresql://hyperdrive/request-b');
  f.context(requestA);
  assert.equal(f.prisma.user.client, first);
  f.context({ env: {}, ctx: {} });
  assert.throws(() => f.prisma.user, /HYPERDRIVE/);
  assert.equal(f.clients.length, 2);
});


test('Backend authorization is reused within a request but rechecked for the next request', async () => {
  const calls = [];
  let role = 'admin';
  const prisma = { user: { findUnique: async args => { calls.push(args); return { id: 'owner', username: 'shop', role }; } } };
  const source = fs.readFileSync(new URL('../src/app/api/backend/[...path]/route.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source + '\nexports.testSession = session;', {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require: name => name === '@/lib/db' ? { prisma }
      : name === '@/lib/auth' ? { verifyJwt: token => token === 'valid' ? { id: 'owner' } : null }
      : {},
  });
  const request = () => new Request('https://example.test/api/backend/business/orders', { headers: { Authorization: 'Bearer valid' } });
  const first = request();
  const [a, b] = await Promise.all([exports.testSession(first), exports.testSession(first)]);
  assert.equal(a.role, 'admin');
  assert.equal(b.role, 'admin');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].select.password_hash, undefined);
  role = 'seller';
  assert.equal((await exports.testSession(request())).role, 'seller');
  assert.equal(calls.length, 2);
  assert.equal(await exports.testSession(new Request('https://example.test')), null);
  assert.equal(await exports.testSession(new Request('https://example.test', { headers: { Authorization: 'Bearer invalid' } })), null);
  assert.equal(calls.length, 2);
});
