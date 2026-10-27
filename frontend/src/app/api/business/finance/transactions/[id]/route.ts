import { NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

const deny = () => NextResponse.json({ detail: 'Phiên đăng nhập không hợp lệ.' }, { status: 401 });
const parseDate = (value: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? new Date(`${String(value)}T12:00:00+07:00`) : null;

export async function PUT(request: Request, context: RouteContext<'/api/business/finance/transactions/[id]'>) {
  const user = getRequestUser(request);
  if (!user) return deny();
  const { id } = await context.params;
  const current = await prisma.financeTransaction.findFirst({ where: { id, userId: user.id } });
  if (!current) return NextResponse.json({ detail: 'Không tìm thấy giao dịch.' }, { status: 404 });
  const body = await request.json();
  const accountId = String(body.accountId || ''), type = String(body.type || ''), categoryId = String(body.categoryId || ''), destinationAccountId = String(body.destinationAccountId || '');
  const amount = Number(body.amount), description = String(body.description || '').trim(), transactionDate = parseDate(body.date);
  const [account, category, destinationAccount] = await Promise.all([
    prisma.moneyAccount.findFirst({ where: { id: accountId, bookId: current.bookId, userId: user.id } }),
    type === 'transfer' ? null : prisma.financeCategory.findFirst({ where: { id: categoryId, userId: user.id, type } }),
    type === 'transfer' ? prisma.moneyAccount.findFirst({ where: { id: destinationAccountId, bookId: current.bookId, userId: user.id } }) : null,
  ]);
  if (!account || !Number.isFinite(amount) || amount <= 0 || !transactionDate) return NextResponse.json({ detail: 'Vui lòng nhập đầy đủ thông tin giao dịch.' }, { status: 400 });
  if (type === 'transfer') {
    if (!destinationAccount || destinationAccount.id === account.id) return NextResponse.json({ detail: 'Vui lòng chọn hai ví khác nhau.' }, { status: 400 });
    if (destinationAccount.currency !== account.currency) return NextResponse.json({ detail: 'Chỉ có thể chuyển tiền giữa hai ví cùng loại tiền tệ.' }, { status: 400 });
    const row = await prisma.financeTransaction.update({
      where: { id },
      data: { accountId, destinationAccountId, type, amount, currency: account.currency, categoryId: null, category: 'Chuyển tiền', description: description || null, transactionDate },
      include: { account: { select: { id: true, name: true, type: true } }, destinationAccount: { select: { id: true, name: true, type: true } }, categoryRef: { select: { name: true, icon: true, color: true } } },
    });
    return NextResponse.json({ id: row.id, type: row.type, amount: Number(row.amount), currency: row.currency, categoryId: row.categoryId, category: row.category, categoryIcon: null, categoryColor: null, description: row.description || '', date: row.transactionDate, createdAt: row.createdAt, account: row.account, destinationAccount: row.destinationAccount });
  }
  if (!category || !['income', 'expense'].includes(type)) return NextResponse.json({ detail: 'Vui lòng chọn một danh mục hợp lệ.' }, { status: 400 });
  const row = await prisma.financeTransaction.update({
    where: { id },
    data: { accountId, destinationAccountId: null, type, amount, currency: account.currency, categoryId: category.id, category: category.name, description: description || null, transactionDate },
    include: { account: { select: { id: true, name: true, type: true } }, destinationAccount: { select: { id: true, name: true, type: true } }, categoryRef: { select: { name: true, icon: true, color: true } } },
  });
  return NextResponse.json({ id: row.id, type: row.type, amount: Number(row.amount), currency: row.currency, categoryId: row.categoryId, category: row.categoryRef?.name || row.category, categoryIcon: row.categoryRef?.icon || null, categoryColor: row.categoryRef?.color || null, description: row.description || '', date: row.transactionDate, createdAt: row.createdAt, account: row.account, destinationAccount: row.destinationAccount });
}

export async function DELETE(request: Request, context: RouteContext<'/api/business/finance/transactions/[id]'>) {
  const user = getRequestUser(request);
  if (!user) return deny();
  const { id } = await context.params;
  const current = await prisma.financeTransaction.findFirst({ where: { id, userId: user.id } });
  if (!current) return NextResponse.json({ detail: 'Không tìm thấy giao dịch.' }, { status: 404 });
  await prisma.financeTransaction.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
