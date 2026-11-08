import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
let fetchImpl = () => { throw new Error('Unexpected network request'); };
function load(path, imports = {}) {
  const fixtureModule = { exports: {} };
  const source = fs.readFileSync(new URL(`../src/lib/${path}.ts`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  new Function('exports', 'require', 'module', 'fetch', code)(fixtureModule.exports, name => imports[name] || require(name), fixtureModule, (...args) => fetchImpl(...args));
  return fixtureModule.exports;
}
const data = load('salesData');
const excel = load('salesExcel', { './salesData': data });
const base = { ...data.defaultSalesFilters };
const makeOrder = (id, overrides = {}) => ({
  id, code: `DH-${id}`, ledger_id: 'ledger', sale_channel: 'pos', sale_channel_inferred: false,
  customer_name: 'Khách lẻ', customer_contact: '0901234567', ordered_at: '2026-11-08T05:00:00Z', payment_status: 'paid', status: 'confirmed',
  shipping_fee: 10000, shipping_cost: 5000, other_fee: 1000, discount: 0, capital_cost: 10000, total: 50000, profit: 34000, item_count: 2,
  items: [{ product_id: 'p', product_name: 'Cà phê sữa', quantity: 2, unit_price: 20000, unit_cost: 5000, note: 'Ít đá' }], ...overrides,
});
const orders = [makeOrder('1'), makeOrder('2', { sale_channel: 'inventory', payment_status: 'pending', ordered_at: '2026-11-07T17:30:00Z' }), makeOrder('3', { sale_channel: 'unknown', ordered_at: '2026-11-06T05:00:00Z' }), makeOrder('4', { status: 'cancelled' })];
const report = { stock_value: 20000, stock_units: 1, expenses: [{ spent_at: '2026-11-08T05:00:00Z', amount: 3000, category: 'Đóng gói', note: '=test' }, { spent_at: '2026-10-01T05:00:00Z', amount: 7000, category: 'Cũ' }] };

test('Filters compose channel, inclusive Vietnam dates, payment and product/contact search', () => {
  assert.equal(data.salesDay('2026-11-07T17:30:00Z'), '2026-11-08');
  const filtered = data.filterSalesOrders(orders, { ...base, channel: 'inventory', from: '2026-11-08', to: '2026-11-08', payment: 'pending', query: 'cà phê' });
  assert.deepEqual(filtered.map(order => order.id), ['2']);
  assert.equal(data.filterSalesOrders(orders, { ...base, query: '0901234567' }).length, 4);
  assert.deepEqual(data.filterSalesOrders(orders, { ...base, channel: 'unknown' }).map(order => order.id), ['3']);
});

test('Daily groups are separate, newest first and use Vietnam date boundaries without mutating orders', () => {
  const original = orders.map(order => order.id);
  const groups = data.groupSalesOrders(orders);
  assert.deepEqual(groups.map(([day]) => day), ['2026-11-08', '2026-11-06']);
  assert.equal(groups[0][1].length, 3);
  assert.deepEqual(orders.map(order => order.id), original);
});

test('Order status filters keep cancelled details separate from financial totals', () => {
  assert.deepEqual(data.filterSalesOrders(orders, { ...base, status: 'cancelled' }).map(order => order.id), ['4']);
  const tables = excel.salesExportTables({ orders, report, filters: { ...base, status: 'cancelled' }, sections: ['orders', 'products', 'items'] });
  assert.equal(tables.find(table => table.key === 'orders').rows.length, 1);
  assert.equal(tables.find(table => table.key === 'products').rows.length, 0);
  assert.equal(tables.find(table => table.key === 'items').rows[0].at(-1), 'Đã hủy');
});

test('History renders distinct daily sections and source blocks while retaining every order action slot', () => {
  const fixtureModule = { exports: {} };
  const source = fs.readFileSync(new URL('../src/components/OrderHistory.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { fileName: 'OrderHistory.tsx', compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const picker = ({ label, value }) => React.createElement('button', { 'aria-label': label }, value);
  const imports = { '@/lib/salesData': data, '@/app/business/expenses/FinancePicker': { FinanceDatePicker: picker, FinanceSelect: picker } };
  new Function('exports', 'require', 'module', code)(fixtureModule.exports, name => imports[name] || require(name), fixtureModule);
  const html = renderToStaticMarkup(React.createElement(fixtureModule.exports.default, { orders, filters: base, loading: false, onChange() {}, renderOrder: order => React.createElement('article', { key: order.id, 'data-order': order.id }, order.code) }));
  assert.equal((html.match(/class="order-day-group /g) || []).length, 2);
  for (const order of orders) assert.equal((html.match(new RegExp(`data-order="${order.id}"`, 'g')) || []).length, 1);
  assert.ok(html.includes('Bán tại quầy'));
  assert.ok(html.includes('Đơn từ kho'));
  assert.ok(html.includes('Chưa phân loại'));
});

test('Filtered financial totals exclude cancelled orders and do not assign shared expenses to a channel', () => {
  const filtered = data.filteredSalesReport(orders, report, { ...base, from: '2026-11-08', to: '2026-11-08' });
  assert.equal(filtered.order_count, 2);
  assert.equal(filtered.revenue, 100000);
  assert.equal(filtered.gross_profit, 60000);
  assert.equal(filtered.operating_expense, 3000);
  assert.equal(filtered.net_profit, 65000);
  const pos = data.filteredSalesReport(orders, report, { ...base, channel: 'pos' });
  assert.equal(pos.order_count, 1);
  assert.equal(pos.operating_expense, 0);
  assert.equal(pos.net_profit, 34000);
});

test('Full ledger loading paginates beyond the former 100-order cap and passes scope/auth', async () => {
  const rows = Array.from({ length: 501 }, (_, index) => makeOrder(String(index)));
  const calls = [];
  fetchImpl = async (url, options) => {
    const query = new URL(url, 'https://test.local').searchParams;
    calls.push({ query, options });
    return Response.json(rows.slice(Number(query.get('offset')), Number(query.get('offset')) + Number(query.get('limit'))));
  };
  assert.equal((await data.loadLedgerOrders('ledger', { Authorization: 'Bearer owner' })).length, 501);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].query.get('offset'), '500');
  assert.equal(calls[1].query.get('ledger_id'), 'ledger');
  assert.equal(calls[1].options.headers.Authorization, 'Bearer owner');
});

test('Failed or non-paginated API responses cannot silently produce a partial export', async () => {
  await assert.rejects(data.loadLedgerOrders('', {}), /Chọn sổ/);
  fetchImpl = async () => new Response('', { status: 401 });
  await assert.rejects(data.loadLedgerOrders('ledger', {}));
  fetchImpl = async () => Response.json(Array.from({ length: 500 }, (_, index) => makeOrder(String(index))));
  await assert.rejects(data.loadLedgerOrders('ledger', {}), /tải lại/);
});

test('XLSX contains only chosen sections, filtered rows, numeric money, Unicode and real dates', async () => {
  const result = await excel.createSalesExport({ orders, report, filters: { ...base, channel: 'inventory' }, sections: ['orders', 'items'], format: 'xlsx', ledgerName: 'Tháng 11' });
  assert.deepEqual([...result.bytes.slice(0, 2)], [0x50, 0x4b]);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(result.bytes);
  assert.equal(book.worksheets.length, 2);
  const details = book.worksheets[0];
  assert.equal(details.rowCount, 3);
  assert.equal(details.getCell('B3').value, 'DH-2');
  assert.equal(details.getCell('L3').value, 50000);
  assert.equal(details.getCell('A3').value.toISOString().slice(0, 10), '2026-11-08');
  assert.equal(book.worksheets[1].getCell('E3').value, 'Cà phê sữa');
  assert.equal(book.worksheets[1].getCell('J3').value, 'Ít đá');
  assert.ok(details.autoFilter);
});

test('XLS is a real BIFF workbook and preserves multiple sheets and Vietnamese text', async () => {
  const result = await excel.createSalesExport({ orders, filters: { ...base, channel: 'inventory' }, sections: ['orders', 'products'], format: 'xls', ledgerName: 'Sổ thử' });
  assert.deepEqual([...result.bytes.slice(0, 4)], [0xd0, 0xcf, 0x11, 0xe0]);
  const book = XLSX.read(result.bytes, { type: 'array' });
  assert.equal(book.SheetNames.length, 2);
  const rows = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[1]], { header: 1 });
  assert.equal(rows[1][0], 'Cà phê sữa');
  assert.equal(rows[1][1], 2);
  assert.equal(rows[1][2], 40000);
});

test('CSV protects formula-like text, quotes separators and requires exactly one section', async () => {
  const dangerous = makeOrder('csv', { customer_name: '=1+1', note: 'Có, dấu "nháy" và\nxuống dòng' });
  const result = await excel.createSalesExport({ orders: [dangerous], filters: base, sections: ['orders'], format: 'csv', ledgerName: 'CSV' });
  assert.deepEqual([...result.bytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
  const rows = XLSX.utils.sheet_to_json(XLSX.read(result.bytes, { type: 'array', raw: true }).Sheets.Sheet1, { header: 1 });
  assert.equal(rows[1][4], "'=1+1");
  assert.equal(rows[1][19], dangerous.note);
  await assert.rejects(excel.createSalesExport({ orders, filters: base, sections: ['orders', 'items'], format: 'csv', ledgerName: '' }), /một nội dung/);
});

test('Empty section selection is rejected and an empty valid selection still has headers', async () => {
  await assert.rejects(excel.createSalesExport({ orders, filters: base, sections: [], format: 'xlsx', ledgerName: '' }), /ít nhất/);
  const result = await excel.createSalesExport({ orders: [], filters: base, sections: ['orders'], format: 'xlsx', ledgerName: '' });
  const book = new ExcelJS.Workbook(); await book.xlsx.load(result.bytes);
  assert.equal(book.worksheets[0].rowCount, 2);
});
