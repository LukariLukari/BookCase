import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../src/app/business/expenses/transactionUpdates.ts', import.meta.url), 'utf8');
const exports = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports });
const { accountDelta, categoryDelta, mergeTransaction } = exports;
const row = (patch = {}) => ({ id: 'one', type: 'expense', amount: 30, categoryId: 'food', date: '2026-11-02T05:00:00.000Z', createdAt: '2026-11-02T06:00:00.000Z', account: { id: 'cash' }, destinationAccount: null, ...patch });
const delta = (...args) => ({ ...accountDelta(...args) });

test('Confirmed income and expense update only their wallet and category', () => {
  assert.deepEqual(delta('cash', row()), { balance: -30, count: 1 });
  assert.deepEqual(delta('cash', row({ type: 'income' })), { balance: 30, count: 1 });
  assert.deepEqual(delta('bank', row()), { balance: 0, count: 0 });
  assert.equal(categoryDelta('food', row()), 1);
});

test('Transfers update both wallets without contributing to category counts', () => {
  const transfer = row({ type: 'transfer', categoryId: null, destinationAccount: { id: 'bank' } });
  assert.deepEqual(delta('cash', transfer), { balance: -30, count: 1 });
  assert.deepEqual(delta('bank', transfer), { balance: 30, count: 1 });
  assert.equal(categoryDelta('food', transfer), 0);
});

test('Editing reverses the old amount, type, wallet and category before applying the result', () => {
  const previous = row();
  const saved = row({ type: 'income', amount: 50, categoryId: 'salary', account: { id: 'bank' } });
  assert.deepEqual(delta('cash', saved, previous), { balance: 30, count: -1 });
  assert.deepEqual(delta('bank', saved, previous), { balance: 50, count: 1 });
  assert.equal(categoryDelta('food', saved, previous), -1);
  assert.equal(categoryDelta('salary', saved, previous), 1);
  assert.deepEqual(delta('cash', row({ amount: 40 }), previous), { balance: -10, count: 0 });
  assert.equal(categoryDelta('food', row({ amount: 40 }), previous), 0);
});

test('Editing transfer direction reverses both original wallet effects', () => {
  const previous = row({ type: 'transfer', destinationAccount: { id: 'bank' }, categoryId: null });
  const saved = row({ type: 'transfer', amount: 20, account: { id: 'bank' }, destinationAccount: { id: 'cash' }, categoryId: null });
  assert.deepEqual(delta('cash', saved, previous), { balance: 50, count: 0 });
  assert.deepEqual(delta('bank', saved, previous), { balance: -50, count: 0 });
});

test('Incremental merge orders backdated entries and edits, without duplicates or mutation', () => {
  const items = [row(), row({ id: 'old', date: '2026-10-01T05:00:00.000Z' })];
  const saved = row({ id: 'middle', date: '2026-10-15T05:00:00.000Z' });
  assert.deepEqual(Array.from(mergeTransaction(items, saved), item => item.id), ['one', 'middle', 'old']);
  assert.deepEqual(Array.from(mergeTransaction(items, row({ date: '2026-09-01T05:00:00.000Z' })), item => item.id), ['old', 'one']);
  assert.deepEqual(Array.from(mergeTransaction(items, row({ id: 'new', createdAt: '2026-11-02T07:00:00.000Z' })), item => item.id), ['new', 'one', 'old']);
  assert.equal(items.length, 2);
  assert.equal(items[0].date, '2026-11-02T05:00:00.000Z');
});
