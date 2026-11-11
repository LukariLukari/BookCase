export const normalizeVoucherCode = (code: string) => code.normalize('NFC').trim().toUpperCase();

export type VoucherBenefit = {
  benefitType: 'none' | 'amount' | 'percent' | 'custom' | 'buy_x_pay_y';
  benefitValue: number;
  benefitText: string | null;
};

export type BuyXPayYRule = {
  requiredQuantity: number;
  paidQuantity: number;
  grouping: 'mixed' | 'same_product';
  eligibleProductIds: string[];
  repeatable: boolean;
  maxFreeQuantity: number | null;
};

export type VoucherLine = { productId: string; quantity: number; unitPrice: number };

// Group rules live in benefitText as JSON for this benefit type only. Existing
// vouchers, backups and order snapshots keep using the same storage format.
export function readBuyXPayYRule(benefit: Partial<VoucherBenefit>): BuyXPayYRule | null {
  if (benefit.benefitType !== 'buy_x_pay_y' || typeof benefit.benefitText !== 'string' || benefit.benefitText.length > 100_000) return null;
  try {
    const rule = JSON.parse(benefit.benefitText) as BuyXPayYRule | null;
    if (!rule || !Number.isSafeInteger(rule.requiredQuantity) || rule.requiredQuantity < 2 || rule.requiredQuantity > 10_000 ||
      !Number.isSafeInteger(rule.paidQuantity) || rule.paidQuantity < 1 || rule.paidQuantity >= rule.requiredQuantity ||
      !['mixed', 'same_product'].includes(rule.grouping) || typeof rule.repeatable !== 'boolean' ||
      !Array.isArray(rule.eligibleProductIds) || !rule.eligibleProductIds.length || rule.eligibleProductIds.length > 1000 ||
      rule.eligibleProductIds.some(id => typeof id !== 'string' || !id.trim() || id.length > 128) ||
      new Set(rule.eligibleProductIds).size !== rule.eligibleProductIds.length ||
      (rule.maxFreeQuantity !== null && (!Number.isSafeInteger(rule.maxFreeQuantity) || rule.maxFreeQuantity < 1 || rule.maxFreeQuantity > 2_147_483_647))) return null;
    return rule;
  } catch { return null; }
}

function cheapestUnits(lines: VoucherLine[], quantity: number) {
  const result: VoucherLine[] = [];
  for (const line of [...lines].sort((a, b) => a.unitPrice - b.unitPrice)) {
    if (quantity <= 0) break;
    const taken = Math.min(quantity, line.quantity);
    result.push({ ...line, quantity: taken });
    quantity -= taken;
  }
  return result;
}

export function groupVoucherDiscount(benefit: VoucherBenefit, lines: VoucherLine[]) {
  const rule = readBuyXPayYRule(benefit);
  if (!rule) throw new Error('VOUCHER_BENEFIT');
  const eligibleIds = new Set(rule.eligibleProductIds);
  const eligible = lines.filter(line => eligibleIds.has(line.productId));
  if (eligible.some(line => !Number.isSafeInteger(line.quantity) || line.quantity < 0 || !Number.isSafeInteger(line.unitPrice) || line.unitPrice < 0)) throw new Error('VOUCHER_ITEMS');
  const eligibleQuantity = eligible.reduce((sum, line) => sum + line.quantity, 0);
  const groups = new Map<string, VoucherLine[]>();
  for (const line of eligible) {
    const key = rule.grouping === 'mixed' ? 'all' : line.productId;
    groups.set(key, [...(groups.get(key) || []), line]);
  }
  const freePerGroup = rule.requiredQuantity - rule.paidQuantity;
  let candidates: VoucherLine[][] = [];
  for (const group of groups.values()) {
    const count = group.reduce((sum, line) => sum + line.quantity, 0);
    const groupCount = Math.floor(count / rule.requiredQuantity);
    if (groupCount) candidates.push(cheapestUnits(group, (rule.repeatable ? groupCount : 1) * freePerGroup));
  }
  // A non-repeating voucher applies once across the whole order, even when
  // several individual packages qualify. Prefer the cheapest qualifying group.
  const amount = (group: VoucherLine[]) => group.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  if (!rule.repeatable) candidates = candidates.sort((a, b) => amount(a) - amount(b)).slice(0, 1);
  const freeLines = cheapestUnits(candidates.flat(), rule.maxFreeQuantity ?? Number.MAX_SAFE_INTEGER);
  return { discount: amount(freeLines), freeQuantity: freeLines.reduce((sum, line) => sum + line.quantity, 0), eligibleQuantity };
}

