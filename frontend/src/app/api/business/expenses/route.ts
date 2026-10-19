import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { getRequestUser } from '@/lib/auth';
import { createAutomaticBusinessBackup } from '@/lib/businessBackup';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const deny = () => NextResponse.json({ detail: 'Phiên đăng nhập không hợp lệ.' }, { status: 401 });
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value: unknown, endOfDay = false) {
  const raw = String(value || '');
  if (!datePattern.test(raw)) return null;
  const date = new Date(`${raw}T${endOfDay ? '23:59:59.999' : '00:00:00'}+07:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function expenseJson(expense: {
  id: string;
  amount: number;
  category: string;
  note: string | null;
  spentAt: Date;
  createdAt: Date;
}) {
  return {
    id: expense.id,
    amount: expense.amount,
    category: expense.category,
    description: expense.note || '',
    date: expense.spentAt,
    createdAt: expense.createdAt,
  };
}

async function ledgerForDate(userId: string, date: string) {
  const month = date.slice(0, 7);
  const existing = await prisma.businessLedger.findFirst({
    where: { userId, month },
    orderBy: { createdAt: 'desc' },
  });
  if (existing) return existing;

  const [year, monthNumber] = month.split('-');
  return prisma.businessLedger.create({
    data: {
      userId,
      month,
      name: `Sổ tháng ${monthNumber}/${year}`,
      note: 'Được tạo tự động từ Quản lý chi tiêu',
    },
  });
}

export async function GET(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) return deny();

  const fromValue = request.nextUrl.searchParams.get('from');
  const toValue = request.nextUrl.searchParams.get('to');
  const category = request.nextUrl.searchParams.get('category')?.trim();
  const from = fromValue ? parseDate(fromValue) : null;
  const to = toValue ? parseDate(toValue, true) : null;

  if ((fromValue && !from) || (toValue && !to)) {
    return NextResponse.json({ detail: 'Khoảng thời gian không hợp lệ.' }, { status: 400 });
  }
  if (from && to && from > to) {
    return NextResponse.json({ detail: 'Ngày bắt đầu phải trước ngày kết thúc.' }, { status: 400 });
  }

  const where: Prisma.BusinessExpenseWhereInput = {
    userId: user.id,
    ...(category ? { category } : {}),
    ...(from || to ? { spentAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
  };

  const [expenses, totals] = await Promise.all([
    prisma.businessExpense.findMany({ where, orderBy: [{ spentAt: 'desc' }, { createdAt: 'desc' }] }),
    prisma.businessExpense.aggregate({ where, _sum: { amount: true }, _count: true }),
  ]);

  return NextResponse.json({
    expenses: expenses.map(expenseJson),
    total: totals._sum.amount || 0,
    count: totals._count,
  });
}

export async function POST(request: Request) {
  const user = getRequestUser(request);
  if (!user) return deny();

  const body = await request.json();
  const amount = Math.round(Number(body.amount));
  const category = String(body.category || '').trim();
  const description = String(body.description || '').trim();
  const dateValue = String(body.date || '');
  const spentAt = parseDate(dateValue);

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ detail: 'Số tiền phải lớn hơn 0.' }, { status: 400 });
  }
  if (!category) return NextResponse.json({ detail: 'Vui lòng chọn danh mục.' }, { status: 400 });
  if (!spentAt) return NextResponse.json({ detail: 'Ngày chi không hợp lệ.' }, { status: 400 });

  const ledger = await ledgerForDate(user.id, dateValue);
  const expense = await prisma.businessExpense.create({
    data: { userId: user.id, ledgerId: ledger.id, amount, category, note: description || null, spentAt },
  });
  await createAutomaticBusinessBackup(user.id, 'Sau khi thêm khoản chi');
  return NextResponse.json(expenseJson(expense), { status: 201 });
}
