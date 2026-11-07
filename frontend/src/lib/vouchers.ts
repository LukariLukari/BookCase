export const normalizeVoucherCode = (code: string) => code.normalize('NFC').trim().toUpperCase();

export function validateVoucherCode(code: string) {
  if (!code || code.length > 64) return 'Mã voucher phải từ 1 đến 64 ký tự.';
  if (!/^[\p{L}\p{N}_-]+$/u.test(code)) return 'Mã chỉ gồm chữ, số, dấu gạch ngang (-) hoặc gạch dưới (_), không có khoảng trắng.';
  return '';
}
