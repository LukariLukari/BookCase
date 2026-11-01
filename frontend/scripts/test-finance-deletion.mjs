// Uses in-memory database doubles; never connects to or modifies a live database.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function loadRoute(name, prisma, authenticated = true) {
  const source = fs.readFileSync(new URL(`../src/app/api/business/finance/${name}/route.ts`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  const imports = {
    'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } },
    '@/lib/auth': { getRequestUser: () => authenticated ? { id: 'owner' } : null },
    '@/lib/db': { prisma },
  };
  vm.runInNewContext(code, { exports, require: name => {
    assert.ok(name in imports, `Unexpected import: ${name}`);
    return imports[name];
  }, Date, Set });
  return exports;
}

function fixture() {
  let rows = [
    { id: 'income', userId: 'owner', bookId: 'book', accountId: 'cash', type: 'income', amount: 100 },
    { id: 'expense', userId: 'owner', bookId: 'book', accountId: 'cash', type: 'expense', amount: 30 },
    { id: 'transfer', userId: 'owner', bookId: 'book', accountId: 'cash', destinationAccountId: 'bank', type: 'transfer', amount: 20 },
    { id: 'foreign', userId: 'other', bookId: 'foreign-book', type: 'income', amount: 999 },
    { id: 'other-book', userId: 'owner', bookId: 'second-book', type: 'income', amount: 999 },
  ];
  let mutations = 0;
  const accounts = [{ id: 'cash', openingBalance: 50 }, { id: 'bank', openingBalance: 10 }];
  const prisma = {
    expenseBook: {
      findFirst: async ({ where }) => where.userId === 'owner' && where.id === 'book' ? { id: 'book' } : null,
      findMany: async () => [{ id: 'book', name: 'Test', defaultCurrency: 'VND', accounts: accounts.map(account => ({
        ...account, name: account.id, type: 'cash', currency: 'VND', creditLimit: null, editHistory: [],
        transactions: rows.filter(row => row.accountId === account.id),
        incomingTransfers: rows.filter(row => row.destinationAccountId === account.id),
      })) }],
    },
    financeTransaction: { deleteMany: async ({ where }) => {
      mutations++;
      const remaining = rows.filter(row => !(row.userId === where.userId && row.bookId === where.bookId && where.id.in.includes(row.id)));
      const count = rows.length - remaining.length;
      rows = remaining;
      return { count };
    } },
  };
  return { prisma, rows: () => rows, mutations: () => mutations };
}
const request = body => new Request('https://test.local/api/business/finance/transactions', { method: 'DELETE', body: JSON.stringify(body) });

test('Bulk deletion requires authentication and a nonempty explicit selection', async () => {
  const f = fixture();
  assert.equal((await loadRoute('transactions', f.prisma, false).DELETE(request({ bookId: 'book', ids: ['income'] }))).status, 401);
  const route = loadRoute('transactions', f.prisma);
  for (const body of [null, {}, { bookId: 'book', ids: [] }, { bookId: 'book', ids: [''] }, { bookId: 'book', ids: [1] }]) {
    assert.equal((await route.DELETE(request(body))).status, 400);
  }
  assert.equal((await route.DELETE(new Request('https://test.local', { method: 'DELETE', body: '{' }))).status, 400);
  assert.equal(f.mutations(), 0);
});

test('Deletion stays within the authenticated book and confirmed IDs; retries are safe', async () => {
  const f = fixture(), route = loadRoute('transactions', f.prisma);
  assert.equal((await route.DELETE(request({ bookId: 'foreign-book', ids: ['foreign'] }))).status, 404);
  assert.equal(f.mutations(), 0);
  const body = { bookId: 'book', ids: ['income', 'income', 'foreign', 'other-book', 'missing'] };
  assert.equal((await (await route.DELETE(request(body))).json()).deletedCount, 1);
  assert.deepEqual(f.rows().map(row => row.id), ['expense', 'transfer', 'foreign', 'other-book']);
  assert.equal((await (await route.DELETE(request(body))).json()).deletedCount, 0);
});

test('Deleting income, expense and transfers restores both wallet balances to opening balances', async () => {
  const f = fixture(), route = loadRoute('transactions', f.prisma), books = loadRoute('books', f.prisma);
  const balances = async () => (await (await books.GET(request({}))).json())[0].accounts.map(account => [account.balance, account.transactionCount]);
  assert.deepEqual(await balances(), [[100, 3], [30, 1]]);
  await route.DELETE(request({ bookId: 'book', ids: ['expense'] }));
  assert.deepEqual(await balances(), [[130, 2], [30, 1]]);
  await route.DELETE(request({ bookId: 'book', ids: ['transfer'] }));
  assert.deepEqual(await balances(), [[150, 1], [10, 0]]);
  await route.DELETE(request({ bookId: 'book', ids: ['income'] }));
  assert.deepEqual(await balances(), [[50, 0], [10, 0]]);
  assert.equal(f.rows().filter(row => row.bookId === 'book').length, 0);
});

test('A failed atomic deletion is not reported as success', async () => {
  const f = fixture();
  f.prisma.financeTransaction.deleteMany = async () => { throw new Error('Database unavailable'); };
  await assert.rejects(loadRoute('transactions', f.prisma).DELETE(request({ bookId: 'book', ids: ['income', 'expense'] })), /Database unavailable/);
  assert.equal(f.rows().length, 5);
});


test('Delete all removes the complete confirmed selection in a single operation', async () => {
  const f = fixture(), route = loadRoute('transactions', f.prisma);
  const result = await route.DELETE(request({ bookId: 'book', ids: ['income', 'expense', 'transfer'] }));
  assert.equal((await result.json()).deletedCount, 3);
  assert.equal(f.mutations(), 1);
  assert.deepEqual(f.rows().map(row => row.id), ['foreign', 'other-book']);
});
