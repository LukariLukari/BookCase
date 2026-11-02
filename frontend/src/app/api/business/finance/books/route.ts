import { NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

const deny = () => NextResponse.json({ detail: 'Phiên đăng nhập không hợp lệ.' }, { status: 401 });
const currencies = new Set(['VND', 'USD', 'EUR', 'JPY', 'GBP', 'THB', 'AUD', 'SGD']);

export async function GET(request: Request) {
  const user = getRequestUser(request);
  if (!user) return deny();
  const [books, outgoing, incoming] = await Promise.all([prisma.expenseBook.findMany({
    where: { userId: user.id },
    include: { accounts: { include: {
      editHistory: { orderBy: { createdAt: 'desc' }, take: 20 },
    }, orderBy: { createdAt: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  }), prisma.financeTransaction.groupBy({
    by: ['accountId', 'type'], where: { userId: user.id }, _sum: { amount:true }, _count: { _all:true },
  }), prisma.financeTransaction.groupBy({
    by: ['destinationAccountId'], where: { userId: user.id, type:'transfer', destinationAccountId:{not:null} }, _sum: { amount:true }, _count: { _all:true },
  })]);
  // Let PostgreSQL aggregate amounts instead of materializing every transaction in JS.
  const totals = new Map<string, { balance:number; count:number }>();
  for (const group of outgoing) {
    const total = totals.get(group.accountId) || { balance:0,count:0 };
    const amount = Number(group._sum.amount || 0);
    total.balance += group.type === 'income' ? amount : group.type === 'expense' || group.type === 'transfer' ? -amount : 0;
    total.count += group._count._all;
    totals.set(group.accountId,total);
  }
  for (const group of incoming) {
    if (!group.destinationAccountId) continue;
    const total = totals.get(group.destinationAccountId) || { balance:0,count:0 };
    total.balance += Number(group._sum.amount || 0);
    total.count += group._count._all;
    totals.set(group.destinationAccountId,total);
  }
  return NextResponse.json(books.map(book => ({
    id: book.id,
    name: book.name,
    defaultCurrency: book.defaultCurrency,
    note: book.note || '',
    createdAt: book.createdAt,
    accounts: book.accounts.map(account => ({
      id: account.id,
      name: account.name,
      type: account.type,
      currency: account.currency,
      openingBalance: Number(account.openingBalance),
      creditLimit: account.creditLimit === null ? null : Number(account.creditLimit),
      balance: Number(account.openingBalance) + (totals.get(account.id)?.balance || 0),
      transactionCount: totals.get(account.id)?.count || 0,
      editHistory: account.editHistory.map(edit => ({
        id: edit.id,
        previousName: edit.previousName,
        newName: edit.newName,
        previousType: edit.previousType,
        newType: edit.newType,
        previousCurrency: edit.previousCurrency,
        newCurrency: edit.newCurrency,
        previousCreditLimit: edit.previousCreditLimit === null ? null : Number(edit.previousCreditLimit),
        newCreditLimit: edit.newCreditLimit === null ? null : Number(edit.newCreditLimit),
        previousBalance: Number(edit.previousBalance),
        newBalance: Number(edit.newBalance),
        note: edit.note || '',
        createdAt: edit.createdAt,
      })),
    })),
  })));
}

export async function POST(request: Request) {
  const user = getRequestUser(request);
  if (!user) return deny();
  const body = await request.json();
  const name = String(body.name || '').trim();
  const defaultCurrency = String(body.defaultCurrency || 'VND').toUpperCase();
  if (!name) return NextResponse.json({ detail: 'Vui lòng nhập tên sổ.' }, { status: 400 });
  if (!currencies.has(defaultCurrency)) return NextResponse.json({ detail: 'Loại tiền tệ không được hỗ trợ.' }, { status: 400 });

  const book = await prisma.$transaction(async transaction => {
    const created = await transaction.expenseBook.create({ data: { userId: user.id, name, defaultCurrency, note: String(body.note || '').trim() || null } });
    await transaction.moneyAccount.create({ data: { userId: user.id, bookId: created.id, name: 'Tiền mặt', type: 'cash', currency: defaultCurrency } });
    return created;
  });
  return NextResponse.json(book, { status: 201 });
}
