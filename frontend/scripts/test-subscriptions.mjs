/* Run with: node scripts/test-subscriptions.mjs. No live database is modified. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const directory = path.dirname(fileURLToPath(import.meta.url));

function load(file, imports = {}) {
  const source = fs.readFileSync(path.join(directory, '..', file), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => {
    if (!(name in imports)) throw new Error(`Unexpected import ${name}`);
    return imports[name];
  }, Date, Intl, console, Error, Map, Set }, { filename: file });
  return exports;
}

const util = load('src/lib/subscriptions.ts');
const priceInput = load('src/lib/subscriptionPrice.ts');
test('Price input groups thousands without losing decimals or accepting invalid amounts', () => {
  for (const [raw, formatted] of [['', ''], ['0', '0'], ['150000', '150,000'], ['123456789012.50', '123,456,789,012.50'], ['1500.', '1,500.']]) {
    assert.equal(priceInput.formatSubscriptionPrice(raw), formatted);
    assert.equal(priceInput.parseSubscriptionPrice(formatted), raw);
  }
  for (const invalid of ['-1', '1e4', '12.345', '1234567890123', 'abc', '1.2.3']) assert.equal(priceInput.parseSubscriptionPrice(invalid), null);
});
const valid = () => ({ customerId: null, customerName: 'Khách An', customerContact: 'an@example.com', appName: 'Canva', planName: 'Pro', account: 'an@example.com', durationValue: 1, durationUnit: 'month', price: '150000', currency: 'VND', startDate: '2026-10-30', cancelDate: '2026-11-30', note: '' });

test('Monthly and yearly periods clamp to the last valid day', () => {
  assert.equal(util.subscriptionEnd('2026-01-31', 1, 'month'), '2026-02-28');
  assert.equal(util.subscriptionEnd('2028-01-31', 1, 'month'), '2028-02-29');
  assert.equal(util.subscriptionEnd('2028-02-29', 1, 'year'), '2029-02-28');
  assert.equal(util.subscriptionEnd('2026-12-31', 2, 'month'), '2027-02-28');
  assert.equal(util.subscriptionEnd('2026-10-30', 7, 'day'), '2026-11-06');
});
test('Cancellation defaults to expiry, and early reminders never precede start', () => {
  assert.equal(util.defaultCancelDate('2026-10-30', '2026-11-30'), '2026-11-30');
  assert.equal(util.defaultCancelDate('2026-10-30', '2026-10-31', 3), '2026-10-30');
});
test('Date validation rejects rollover dates and out-of-range input', () => {
  for (const value of ['2026-02-29', '2026-02-30', '2026-13-01', '2026-1-01', '', '1999-12-31']) assert.equal(util.validDate(value), false);
  assert.equal(util.validDate('2028-02-29'), true);
  assert.equal(util.subscriptionEnd('', 1, 'month'), '');
  assert.equal(util.subscriptionEnd('2026-10-30', NaN, 'month'), '');
});
test('Today uses Bangkok date even around UTC midnight', () => {
  assert.equal(util.todayKey(new Date('2026-10-29T18:00:00Z')), '2026-10-30');
  assert.equal(util.todayKey(new Date('2026-10-29T16:59:00Z')), '2026-10-29');
});
test('Month view contains 42 consecutive days and starts on Monday', () => {
  const days = util.calendarDays('2026-11');
  assert.equal(days.length, 42);
  assert.equal(days[0], '2026-10-26');
  assert.equal(days[41], '2026-12-06');
  days.slice(1).forEach((day, index) => assert.equal(day, util.addDays(days[index], 1)));
});
test('Only unprocessed reminders become overdue', () => {
  for (const [status, date, expected] of [['active', '2026-10-29', 'overdue'], ['active', '2026-10-30', 'today'], ['active', '2026-10-31', 'upcoming'], ['cancelled', '2026-10-29', 'cancelled'], ['renewed', '2026-10-29', 'renewed']]) assert.equal(util.reminderState({ status, cancelDate: date }, '2026-10-30'), expected);
});
test('Validation computes expiry and permits a zero-cost plan', () => {
  const result = util.validateSubscription({ ...valid(), price: '0' });
  assert.ok('data' in result);
  assert.equal(result.data.endDate, '2026-11-30');
});
test('Validation rejects missing fields, invalid periods, money and reminder dates', () => {
  const cases = [null, [], {}, { ...valid(), customerName: ' ' }, { ...valid(), account: '' }, { ...valid(), price: '-1' }, { ...valid(), price: '1e4' }, { ...valid(), price: '10.001' }, { ...valid(), durationValue: 0 }, { ...valid(), durationValue: 121 }, { ...valid(), durationUnit: 'week' }, { ...valid(), currency: 'BAD' }, { ...valid(), cancelDate: '2026-12-01' }, { ...valid(), cancelDate: '2026-10-29' }, { ...valid(), startDate: '2026-02-30' }, { ...valid(), appName: 'x'.repeat(251) }, { ...valid(), note: 'x'.repeat(5001) }];
  cases.forEach(value => assert.ok('error' in util.validateSubscription(value)));
});

function apiFixture() {
  let rows = [];
  let sequence = 0;
  const matches = (row, where) => Object.entries(where).every(([key, value]) => value && typeof value === 'object' && 'not' in value ? row[key] !== value.not : row[key] === value);
  const model = {
    findMany: async ({ where }) => rows.filter(row => matches(row, where)),
    findFirst: async ({ where }) => rows.find(row => matches(row, where)) || null,
    findFirstOrThrow: async ({ where }) => { const row = rows.find(row => matches(row, where)); if (!row) throw new Error('Missing row'); return row; },
    create: async ({ data }) => { const row = { id: `sub-${++sequence}`, status: 'active', ...data }; rows.push(row); return row; },
    updateMany: async ({ where, data }) => { let count = 0; rows = rows.map(row => { if (!matches(row, where)) return row; count++; return { ...row, ...data }; }); return { count }; },
    deleteMany: async ({ where }) => { const before = rows.length; rows = rows.filter(row => !matches(row, where)); return { count: before - rows.length }; },
  };
  const db = { customerSubscription: model, businessCustomer: { findFirst: async ({ where }) => where.id === 'customer-alice' && where.userId === 'alice' ? { id: 'customer-alice' } : null } };
  db.$transaction = async callback => { const snapshot = rows.map(row => ({ ...row })); try { return await callback(db); } catch (error) { rows = snapshot; throw error; } };
  const next = { NextResponse: { json: (value, options = {}) => new Response(JSON.stringify(value), { ...options, headers: { 'Content-Type': 'application/json' } }) } };
  const server = load('src/lib/subscriptionServer.ts', { 'next/server': next });
  const imports = { 'next/server': next, '@/lib/db': { prisma: db }, '@/lib/auth': { getRequestUser: request => { const id = request.headers.get('authorization')?.replace('Bearer ', ''); return id === 'alice' || id === 'bob' ? { id } : null; } }, '@/lib/subscriptions': util, '@/lib/subscriptionServer': server, '@/lib/businessBackup': { createAutomaticBusinessBackup: async () => null } };
  const collection = load('src/app/api/sales/subscriptions/route.ts', imports);
  const single = load('src/app/api/sales/subscriptions/[id]/route.ts', imports);
  const request = (method, body, user = 'alice') => new Request('http://localhost/api/sales/subscriptions', { method, headers: user ? { Authorization: `Bearer ${user}` } : {}, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const context = id => ({ params: Promise.resolve({ id }) });
  return { collection, single, request, context, rows: () => rows };
}
test('All API operations reject unauthenticated requests', async () => {
  const { collection, single, request, context } = apiFixture();
  for (const [handlers, method] of [[collection, 'GET'], [collection, 'POST'], [single, 'PUT'], [single, 'PATCH'], [single, 'DELETE']]) assert.equal((await handlers[method](request(method, undefined, ''), context('sub-1'))).status, 401);
});
test('Create, edit, cancel, reactivate and delete persist within the authenticated scope', async () => {
  const { collection, single, request, context, rows } = apiFixture();
  const created = await collection.POST(request('POST', valid()));
  assert.equal(created.status, 201);
  const row = await created.json();
  assert.equal(row.endDate, '2026-11-30');
  assert.equal(row.price, '150000');
  assert.equal(rows()[0].userId, 'alice');
  assert.equal((await collection.GET(request('GET', undefined, 'alice')).then(response => response.json())).length, 1);
  assert.equal((await collection.GET(request('GET', undefined, 'bob')).then(response => response.json())).length, 0);
  assert.equal((await single.PUT(request('PUT', { ...valid(), planName: 'Team' }), context(row.id))).status, 200);
  assert.equal(rows()[0].planName, 'Team');
  for (const status of ['cancelled', 'active']) {
    assert.equal((await single.PATCH(request('PATCH', { status }), context(row.id))).status, 200);
    assert.equal(rows()[0].status, status);
  }
  assert.equal((await single.DELETE(request('DELETE'), context(row.id))).status, 200);
  assert.equal(rows().length, 0);
});
test('Another user cannot edit, cancel, delete, link or renew someone else’s records', async () => {
  const { collection, single, request, context, rows } = apiFixture();
  const row = await collection.POST(request('POST', valid())).then(response => response.json());
  for (const method of ['PUT', 'PATCH', 'DELETE']) assert.equal((await single[method](request(method, method === 'PUT' ? valid() : method === 'PATCH' ? { status: 'cancelled' } : undefined, 'bob'), context(row.id))).status, 404);
  assert.equal((await collection.POST(request('POST', { ...valid(), customerId: 'customer-alice' }, 'bob'))).status, 404);
  assert.equal((await collection.POST(request('POST', { ...valid(), renewFromId: row.id }, 'bob'))).status, 404);
  assert.equal(rows().length, 1);
  assert.equal(rows()[0].status, 'active');
});
test('Renewal retains the previous period and atomically prevents duplicate renewal', async () => {
  const { collection, single, request, context, rows } = apiFixture();
  const row = await collection.POST(request('POST', valid())).then(response => response.json());
  const renewal = { ...valid(), startDate: '2026-11-30', cancelDate: '2026-12-30', renewFromId: row.id };
  assert.equal((await collection.POST(request('POST', renewal))).status, 201);
  assert.equal(rows().length, 2);
  assert.equal(rows()[0].status, 'renewed');
  assert.equal(rows()[1].status, 'active');
  assert.equal((await collection.POST(request('POST', renewal))).status, 409);
  assert.equal(rows().length, 2);
  assert.equal((await single.PATCH(request('PATCH', { status: 'active' }), context(row.id))).status, 404);
});
test('Overlapping renewals, invalid state updates and malformed requests are rejected', async () => {
  const { collection, single, request, context, rows } = apiFixture();
  const row = await collection.POST(request('POST', valid())).then(response => response.json());
  assert.equal((await collection.POST(request('POST', { ...valid(), renewFromId: row.id }))).status, 400);
  assert.equal(rows()[0].status, 'active');
  assert.equal((await single.PATCH(request('PATCH', { status: 'renewed' }), context(row.id))).status, 400);
  assert.equal((await collection.POST(new Request('http://localhost', { method: 'POST', headers: { Authorization: 'Bearer alice' }, body: '{invalid' }))).status, 400);
  assert.equal((await collection.POST(request('POST', { ...valid(), price: '-10' }))).status, 400);
  assert.equal(rows().length, 1);
});

function backupFixture() {
  const stores = {};
  const db = {};
  for (const model of ['businessInventoryBatch', 'businessProduct', 'businessTransaction', 'businessLedger', 'businessCustomer', 'businessStockReceipt', 'businessStockReceiptItem', 'businessOrder', 'businessOrderItem', 'businessExpense', 'businessOrderPayment', 'businessOrderStatusHistory', 'businessInventoryMovement', 'customerSubscription', 'subscriptionApp', 'businessDataBackup']) {
    stores[model] = [];
    db[model] = {
      findMany: async ({ where, skip } = {}) => stores[model].filter(row => !where?.userId || row.userId === where.userId).slice(skip || 0),
      create: async ({ data }) => { const row = { id: `id-${stores[model].length}`, createdAt: new Date(), ...data }; stores[model].push(row); return row; },
      createMany: async ({ data }) => { stores[model].push(...data); return { count: data.length }; },
      deleteMany: async ({ where }) => { stores[model] = stores[model].filter(row => row.userId !== where.userId); return { count: 0 }; },
    };
  }
  db.$transaction = callback => callback(db);
  const backup = load('src/lib/businessBackup.ts', { '@/lib/db': { prisma: db } });
  stores.businessCustomer.push({ id: 'customer-alice', userId: 'alice', name: 'An', createdAt: new Date() });
  const subscription = { id: 'sub-alice', userId: 'alice', ...valid(), customerId: 'customer-alice', status: 'active', startDate: new Date('2026-10-30T00:00:00Z'), endDate: new Date('2026-11-30T00:00:00Z'), cancelDate: new Date('2026-11-30T00:00:00Z') };
  stores.customerSubscription.push(subscription, { ...subscription, id: 'sub-bob', userId: 'bob', customerId: null });
  stores.subscriptionApp.push({ id: 'app-alice', userId: 'alice', name: 'Spotify', createdAt: new Date() }, { id: 'app-bob', userId: 'bob', name: 'YouTube', createdAt: new Date() });
  return { backup, db, stores };
}
test('Business backup round-trip preserves subscriptions and only affects its owner', async () => {
  const { backup, db, stores } = backupFixture();
  const payload = await backup.buildBusinessBackup(db, 'alice');
  assert.equal(payload.data.subscriptions.length, 1);
  assert.equal(payload.data.subscriptions[0].id, 'sub-alice');
  assert.equal(payload.data.subscriptionApps.length, 1);
  assert.equal(payload.data.subscriptionApps[0].name, 'Spotify');
  stores.customerSubscription[0].account = 'changed@example.com';
  await backup.restoreBusinessBackup('alice', payload);
  assert.equal(stores.customerSubscription.length, 2);
  const restored = stores.customerSubscription.find(row => row.userId === 'alice');
  assert.equal(restored.account, 'an@example.com');
  assert.ok(restored.cancelDate instanceof Date);
  assert.equal(restored.cancelDate.toISOString(), '2026-11-30T00:00:00.000Z');
  assert.equal(stores.customerSubscription.find(row => row.userId === 'bob').id, 'sub-bob');
  assert.equal(stores.subscriptionApp.find(row => row.userId === 'alice').name, 'Spotify');
  assert.equal(stores.subscriptionApp.find(row => row.userId === 'bob').name, 'YouTube');
});
test('Older v2 backups without subscription data can still be restored', async () => {
  const { backup, db, stores } = backupFixture();
  const legacy = await backup.buildBusinessBackup(db, 'alice');
  delete legacy.data.subscriptions;
  delete legacy.data.subscriptionApps;
  await backup.restoreBusinessBackup('alice', legacy);
  assert.equal(stores.customerSubscription.filter(row => row.userId === 'alice').length, 0);
  assert.equal(stores.customerSubscription.filter(row => row.userId === 'bob').length, 1);
  assert.equal(stores.subscriptionApp.filter(row => row.userId === 'alice').length, 0);
  assert.equal(stores.subscriptionApp.filter(row => row.userId === 'bob').length, 1);
});

test('App catalog persists additions without a count limit, deduplicates and isolates accounts', async () => {
  const apps = [];
  const next = { NextResponse: { json: (body, options = {}) => new Response(JSON.stringify(body), options) } };
  const server = load('src/lib/subscriptionServer.ts', { 'next/server': next });
  const route = load('src/app/api/sales/subscriptions/apps/route.ts', {
    'next/server': next,
    '@/lib/auth': { getRequestUser: request => { const id = request.headers.get('authorization'); return id ? { id } : null; } },
    '@/lib/subscriptionServer': server,
    '@/lib/db': { prisma: {
      subscriptionApp: {
        findMany: async ({ where }) => apps.filter(app => app.userId === where.userId),
        upsert: async ({ where, create }) => { const existing = apps.find(app => app.userId === where.userId_name.userId && app.name === where.userId_name.name); if (existing) return existing; apps.push(create); return create; },
      },
      customerSubscription: { findMany: async ({ where }) => where.userId === 'alice' ? [{ appName: 'Legacy App' }] : [] },
    } },
  });
  const request = (method, body, user = 'alice') => new Request('http://localhost/api/sales/subscriptions/apps', { method, headers: user ? { authorization: user } : {}, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  assert.equal((await route.GET(request('GET', undefined, ''))).status, 401);
  assert.equal((await route.POST(request('POST', { name: 'Spotify' }, ''))).status, 401);
  for (const name of ['', ' ', 'x'.repeat(251), 123]) assert.equal((await route.POST(request('POST', { name }))).status, 400);
  for (let i = 0; i < 110; i++) assert.equal((await route.POST(request('POST', { name: `App ${i}` }))).status, 200);
  await route.POST(request('POST', { name: ' App 0 ' }));
  assert.equal(apps.length, 110);
  const alice = await route.GET(request('GET')).then(response => response.json());
  assert.ok(alice.includes('Legacy App'));
  assert.ok(alice.includes('App 109'));
  const bob = await route.GET(request('GET', undefined, 'bob')).then(response => response.json());
  assert.deepEqual(bob, ['Canva', 'Netflix']);
});
