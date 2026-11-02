import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file, imports = {}) {
  const source = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, Promise, Date, Set, Map, require: name => {
    assert.ok(name in imports, `Unexpected import: ${name}`);
    return imports[name];
  } });
  return exports;
}
const { WriteQueue } = load('../src/app/business/expenses/writeQueue.ts');
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

test('Slow writes stay bounded at two; failures release the next queued write', async () => {
  const queue = new WriteQueue(2);
  const gates = Array.from({ length: 5 }, deferred);
  let active = 0, peak = 0;
  const started = [];
  const tasks = gates.map((gate, index) => queue.run(async () => {
    started.push(index);
    peak = Math.max(peak, ++active);
    try { return await gate.promise; } finally { active--; }
  }));
  const settled = Promise.allSettled(tasks);
  await Promise.resolve();
  assert.deepEqual(started, [0, 1]);
  gates[0].reject(new Error('offline'));
  await tasks[0].catch(() => {});
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(started, [0, 1, 2]);
  for (const gate of gates.slice(1)) gate.resolve('saved');
  const result = await settled;
  assert.equal(peak, 2);
  assert.equal(result.filter(item => item.status === 'fulfilled').length, 4);
  assert.equal(active, 0);
});

function fixture() {
  const rows = new Map();
  let insertions = 0;
  const include = data => ({ ...data, destinationAccountId: data.destinationAccountId || null, description: data.description || null, createdAt: new Date(), account: { id: data.accountId, name: 'Cash', type: 'cash' }, destinationAccount: data.destinationAccountId ? { id: data.destinationAccountId, name: 'Bank', type: 'bank' } : null, categoryRef: data.categoryId ? { name: 'Food', icon: 'coins', color: '#FFB4A2' } : null });
  const prisma = {
    moneyAccount: { findFirst: async ({ where }) => ['cash', 'bank'].includes(where.id) && where.userId === 'owner' && where.bookId === 'book' ? { id: where.id, currency: 'VND' } : null },
    financeCategory: { findFirst: async ({ where }) => where.id === 'food' && where.type === 'expense' && where.userId === 'owner' ? { id: 'food', name: 'Food' } : null },
    financeTransaction: {
      upsert: async ({ where, create }) => {
        if (!rows.has(where.id)) { insertions++; rows.set(where.id, include(create)); }
        return rows.get(where.id);
      },
      findUnique: async ({ where }) => rows.get(where.id),
    },
  };
  const route = (authenticated = true) => load('../src/app/api/business/finance/transactions/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } },
    '@/lib/auth': { getRequestUser: () => authenticated ? { id: 'owner' } : null },
    '@/lib/db': { prisma },
  });
  return { rows, prisma, route, insertions: () => insertions };
}
const clientId = '11111111-1111-4111-8111-111111111111';
const body = { clientId, bookId: 'book', accountId: 'cash', type: 'expense', amount: '30', categoryId: 'food', date: '2026-11-02', description: '' };
const request = value => new Request('https://test.local/api/business/finance/transactions', { method: 'POST', body: JSON.stringify(value) });

test('Lost acknowledgement followed by simultaneous retries inserts one financial transaction', async () => {
  const f = fixture(), route = f.route();
  const responses = await Promise.all(Array.from({ length: 4 }, () => route.POST(request(body))));
  assert.ok(responses.every(response => response.status === 201));
  assert.equal(f.insertions(), 1);
  assert.equal(f.rows.size, 1);
  assert.equal((await responses[0].json()).id, clientId);
  assert.equal((await route.POST(request({ ...body, amount: '40' }))).status, 409);
  assert.equal(f.insertions(), 1);
});

test('Pending write IDs cannot access another owner or bypass account authorization', async () => {
  const f = fixture();
  assert.equal((await f.route(false).POST(request(body))).status, 401);
  assert.equal((await f.route().POST(request({ ...body, clientId: 'invalid' }))).status, 400);
  assert.equal((await f.route().POST(request({ ...body, accountId: 'foreign' }))).status, 404);
  f.rows.set(clientId, { ...body, userId: 'other', amount: 30, transactionDate: new Date('2026-11-02T12:00:00+07:00') });
  assert.equal((await f.route().POST(request(body))).status, 409);
  assert.equal(f.rows.get(clientId).userId, 'other');
});

test('Transfer retry credits and debits wallets once and unique-conflict recovery returns the original', async () => {
  const f = fixture(), route = f.route();
  const transfer = { ...body, type: 'transfer', destinationAccountId: 'bank', categoryId: '' };
  assert.equal((await route.POST(request(transfer))).status, 201);
  assert.equal((await route.POST(request(transfer))).status, 201);
  assert.equal(f.insertions(), 1);
  f.prisma.financeTransaction.upsert = async () => { throw { code: 'P2002' }; };
  assert.equal((await route.POST(request(transfer))).status, 201);
  assert.equal(f.insertions(), 1);
});
