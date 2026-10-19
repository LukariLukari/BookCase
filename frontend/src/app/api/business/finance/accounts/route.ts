import { NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

const deny = () => NextResponse.json({ detail: 'Phiên đăng nhập không hợp lệ.' }, { status: 401 });
const currencies = new Set(['VND', 'USD', 'EUR', 'JPY', 'GBP', 'THB', 'AUD', 'SGD']);
const types = new Set(['cash', 'bank', 'debit_card', 'credit_card', 'e_wallet', 'other']);

export async function POST(request: Request) {
  const user = getRequestUser(request);
  if (!user) return deny();
  const body = await request.json();
  const bookId = String(body.bookId || '');
  const name = String(body.name || '').trim();
  const type = String(body.type || 'cash');
  const currency = String(body.currency || 'VND').toUpperCase();
  const openingBalance = Number(body.openingBalance || 0);
  const creditLimit = body.creditLimit === '' || body.creditLimit === null || body.creditLimit === undefined ? null : Number(body.creditLimit);
  const book = await prisma.expenseBook.findFirst({ where: { id: bookId, userId: user.id } });
  if (!book) return NextResponse.json({ detail: 'Không tìm thấy sổ chi tiêu.' }, { status: 404 });
  if (!name) return NextResponse.json({ detail: 'Vui lòng nhập tên tài khoản.' }, { status: 400 });
  if (!types.has(type) || !currencies.has(currency)) return NextResponse.json({ detail: 'Loại tài khoản hoặc tiền tệ không hợp lệ.' }, { status: 400 });
  if (!Number.isFinite(openingBalance) || (creditLimit !== null && (!Number.isFinite(creditLimit) || creditLimit < 0))) return NextResponse.json({ detail: 'Số dư hoặc hạn mức không hợp lệ.' }, { status: 400 });
  const account = await prisma.moneyAccount.create({ data: { userId: user.id, bookId, name, type, currency, openingBalance, creditLimit } });
  return NextResponse.json({ ...account, openingBalance: Number(account.openingBalance), creditLimit: account.creditLimit === null ? null : Number(account.creditLimit), balance: Number(account.openingBalance) }, { status: 201 });
}
