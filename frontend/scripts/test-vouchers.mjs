// In-memory storage only: these checks never connect to a database.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import bwipjs from 'bwip-js/node';
import { PNG } from 'pngjs';
import { RGBLuminanceSource, HybridBinarizer, BinaryBitmap, MultiFormatReader, BarcodeFormat, DecodeHintType } from '@zxing/library';

function load(file, imports = {}) {
  const source = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => { assert.ok(name in imports, name); return imports[name]; } });
  return exports;
}
const util = load('src/lib/vouchers.ts');
const barcode = load('src/lib/voucherBarcode.ts', { 'bwip-js/node': bwipjs });
const lookup = load('src/lib/voucherLookup.ts', { './vouchers': util });
const request = (method = 'GET', body, owner = 'alice') => new Request('https://test.local/api/sales/vouchers', { method, headers: owner ? { authorization: `Bearer ${owner}` } : {}, ...(body === undefined ? {} : { body: JSON.stringify(body && typeof body==='object' && 'code' in body ? {benefitType:'amount',benefitValue:5000,...body} : body) }) });

function fixture() {
  const rows = [], barcodeInputs = [], backups = [];
  const prisma = { businessVoucher: {
    findFirst: async ({where}) => {const row=rows.find(row=>row.userId===where.userId && (where.id ? row.id===where.id : row.code===where.code));return row?{id:row.id,code:row.code,note:row.note,benefitType:row.benefitType,benefitValue:row.benefitValue,benefitText:row.benefitText}:null;},
    update: async ({where,data}) => { const row=rows.find(row=>row.id===where.id);Object.assign(row,data);const {userId,...result}=row;return result; },
    findMany: async ({ where }) => rows.filter(row => row.userId === where.userId).map(({ userId, ...row }) => row),
    create: async ({ data }) => {
      if (rows.some(row => row.userId === data.userId && row.code === data.code)) throw { code: 'P2002' };
      const row = { id: `123e4567-e89b-42d3-a456-${String(rows.length).padStart(12, '0')}`, createdAt: new Date('2026-11-07T00:00:00Z'), ...data };
      rows.push(row);
      const { userId, ...result } = row;
      return result;
    },
  } };
  const route = load('src/app/api/sales/vouchers/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } },
    '@/lib/voucherBarcode': { makeVoucherBarcode: async id => { barcodeInputs.push(id); return barcode.makeVoucherBarcode(id); } },
    '@/lib/auth': { getRequestUser: req => { const owner = req.headers.get('authorization')?.slice(7); return ['alice', 'bob'].includes(owner) ? { id: owner } : null; } },
    '@/lib/db': { prisma },
    '@/lib/businessBackup': { createAutomaticBusinessBackup: async id => backups.push(id) },
    '@/lib/vouchers': util,
  });
  const resolve = load('src/app/api/sales/vouchers/resolve/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } },
    '@/lib/auth': { getRequestUser: req => {const id=req.headers.get('authorization')?.slice(7);return ['alice','bob'].includes(id)?{id}:null;} },
    '@/lib/db': { prisma }, '@/lib/voucherLookup': lookup,
  });
  return { route, resolve, rows, barcodeInputs, backups };
}

test('Listing and creating vouchers require authentication', async () => {
  const f = fixture();
  assert.equal((await f.route.GET(request('GET', undefined, null))).status, 401);
  assert.equal((await f.route.POST(request('POST', { code: 'test' }, null))).status, 401);
  assert.equal(f.rows.length, 0);
});

test('Saved codes normalize to uppercase and produce the same permanent barcode after reloading', async () => {
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
  assert.equal(saved.barcodeDataUrl, voucher.barcodeDataUrl);
  assert.deepEqual(f.barcodeInputs, [voucher.id, voucher.id]);
  const png = Buffer.from(saved.barcodeDataUrl.split(',')[1], 'base64');
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  const decoded = PNG.sync.read(png);
  const luminance = new Uint8ClampedArray(decoded.width * decoded.height);
  for(let i=0;i<luminance.length;i++)luminance[i]=decoded.data[i*4];
  const reader = new MultiFormatReader();
  const result = reader.decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(luminance,decoded.width,decoded.height))), new Map([[DecodeHintType.POSSIBLE_FORMATS,[BarcodeFormat.CODE_128]]]));
  assert.equal(result.getText(), barcode.voucherBarcodePayload(voucher.id));
  const applied=await f.resolve.POST(request('POST',{value:result.getText()}));
  assert.equal(applied.status,200);
  assert.equal((await applied.json()).code,voucher.code);
  assert.equal((await f.resolve.POST(request('POST',{value:result.getText()},'bob'))).status,404);
});

