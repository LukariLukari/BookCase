import { NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { categoryIcons } from '@/app/business/expenses/categoryData';

const deny = () => NextResponse.json({ detail: 'Phiên đăng nhập không hợp lệ.' }, { status: 401 });
const allowedIcons = new Set<string>(categoryIcons);
const validColor = (value: string) => /^#[0-9A-F]{6}$/.test(value);

export async function GET(request: Request) {
  const user = getRequestUser(request);
  if (!user) return deny();
  const categories = await prisma.financeCategory.findMany({
    where: { userId: user.id },
    orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, name: true, type: true, icon: true, color: true, _count: { select: { transactions: true } } },
  });
  return NextResponse.json(categories.map(({ _count, ...category }) => ({ ...category, usageCount: _count.transactions })));
}

export async function POST(request: Request) {
  const user = getRequestUser(request);
  if (!user) return deny();
  const body = await request.json();
  const name = String(body.name || '').trim();
  const type = String(body.type || 'expense');
  const icon = String(body.icon || 'circle-ellipsis');
  const color = String(body.color || '#FFB4A2').toUpperCase();
  if (!name || name.length > 40) return NextResponse.json({ detail: 'Tên danh mục phải từ 1 đến 40 ký tự.' }, { status: 400 });
  if (!['income', 'expense'].includes(type) || !allowedIcons.has(icon) || !validColor(color)) return NextResponse.json({ detail: 'Loại, icon hoặc màu danh mục không hợp lệ.' }, { status: 400 });
  const duplicate = await prisma.financeCategory.findFirst({ where: { userId: user.id, type, name: { equals: name, mode: 'insensitive' } } });
  if (duplicate) return NextResponse.json({ detail: 'Tên danh mục này đã tồn tại trong cùng loại.' }, { status: 409 });
  const category = await prisma.financeCategory.create({ data: { userId: user.id, name, type, icon, color }, select: { id: true, name: true, type: true, icon: true, color: true } });
  return NextResponse.json(category, { status: 201 });
}
