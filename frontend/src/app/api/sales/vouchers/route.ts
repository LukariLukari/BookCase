import { NextResponse } from 'next/server';
import { makeVoucherBarcode } from '@/lib/voucherBarcode';
import { getRequestUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createAutomaticBusinessBackup } from '@/lib/businessBackup';
import { normalizeVoucherCode, validateVoucherCode } from '@/lib/vouchers';

export const runtime = 'nodejs';
const select = { id: true, code: true, note: true, createdAt: true } as const;
const deny = () => NextResponse.json({ detail: 'Phiên đăng nhập không hợp lệ.' }, { status: 401 });
export async function GET(request: Request) {
  const user = getRequestUser(request);
  if (!user) return deny();
  const vouchers = await prisma.businessVoucher.findMany({ where: { userId: user.id }, select, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  return NextResponse.json(await Promise.all(vouchers.map(async voucher => ({ ...voucher, barcodeDataUrl: await makeVoucherBarcode(voucher.id) }))), { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request: Request) {
  const user = getRequestUser(request);
  if (!user) return deny();
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ detail: 'Dữ liệu không hợp lệ.' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || !('code' in body) || typeof body.code !== 'string') return NextResponse.json({ detail: 'Vui lòng nhập mã voucher.' }, { status: 400 });
  const code = normalizeVoucherCode(body.code);
  const error = validateVoucherCode(code);
  const note = 'note' in body && typeof body.note === 'string' ? body.note.trim() : '';
  if (error || note.length > 500) return NextResponse.json({ detail: error || 'Ghi chú tối đa 500 ký tự.' }, { status: 400 });
  try {
    const voucher = await prisma.businessVoucher.create({ data: { userId: user.id, code, note: note || null }, select });
    await createAutomaticBusinessBackup(user.id, 'Sau khi tạo voucher');
    return NextResponse.json({ ...voucher, barcodeDataUrl: await makeVoucherBarcode(voucher.id) }, { status: 201 });
  } catch (reason) {
    if (reason && typeof reason === 'object' && 'code' in reason && reason.code === 'P2002') return NextResponse.json({ detail: 'Mã voucher này đã tồn tại trong tài khoản của bạn.' }, { status: 409 });
    throw reason;
  }
}
