import { NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

const deny = () => NextResponse.json({ detail: 'Phiên đăng nhập không hợp lệ.' }, { status: 401 });
const currencies = new Set(['VND', 'USD', 'EUR', 'JPY', 'GBP', 'THB', 'AUD', 'SGD']);

export async function GET(request: Request) {
  const user = getRequestUser(request);
  if (!user) return deny();
  const books = await prisma.expenseBook.findMany({
    where: { userId: user.id },
    include: { accounts: { include: { transactions: { select: { type: true, amount: true } } }, orderBy: { createdAt: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });
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
      balance: account.transactions.reduce((sum, transaction) => sum + (transaction.type === 'income' ? Number(transaction.amount) : -Number(transaction.amount)), Number(account.openingBalance)),
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
