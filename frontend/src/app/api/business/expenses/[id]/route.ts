import { NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth';
import { createAutomaticBusinessBackup } from '@/lib/businessBackup';
import { prisma } from '@/lib/db';

const deny = () => NextResponse.json({ detail: 'Phiên đăng nhập không hợp lệ.' }, { status: 401 });
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value: unknown) {
  const raw = String(value || '');
  if (!datePattern.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00+07:00`);
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
  const existing = await prisma.businessLedger.findFirst({ where: { userId, month }, orderBy: { createdAt: 'desc' } });
  if (existing) return existing;
  const [year, monthNumber] = month.split('-');
  return prisma.businessLedger.create({
    data: { userId, month, name: `Sổ tháng ${monthNumber}/${year}`, note: 'Được tạo tự động từ Quản lý chi tiêu' },
  });
}

export async function PUT(request: Request, context: RouteContext<'/api/business/expenses/[id]'>) {
  const user = getRequestUser(request);
  if (!user) return deny();
  const { id } = await context.params;
  const current = await prisma.businessExpense.findFirst({ where: { id, userId: user.id } });
  if (!current) return NextResponse.json({ detail: 'Không tìm thấy khoản chi.' }, { status: 404 });

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
  const expense = await prisma.businessExpense.update({
    where: { id },
    data: { ledgerId: ledger.id, amount, category, note: description || null, spentAt },
  });
  await createAutomaticBusinessBackup(user.id, 'Sau khi sửa khoản chi');
  return NextResponse.json(expenseJson(expense));
}

export async function DELETE(request: Request, context: RouteContext<'/api/business/expenses/[id]'>) {
  const user = getRequestUser(request);
  if (!user) return deny();
  const { id } = await context.params;
  const current = await prisma.businessExpense.findFirst({ where: { id, userId: user.id } });
  if (!current) return NextResponse.json({ detail: 'Không tìm thấy khoản chi.' }, { status: 404 });

  await prisma.businessExpense.delete({ where: { id } });
  await createAutomaticBusinessBackup(user.id, 'Sau khi xóa khoản chi');
  return NextResponse.json({ success: true });
}