test('Duplicate codes are rejected within an owner, while other owners stay isolated', async () => {
  const f = fixture();
  const results = await Promise.all([f.route.POST(request('POST', { code: 'welcome' })), f.route.POST(request('POST', { code: 'WELCOME' }))]);
  assert.deepEqual(results.map(result => result.status).sort(), [201, 409]);
  assert.equal((await f.route.GET(request('GET', undefined, 'bob')).then(result => result.json())).length, 0);
  assert.equal((await f.route.POST(request('POST', { code: 'welcome' }, 'bob'))).status, 201);
  assert.equal((await f.route.GET(request()).then(result => result.json())).length, 1);
});

test('Malformed codes and bodies cannot create vouchers or generate barcode images', async () => {
  const f = fixture();
  for (const body of [null, [], {}, { code: 123 }, { code: '' }, { code: 'A B' }, { code: '<script>' }, { code: 'A'.repeat(65) }, { code: 'OK', note: 'x'.repeat(501) }]) {
    assert.equal((await f.route.POST(request('POST', body))).status, 400);
  }
  assert.equal((await f.route.POST(new Request('https://test.local', { method: 'POST', headers: { authorization: 'Bearer alice' }, body: '{' }))).status, 400);
  assert.equal(f.rows.length, 0);
  assert.equal(f.barcodeInputs.length, 0);
});

test('Voucher lookup accepts manual codes, rejects unknown and foreign barcodes, and requires authentication', async () => {
  const f=fixture();
  await f.route.POST(request('POST',{code:'CAMON'}));
  assert.equal((await f.resolve.POST(request('POST',{value:'camon'}))).status,200);
  assert.equal((await f.resolve.POST(request('POST',{value:'CAMON'},'bob'))).status,404);
  assert.equal((await f.resolve.POST(request('POST',{value:'UNKNOWN'}))).status,404);
  assert.equal((await f.resolve.POST(request('POST',{value:'BV:missing'}))).status,404);
  assert.equal((await f.resolve.POST(request('POST',{value:'CAMON'},null))).status,401);
  for(const value of ['',null,123,'x'.repeat(129)])assert.equal((await f.resolve.POST(request('POST',{value}))).status,400);
});

test('Benefits reject invalid discounts and edits preserve the barcode and account ownership', async () => {
  const f=fixture();
  for(const benefit of [
    {benefitType:'none'}, {benefitType:'amount',benefitValue:-1},
    {benefitType:'amount',benefitValue:1.5}, {benefitType:'percent',benefitValue:101},
    {benefitType:'percent',benefitValue:0}, {benefitType:'custom',benefitText:''},
  ]) assert.equal((await f.route.POST(request('POST',{code:'INVALID',...benefit}))).status,400);
  const first=await f.route.POST(request('POST',{code:'GIFT',benefitType:'custom',benefitText:'Tặng một ly cà phê'})).then(r=>r.json());
  const patch={id:first.id,benefitType:'percent',benefitValue:10,note:'Khách thân thiết'};
  assert.equal((await f.route.PATCH(request('PATCH',patch,'bob'))).status,404);
  assert.equal((await f.route.PATCH(request('PATCH',patch,null))).status,401);
  const edited=await f.route.PATCH(request('PATCH',patch)).then(r=>r.json());
  assert.equal(edited.code,first.code);
  assert.equal(edited.barcodeDataUrl,first.barcodeDataUrl);
  assert.equal(edited.benefitType,'percent');
  assert.equal(edited.benefitValue,10);
});
