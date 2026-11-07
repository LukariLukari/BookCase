import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchApi, matchRoute } from '../cloudflare/router.mjs';
import { NextRequest } from '../cloudflare/next-server.mjs';
import { serveStaticPage } from '../cloudflare/static-pages.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function readFixture(rows, claims = null, fail = false) {
  const calls = [];
  let ended = 0;
  class Client {
    async connect() { if (fail) throw new Error('PRIVATE_CONNECTION_DETAIL'); }
    async query(text, values) { calls.push({ text, values }); return { rows }; }
    async end() { ended++; }
  }
  const source = fs.readFileSync(new URL('../cloudflare/read-api.mjs', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { allowJs: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  const imports = {
    pg: { Client },
    '../src/lib/auth.ts': { getRequestUser: () => claims, verifyJwt: () => claims },
    './context.mjs': { getCloudflareContext: () => ({ env: { HYPERDRIVE: { connectionString: 'test-only' } } }) },
  };
  vm.runInNewContext(code, { exports, Response, URL, console: { error() {} }, require: name => imports[name] });
  return { read: exports.readApi, calls, ended: () => ended };
}

test('SQL read routes require admin access and always release connections', async () => {
  const denied = readFixture([], { id: 'seller', role: 'user' });
  assert.equal((await denied.read(new Request('https://test.local/api/admin/registration-codes'))).status, 403);
  assert.equal(denied.calls.length, 0);
  const allowed = readFixture([{ id: 'code', code: 'TEST', is_used: false }], { id: 'admin', role: 'admin' });
  const response = await allowed.read(new Request('https://test.local/api/admin/registration-codes'));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal((await response.json())[0].code, 'TEST');
  assert.equal(allowed.ended(), 1);
  const failed = readFixture([], null, true);
  const failure = await failed.read(new Request('https://test.local/api/health'));
  assert.equal(failure.status, 503);
  assert.equal((await failure.text()).includes('PRIVATE_CONNECTION_DETAIL'), false);
  assert.equal(failed.ended(), 1);
});

test('Account listing uses parameterized identity and checks the current database role', async () => {
  const f = readFixture([{ authenticated: true, allowed: false, users: [] }], { id: "seller' OR 1=1--", role: 'admin' });
  const response = await f.read(new Request('https://test.local/api/backend/api/admin/users', { headers: { authorization: 'Bearer token' } }));
  assert.equal(response.status, 403);
  assert.equal(f.calls[0].text.includes("seller' OR 1=1--"), false);
  assert.equal(f.calls[0].values[0], "seller' OR 1=1--");
  assert.match(f.calls[0].text, /actor WHERE "role" = 'admin'/);
  assert.equal(f.ended(), 1);
});

test('API routing decodes identifiers, keeps catch-all segments and rejects ambiguous paths', () => {
  assert.deepEqual(matchRoute(['api', 'items', '[id]'], '/api/items/a%20b'), { id: 'a b' });
  assert.deepEqual(matchRoute(['api', 'backend', '[...path]'], '/api/backend/api/business/orders'), { path: ['api', 'business', 'orders'] });
  assert.equal(matchRoute(['api', 'items', '[id]'], '/api/items'), null);
  assert.equal(matchRoute(['api', 'items'], '/api/items/extra'), null);
  assert.equal(matchRoute(['api', 'backend', '[...path]'], '/api/backend'), null);
});

test('API dispatch preserves authorization and request/parameter semantics without caching private data', async () => {
  const routes = [{ pattern: ['api', 'items', '[id]'], load: async () => ({ GET: async (request, context) => {
    if (request.headers.get('Authorization') !== 'Bearer owner') return Response.json({ detail: 'Denied' }, { status: 401 });
    return Response.json({ id: (await context.params).id, query: request.nextUrl.searchParams.get('q') }, { headers: { 'Cache-Control': 'public, max-age=60' } });
  } }) }];
  const url = 'https://test.local/api/items/a%20b?q=search';
  assert.equal((await dispatchApi(new Request(url), routes, NextRequest)).status, 401);
  const response = await dispatchApi(new Request(url, { headers: { Authorization: 'Bearer owner' } }), routes, NextRequest);
  assert.deepEqual(await response.json(), { id: 'a b', query: 'search' });
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.equal((await dispatchApi(new Request(url, { method: 'DELETE' }), routes, NextRequest)).status, 405);
  const options = await dispatchApi(new Request(url, { method: 'OPTIONS' }), routes, NextRequest);
  assert.equal(options.status, 204);
  assert.match(options.headers.get('Allow'), /GET/);
  assert.match(options.headers.get('Allow'), /HEAD/);
  const head = await dispatchApi(new Request(url, { method: 'HEAD', headers: { Authorization: 'Bearer owner' } }), routes, NextRequest);
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
});

test('Malformed URLs and absent routes fail without executing a handler', async () => {
  const routes = [{ pattern: ['api', '[id]'], load: () => { throw new Error('Must not load'); } }];
  assert.equal((await dispatchApi(new Request('https://test.local/api/%ZZ'), routes, NextRequest)).status, 400);
  assert.equal((await dispatchApi(new Request('https://test.local/unknown'), routes, NextRequest)).status, 404);
});

test('Static HTML, RSC and segment prefetch use separate artifacts and preserve redirects', async () => {
  const pages = {
    '/login': { html: '/static/html.data', rsc: '/static/page.data', segments: { '/_tree': '/static/tree.data' }, headers: { 'x-next-cache-tags': 'internal' }, status: 200 },
    '/old': { html: '/unused', headers: { location: '/login' }, status: 307, segments: {} },
  };
  const assets = { fetch: async request => Response.json({ path: new URL(request.url).pathname }) };
  const request = headers => new Request('https://test.local/login?source=test', { headers });
  const html = await serveStaticPage(request({}), assets, pages);
  assert.equal(html.headers.get('Content-Type'), 'text/html; charset=utf-8');
  assert.equal(html.headers.has('x-next-cache-tags'), false);
  assert.equal((await html.json()).path, '/static/html.data');
  const rsc = await serveStaticPage(request({ rsc: '1' }), assets, pages);
  assert.equal(rsc.headers.get('Content-Type'), 'text/x-component');
  assert.equal((await rsc.json()).path, '/static/page.data');
  const segment = await serveStaticPage(request({ rsc: '1', 'next-router-segment-prefetch': '/_tree' }), assets, pages);
  assert.equal((await segment.json()).path, '/static/tree.data');
  assert.equal(await serveStaticPage(request({ rsc: '1', 'next-router-segment-prefetch': '/unknown' }), assets, pages), null);
  assert.equal(await serveStaticPage(new Request('https://test.local/login', { method: 'POST' }), assets, pages), null);
  assert.equal(await serveStaticPage(new Request('https://test.local/private-dynamic-page'), assets, pages), null);
  const redirect = await serveStaticPage(new Request('https://test.local/old'), assets, pages);
  assert.equal(redirect.status, 307);
  assert.equal(redirect.headers.get('Location'), '/login');
});
