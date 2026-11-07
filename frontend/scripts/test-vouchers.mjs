// In-memory storage only: these checks never connect to a database.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import QRCode from 'qrcode';

function load(file, imports = {}) {
  const source = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => { assert.ok(name in imports, name); return imports[name]; } });
  return exports;
}
const util = load('src/lib/vouchers.ts');
const request = (method = 'GET', body, owner = 'alice') => new Request('https://test.local/api/sales/vouchers', { method, headers: owner ? { authorization: `Bearer ${owner}` } : {}, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

function fixture() {
  const rows = [], qrInputs = [], backups = [];
  const prisma = { businessVoucher: {
    findMany: async ({ where }) => rows.filter(row => row.userId === where.userId).map(({ userId, ...row }) => row),
    create: async ({ data }) => {
      if (rows.some(row => row.userId === data.userId && row.code === data.code)) throw { code: 'P2002' };
      const row = { id: `voucher-${rows.length}`, createdAt: new Date('2026-11-07T00:00:00Z'), ...data };
      rows.push(row);
      const { userId, ...result } = row;
      return result;
    },
  } };
  const route = load('src/app/api/sales/vouchers/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } },
    qrcode: { toDataURL: async (code, options) => { qrInputs.push(code); return QRCode.toDataURL(code, options); } },
    '@/lib/auth': { getRequestUser: req => { const owner = req.headers.get('authorization')?.slice(7); return ['alice', 'bob'].includes(owner) ? { id: owner } : null; } },
    '@/lib/db': { prisma },
    '@/lib/businessBackup': { createAutomaticBusinessBackup: async id => backups.push(id) },
    '@/lib/vouchers': util,
  });
  return { route, rows, qrInputs, backups };
}

test('Listing and creating vouchers require authentication', async () => {
  const f = fixture();
  assert.equal((await f.route.GET(request('GET', undefined, null))).status, 401);
  assert.equal((await f.route.POST(request('POST', { code: 'test' }, null))).status, 401);
  assert.equal(f.rows.length, 0);
});

test('Saved codes normalize to uppercase and produce the same permanent QR after reloading', async () => {
  const f = fixture();
  const created = await f.route.POST(request('POST', { code: '  cảmơn_2026-a  ', note: 'Khách thân thiết', userId: 'bob', expiresAt: '2026-01-01' }));
  assert.equal(created.status, 201);
  const voucher = await created.json();
  assert.equal(voucher.code, 'CẢMƠN_2026-A');
  assert.equal(f.rows[0].userId, 'alice');
  assert.equal('expiresAt' in f.rows[0], false);
  assert.deepEqual(f.backups, ['alice']);
  const reloaded = await f.route.GET(request());
  assert.match(reloaded.headers.get('cache-control'), /no-store/);
  const [saved] = await reloaded.json();
  assert.equal(saved.id, voucher.id);
  assert.equal(saved.qrDataUrl, voucher.qrDataUrl);
  assert.deepEqual(f.qrInputs, ['CẢMƠN_2026-A', 'CẢMƠN_2026-A']);
  const png = Buffer.from(saved.qrDataUrl.split(',')[1], 'base64');
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
});

test('Duplicate codes are rejected within an owner, while other owners stay isolated', async () => {
  const f = fixture();
  const results = await Promise.all([f.route.POST(request('POST', { code: 'welcome' })), f.route.POST(request('POST', { code: 'WELCOME' }))]);
  assert.deepEqual(results.map(result => result.status).sort(), [201, 409]);
  assert.equal((await f.route.GET(request('GET', undefined, 'bob')).then(result => result.json())).length, 0);
  assert.equal((await f.route.POST(request('POST', { code: 'welcome' }, 'bob'))).status, 201);
  assert.equal((await f.route.GET(request()).then(result => result.json())).length, 1);
});

test('Malformed codes and bodies cannot create vouchers or generate QR images', async () => {
  const f = fixture();
  for (const body of [null, [], {}, { code: 123 }, { code: '' }, { code: 'A B' }, { code: '<script>' }, { code: 'A'.repeat(65) }, { code: 'OK', note: 'x'.repeat(501) }]) {
    assert.equal((await f.route.POST(request('POST', body))).status, 400);
  }
  assert.equal((await f.route.POST(new Request('https://test.local', { method: 'POST', headers: { authorization: 'Bearer alice' }, body: '{' }))).status, 400);
  assert.equal(f.rows.length, 0);
  assert.equal(f.qrInputs.length, 0);
});
