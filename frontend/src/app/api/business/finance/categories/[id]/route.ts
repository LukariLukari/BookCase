import { NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { categoryIcons } from '@/app/business/expenses/categoryData';

const deny = () => NextResponse.json({ detail: 'Phiên đăng nhập không hợp lệ.' }, { status: 401 });
const allowedIcons = new Set<string>(categoryIcons);
const validColor = (value: string) => /^#[0-9A-F]{6}$/.test(value);

export async function PUT(request: Request, context: RouteContext<'/api/business/finance/categories/[id]'>) {
  const user = getRequestUser(request);
  if (!user) return deny();
  const { id } = await context.params;
  const current = await prisma.financeCategory.findFirst({ where: { id, userId: user.id } });
  if (!current) return NextResponse.json({ detail: 'Không tìm thấy danh mục.' }, { status: 404 });
  const body = await request.json();
  const name = String(body.name || '').trim();
  const type = String(body.type || 'expense');
  const icon = String(body.icon || 'circle-ellipsis');
  const color = String(body.color || '#FFB4A2').toUpperCase();
  if (!name || name.length > 40) return NextResponse.json({ detail: 'Tên danh mục phải từ 1 đến 40 ký tự.' }, { status: 400 });
  if (!['income', 'expense'].includes(type) || !allowedIcons.has(icon) || !validColor(color)) return NextResponse.json({ detail: 'Loại, icon hoặc màu danh mục không hợp lệ.' }, { status: 400 });
  const duplicate = await prisma.financeCategory.findFirst({ where: { userId: user.id, type, name: { equals: name, mode: 'insensitive' }, id: { not: id } } });
  if (duplicate) return NextResponse.json({ detail: 'Tên danh mục này đã tồn tại trong cùng loại.' }, { status: 409 });
  const category = await prisma.$transaction(async transaction => {
    if (current.type === type) {
      await transaction.financeTransaction.updateMany({ where: { categoryId: id }, data: { category: name } });
    } else {
      // Moving a category between Thu/Chi must not rewrite the meaning of old transactions.
      await transaction.financeTransaction.updateMany({ where: { categoryId: id }, data: { categoryId: null } });
    }
    const updated = await transaction.financeCategory.update({ where: { id }, data: { name, type, icon, color }, select: { id: true, name: true, type: true, icon: true, color: true } });
    return updated;
  });
  return NextResponse.json(category);
}

export async function DELETE(request: Request, context: RouteContext<'/api/business/finance/categories/[id]'>) {
  const user = getRequestUser(request);
  if (!user) return deny();
  const { id } = await context.params;
  const current = await prisma.financeCategory.findFirst({ where: { id, userId: user.id } });
  if (!current) return NextResponse.json({ detail: 'Không tìm thấy danh mục.' }, { status: 404 });
  await prisma.financeCategory.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
