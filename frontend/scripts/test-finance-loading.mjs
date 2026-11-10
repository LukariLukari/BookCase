import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file, globals = {}) {
  const exports = {};
  const source = fs.readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, AbortController, DOMException, TypeError, Error, setTimeout, clearTimeout, ...globals });
  return exports;
}

test('Successful finance reads use fresh data and do not retry or write', async () => {
  let calls = 0;
  const { fetchFinanceData } = load('lib/financeFetch.ts', { fetch: async (url, options) => {
    calls++; assert.equal(url, '/books'); assert.equal(options.cache, 'no-store'); assert.equal(options.method, undefined);
    return Response.json({ books: [] });
  } });
  assert.deepEqual(JSON.parse(JSON.stringify(await fetchFinanceData('/books', { Authorization: 'Bearer own' }))), { books: [] });
  assert.equal(calls, 1);
});

test('Retry transient read failures once; preserve auth and validation failures', async () => {
  for (const status of [502, 503, 504, 401, 400, 404]) {
    let calls = 0;
    const { fetchFinanceData } = load('lib/financeFetch.ts', { fetch: async () => { calls++; return calls === 1 ? Response.json({ detail: 'failure' }, { status }) : Response.json({ ok: true }); } });
    if (status >= 500) assert.equal((await fetchFinanceData('/books', {})).ok, true);
    else await assert.rejects(fetchFinanceData('/books', {}), /failure/);
    assert.equal(calls, status >= 500 ? 2 : 1);
  }
});

test('A disconnected read retries once, then surfaces the error', async () => {
  let calls = 0;
  const { fetchFinanceData } = load('lib/financeFetch.ts', { fetch: async () => { calls++; throw new TypeError('offline'); } });
  await assert.rejects(fetchFinanceData('/books', {}), /offline/); assert.equal(calls, 2);
});

test('Switching books aborts a pending request without retrying it', async () => {
  let calls = 0;
  const controller = new AbortController();
  const { fetchFinanceData } = load('lib/financeFetch.ts', { fetch: async (_url, { signal }) => {
    calls++; return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
  } });
  const pending = fetchFinanceData('/old-book', {}, controller.signal);
  controller.abort();
  await assert.rejects(pending, error => error.name === 'AbortError'); assert.equal(calls, 1);
  await assert.rejects(fetchFinanceData('/new-book', {}, controller.signal), error => error.name === 'AbortError'); assert.equal(calls, 1);
});

test('Timeouts stop a hung read and keep the retry budget bounded', async () => {
  let calls = 0;
  const { fetchFinanceData } = load('lib/financeFetch.ts', {
    setTimeout: callback => setTimeout(callback, 5),
    fetch: async (_url, { signal }) => { calls++; return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Timeout', 'AbortError')), { once: true })); },
  });
  await assert.rejects(fetchFinanceData('/books', {}), /Kết nối đang chậm/); assert.equal(calls, 2);
});

test('SQL snapshots scope every finance table to the authenticated owner', () => {
  const { financeReadQuery } = load('lib/financeRead.ts');
  for (const kind of ['bootstrap', 'books', 'categories', 'transactions']) {
    const { text, values } = financeReadQuery(kind, 'owner', 'book');
    assert.match(text, /"User" WHERE "id" = \$1/);
    assert.equal(text.includes("'owner'"), false);
    assert.match(text, /"userId" = \(SELECT "id" FROM actor\)/);
    assert.equal(values[0], 'owner');
    if (kind !== 'categories') assert.match(text, /YYYY-MM-DD"T"HH24:MI:SS.MS"Z"/);
  }
});
