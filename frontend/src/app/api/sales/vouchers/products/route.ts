import { NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  const user = getRequestUser(request);
  if (!user) return NextResponse.json({ detail: 'Phiên đăng nhập không hợp lệ.' }, { status: 401 });
  const products = await prisma.businessProduct.findMany({
    where: { userId: user.id },
    select: { id: true, name: true, sellingPrice: true, trackStock: true, isActive: true },
    orderBy: [{ trackStock: 'asc' }, { name: 'asc' }, { id: 'asc' }],
  });
  return NextResponse.json(products, { headers: { 'Cache-Control': 'private, no-store' } });
}
