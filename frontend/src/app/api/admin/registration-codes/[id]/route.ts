import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getRequestUser } from '@/lib/auth';

function forbidden() { return NextResponse.json({ detail: 'Bạn không có quyền quản trị.' }, { status: 403 }); }

export async function DELETE(request: Request, context: RouteContext<'/api/admin/registration-codes/[id]'>) {
  const user = getRequestUser(request);
  if (!user || user.role !== 'admin') return forbidden();
  const { id } = await context.params;
  const item = await prisma.registrationCode.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ detail: 'Mã không tồn tại.' }, { status: 404 });
  if (item.isUsed) return NextResponse.json({ detail: 'Không thể xóa mã đã được sử dụng.' }, { status: 409 });
  await prisma.registrationCode.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function PUT(request: Request, context: RouteContext<'/api/admin/registration-codes/[id]'>) {
  const user = getRequestUser(request);
  if (!user || user.role !== 'admin') return forbidden();
  const { id } = await context.params;
  const item = await prisma.registrationCode.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ detail: 'Mã không tồn tại.' }, { status: 404 });
  if (item.isUsed) return NextResponse.json({ detail: 'Không thể tạo lại mã đã dùng.' }, { status: 409 });
  let code = '';
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = randomBytes(6).toString('hex').toUpperCase().match(/.{1,4}/g)!.join('-');
    if (!(await prisma.registrationCode.findUnique({ where: { code: candidate } }))) { code = candidate; break; }
  }
  if (!code) return NextResponse.json({ detail: 'Không thể tạo mã duy nhất. Vui lòng thử lại.' }, { status: 503 });
  const updated = await prisma.registrationCode.update({ where: { id }, data: { code } });
  return NextResponse.json({ id: updated.id, code: updated.code, is_used: updated.isUsed, used_by_username: updated.usedByUsername, created_by: updated.createdBy, created_at: updated.createdAt.toISOString() });
}
