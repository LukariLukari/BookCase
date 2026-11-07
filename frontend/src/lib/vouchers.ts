export const normalizeVoucherCode = (code: string) => code.normalize('NFC').trim().toUpperCase();

export type VoucherBenefit = {
  benefitType: 'none' | 'amount' | 'percent' | 'custom';
  benefitValue: number;
  benefitText: string | null;
};

export function validateVoucherBenefit(value: Partial<VoucherBenefit>) {
  if (!['amount', 'percent', 'custom'].includes(value.benefitType || '')) return 'Chọn loại quyền lợi của voucher.';
  if (value.benefitType === 'custom') return value.benefitText?.trim() && value.benefitText.length <= 500 ? '' : 'Nhập quyền lợi, tối đa 500 ký tự.';
  if (!Number.isSafeInteger(value.benefitValue) || value.benefitValue! <= 0 || value.benefitValue! > 2_147_483_647) return 'Mức giảm phải là số nguyên dương hợp lệ.';
  if (value.benefitType === 'percent' && value.benefitValue! > 100) return 'Phần trăm giảm phải từ 1 đến 100.';
  return '';
}

export function voucherDiscount(benefit: VoucherBenefit, subtotal: number) {
  if (validateVoucherBenefit(benefit)) throw new Error('VOUCHER_BENEFIT');
  const base = Math.max(0, Math.round(subtotal));
  return benefit.benefitType === 'custom' ? 0 : Math.min(base,
    benefit.benefitType === 'percent' ? Math.round(base * benefit.benefitValue / 100) : benefit.benefitValue);
}

export function voucherBenefitLabel(benefit: VoucherBenefit) {
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
