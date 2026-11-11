import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const exports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/lib/vouchers.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports });
const { voucherDiscount, groupVoucherDiscount, validateVoucherBenefit, readVoucherBenefit, voucherBenefitLabel } = exports;
const rule = overrides => ({ requiredQuantity: 4, paidQuantity: 3, grouping: 'mixed', eligibleProductIds: ['basic', 'advanced'], repeatable: true, maxFreeQuantity: null, ...overrides });
const benefit = overrides => ({ benefitType: 'buy_x_pay_y', benefitValue: 0, benefitText: JSON.stringify(rule(overrides)) });
const line = (productId, quantity, unitPrice) => ({ productId, quantity, unitPrice });
const calculate = (lines, overrides) => voucherDiscount(benefit(overrides), lines.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0), lines);

test('Buy four pay three handles incomplete groups, repeated groups and leftover guests', () => {
  for (const [quantity, discount] of [[0, 0], [3, 0], [4, 100000], [5, 100000], [8, 200000], [9, 200000]]) {
    assert.equal(calculate([line('basic', quantity, 100000)]), discount);
  }
  assert.equal(calculate([line('basic', 6, 100000)], { requiredQuantity: 3, paidQuantity: 2 }), 200000);
  assert.equal(calculate([line('basic', 10, 100000)], { requiredQuantity: 5, paidQuantity: 3 }), 400000);
});

test('Mixed workshop packages waive the cheapest eligible seats and ignore add-ons entirely', () => {
  const items = [line('basic', 2, 200000), line('advanced', 2, 350000), line('addon', 100, 10000)];
  assert.equal(calculate(items), 200000);
  assert.equal(groupVoucherDiscount(benefit(), items).eligibleQuantity, 4);
  assert.equal(calculate([line('basic', 2, 200000), line('addon', 2, 10000)]), 0);
  assert.equal(calculate([line('basic', 1, 100000), line('advanced', 7, 350000)]), 450000);
});

test('Same-package grouping combines split lines and never counts other packages toward the threshold', () => {
  const same = { grouping: 'same_product' };
  assert.equal(calculate([line('basic', 2, 200000), line('advanced', 2, 350000)], same), 0);
  assert.equal(calculate([line('basic', 2, 200000), line('basic', 2, 150000), line('advanced', 4, 350000)], same), 500000);
  assert.equal(calculate([line('basic', 8, 200000), line('advanced', 3, 350000)], same), 400000);
});

test('Non-repeating vouchers apply to only one group across an order; global free-seat caps hold', () => {
  const items = [line('basic', 8, 200000), line('advanced', 8, 350000)];
  assert.equal(calculate(items, { repeatable: false }), 200000);
  assert.equal(calculate(items, { grouping: 'same_product', repeatable: false }), 200000);
  assert.equal(calculate(items, { maxFreeQuantity: 1 }), 200000);
  assert.equal(calculate(items, { grouping: 'same_product', maxFreeQuantity: 3 }), 750000);
  assert.equal(calculate(items, { requiredQuantity: 4, paidQuantity: 2, maxFreeQuantity: 1 }), 200000);
});

test('Group discounts do not mutate the cart and handle free seats and large quantities without expansion', () => {
  const items = [line('advanced', 3, 350000), line('basic', 1, 0)];
  const before = JSON.stringify(items);
  assert.equal(calculate(items), 0);
  assert.equal(groupVoucherDiscount(benefit(), items).freeQuantity, 1);
  assert.equal(JSON.stringify(items), before);
  assert.equal(calculate([line('basic', 100000000, 10)]), 250000000);
  assert.equal(voucherDiscount(benefit(), 100, [line('basic', 4, 100000)]), 100);
});

test('Invalid group rules cannot be applied, restored as snapshots or interpreted as ordinary money discounts', () => {
  for (const invalid of [
    { requiredQuantity: 1 }, { requiredQuantity: 4.5 }, { requiredQuantity: 10001 },
    { paidQuantity: 0 }, { paidQuantity: 4 }, { paidQuantity: 1.5 },
    { grouping: 'unknown' }, { repeatable: 'true' }, { eligibleProductIds: [] },
    { eligibleProductIds: ['basic', 'basic'] }, { eligibleProductIds: [123] },
    { maxFreeQuantity: 0 }, { maxFreeQuantity: -1 }, { maxFreeQuantity: 1.5 },
  ]) {
    const value = benefit(invalid);
    assert.ok(validateVoucherBenefit(value));
    assert.equal(readVoucherBenefit(JSON.stringify(value)), null);
    assert.throws(() => voucherDiscount(value, 100000, []), /VOUCHER_BENEFIT/);
  }
  assert.ok(validateVoucherBenefit({ ...benefit(), benefitText: '{' }));
  assert.throws(() => voucherDiscount(benefit(), 100000), /VOUCHER_ITEMS/);
  assert.throws(() => calculate([line('basic', -1, 200000)]), /VOUCHER_ITEMS/);
  assert.throws(() => calculate([line('basic', 4, -1)]), /VOUCHER_ITEMS/);
  assert.throws(() => calculate([line('basic', 4.5, 200000)]), /VOUCHER_ITEMS/);
});

test('Group snapshots round-trip and show readable conditions while existing voucher types remain unchanged', () => {
  const value = benefit({ maxFreeQuantity: 2 });
  const restored = readVoucherBenefit(JSON.stringify(value));
  assert.equal(voucherDiscount(restored, 800000, [line('basic', 8, 100000)]), 200000);
  assert.match(voucherBenefitLabel(restored), /Đi 4 tính tiền 3/);
  assert.match(voucherBenefitLabel(restored), /Tối đa 2 suất miễn/);
  assert.equal(voucherDiscount({ benefitType: 'amount', benefitValue: 5000, benefitText: null }, 40000), 5000);
  assert.equal(voucherDiscount({ benefitType: 'percent', benefitValue: 10, benefitText: null }, 40000), 4000);
  assert.equal(voucherDiscount({ benefitType: 'custom', benefitValue: 0, benefitText: 'Quà tặng' }, 40000), 0);
});
