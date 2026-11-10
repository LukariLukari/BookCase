import { NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { financeReadQuery, financeReadResponse, type FinanceReadRow } from '@/lib/financeRead';

export async function GET(request: Request) {
  const user = getRequestUser(request);
  if (!user) return NextResponse.json({ detail: 'Phiên đăng nhập không hợp lệ.' }, { status: 401 });
  try {
    const { text, values } = financeReadQuery('bootstrap', user.id, new URL(request.url).searchParams.get('bookId') || '');
    const [row] = await prisma.$queryRawUnsafe<FinanceReadRow[]>(text, ...values);
    const { body, status } = financeReadResponse('bootstrap', row);
    return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ detail: 'Không tải được dữ liệu chi tiêu. Vui lòng thử lại.' }, { status: 503 });
  }
}
