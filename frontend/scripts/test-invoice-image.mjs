import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../src/app/business/BusinessClient.tsx', import.meta.url), 'utf8');
const start = source.indexOf('async function createPixelOrderCloseImage(');
const tail = " return canvas.toDataURL('image/png');\n}";
const end = source.indexOf(tail, start) + tail.length;
const code = ts.transpileModule(source.slice(start, end) + '\nexports.render = createPixelOrderCloseImage;', { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
async function render(items, overrides = {}, settings = {}) {
  const draws = [], borders = [], canvases = [], payment = [];
  const context = {
    font: '', textAlign: 'left',
    measureText(text) { return { width: Array.from(text).length * Number(this.font.match(/(\d+)px/)?.[1] || 20) * .58 }; },
    fillText(text, x, y) { draws.push({ text, x, y, font: this.font }); },
    strokeRect(...rect) { borders.push(rect); },
    fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, drawImage() {},
  };
  const document = { createElement() { const canvas = { width: 0, height: 0, getContext: () => context, toDataURL: () => 'data:image/png;base64,test' }; canvases.push(canvas); return canvas; } };
  const exports = {};
  vm.runInNewContext(code, { exports, document, console, ensureMontserratLoaded: async () => {}, cash: n => new Intl.NumberFormat('vi-VN').format(n) + ' đ', dateText: () => '8/11/2026', renderBankQrToCanvas: async (_canvas, value) => payment.push(value) });
  await exports.render({ code: 'DH-0010', customer_name: 'Khách lẻ', total: 80000, shipping_fee: 0, discount: 0, items, ...overrides }, { shopName: 'Billy Shop', bankName: 'MB Bank', accountNumber: '0123456789', accountName: 'NGUYEN VAN A', ...settings }, '');
  return { draws, borders, canvas: canvases[0], payment };
}
const item = name => ({ product_name: name, quantity: 1, unit_price: 40000 });
test('One frame contains large items, totals and QR with the correct payment payload', async () => {
  const result = await render([item('Cà phê sữa'), item('Eggu Original')]);
  assert.equal(result.borders.length, 1);
  assert.ok(result.draws.some(draw => draw.text === 'Cà phê sữa' && draw.font.includes('32px')));
  assert.ok(result.draws.some(draw => draw.text === '40.000 đ' && draw.font.includes('30px')));
  assert.ok(result.draws.find(draw => draw.text === 'QUÉT MÃ ĐỂ THANH TOÁN').y > result.draws.find(draw => draw.text === 'TỔNG CỘNG').y);
  assert.equal(result.payment[0].amount, 80000);
  assert.equal(result.payment[0].memo, 'DH-0010');
  assert.ok(result.draws.every(draw => draw.y < result.canvas.height - 20));
});
test('Long names and notes wrap without truncation or vertical clipping', async () => {
  const name = 'Cà phê sữa yến mạch ít đá thêm thạch cà phê và kem muối';
  const result = await render([{ ...item(name), note: 'Không đường, giao riêng phần kem muối' }], { customer_name: 'Khách hàng có tên rất dài để kiểm tra xuống dòng trong hóa đơn' }, { note: 'Ghi chú '.repeat(50), accountName: 'CHU TAI KHOAN CO TEN RAT DAI DE KIEM TRA XUONG DONG' });
  const lines = result.draws.filter(draw => draw.font === '800 32px Montserrat, sans-serif');
  assert.ok(lines.length > 1);
  assert.equal(lines.map(draw => draw.text).join(' '), name);
  assert.ok(result.draws.every(draw => !draw.text.includes('…')));
  assert.ok(result.draws.every(draw => draw.y < result.canvas.height - 20));
});
test('Thirty items extend paper height and keep the same readable font size', async () => {
  const short = await render([item('Món số 1')]);
  const long = await render(Array.from({ length: 30 }, (_, index) => item(`Món số ${index + 1}`)), { shipping_fee: 15000, discount: 5000 });
  assert.ok(long.canvas.height > short.canvas.height + 2000);
  assert.equal(long.canvas.width, short.canvas.width);
  assert.equal(long.draws.filter(draw => draw.text.startsWith('Món số')).length, 30);
  assert.ok(long.draws.filter(draw => draw.text.startsWith('Món số')).every(draw => draw.font.includes('32px')));
  assert.ok(long.draws.some(draw => draw.text === 'Phí giao hàng'));
  assert.ok(long.draws.some(draw => draw.text === 'Giảm giá'));
  assert.ok(long.draws.every(draw => draw.y < long.canvas.height - 20));
});