export function validateVoucherBenefit(value: Partial<VoucherBenefit>) {
  if (!['amount', 'percent', 'custom', 'buy_x_pay_y'].includes(value.benefitType || '')) return 'Chọn loại quyền lợi của voucher.';
  if (value.benefitType === 'buy_x_pay_y') return readBuyXPayYRule(value) ? '' : 'Nhập số người đi lớn hơn số người tính tiền, chọn ít nhất một gói và kiểm tra giới hạn suất miễn.';
  if (value.benefitType === 'custom') return value.benefitText?.trim() && value.benefitText.length <= 500 ? '' : 'Nhập quyền lợi, tối đa 500 ký tự.';
  if (!Number.isSafeInteger(value.benefitValue) || value.benefitValue! <= 0 || value.benefitValue! > 2_147_483_647) return 'Mức giảm phải là số nguyên dương hợp lệ.';
  if (value.benefitType === 'percent' && value.benefitValue! > 100) return 'Phần trăm giảm phải từ 1 đến 100.';
  return '';
}

export function voucherDiscount(benefit: VoucherBenefit, subtotal: number, lines?: VoucherLine[]) {
  if (validateVoucherBenefit(benefit)) throw new Error('VOUCHER_BENEFIT');
  const base = Math.max(0, Math.round(subtotal));
  if (benefit.benefitType === 'buy_x_pay_y') {
    if (!lines) throw new Error('VOUCHER_ITEMS');
    return Math.min(base, groupVoucherDiscount(benefit, lines).discount);
  }
  return benefit.benefitType === 'custom' ? 0 : Math.min(base,
    benefit.benefitType === 'percent' ? Math.round(base * benefit.benefitValue / 100) : benefit.benefitValue);
}

export function voucherBenefitLabel(benefit: VoucherBenefit) {
  if (benefit.benefitType === 'buy_x_pay_y') {
    const rule = readBuyXPayYRule(benefit);
    if (!rule) return 'Ưu đãi nhóm chưa hợp lệ';
    return `Đi ${rule.requiredQuantity} tính tiền ${rule.paidQuantity} · ${rule.grouping === 'mixed' ? 'Gộp các gói' : 'Cùng một gói'} · ${rule.repeatable ? 'Lặp theo số nhóm' : 'Một lần/đơn'}${rule.maxFreeQuantity ? ` · Tối đa ${rule.maxFreeQuantity} suất miễn` : ''}`;
  }
  if (benefit.benefitType === 'amount') return `Giảm ${benefit.benefitValue.toLocaleString('vi-VN')} đ`;
  if (benefit.benefitType === 'percent') return `Giảm ${benefit.benefitValue}% tiền hàng`;
  if (benefit.benefitType === 'custom') return benefit.benefitText || 'Quyền lợi khác';
  return 'Chưa thiết lập quyền lợi';
}

export function readVoucherBenefit(value: string | null | undefined): VoucherBenefit | null {
  try { const parsed = JSON.parse(value || 'null'); return parsed && !validateVoucherBenefit(parsed) ? parsed : null; }
  catch { return null; }
}

export function validateVoucherCode(code: string) {
  if (!code || code.length > 64) return 'Mã voucher phải từ 1 đến 64 ký tự.';
  if (!/^[\p{L}\p{N}_-]+$/u.test(code)) return 'Mã chỉ gồm chữ, số, dấu gạch ngang (-) hoặc gạch dưới (_), không có khoảng trắng.';
  return '';
}
