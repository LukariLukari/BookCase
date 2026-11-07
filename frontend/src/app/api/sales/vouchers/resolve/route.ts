import { NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { findVoucher } from '@/lib/voucherLookup';

export async function POST(request: Request) {
  const user = getRequestUser(request);
  if (!user) return NextResponse.json({ detail: 'Phiên đăng nhập không hợp lệ.' }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ detail: 'Dữ liệu không hợp lệ.' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || !('value' in body) || typeof body.value !== 'string' || !body.value.trim() || body.value.length > 128) return NextResponse.json({ detail: 'Vui lòng nhập hoặc quét mã voucher hợp lệ.' }, { status: 400 });
  const voucher = await findVoucher(prisma, user.id, body.value);
  if (!voucher) return NextResponse.json({ detail: 'Voucher không tồn tại trong tài khoản của bạn.' }, { status: 404 });
  return NextResponse.json(voucher, { headers: { 'Cache-Control': 'private, no-store' } });
}
