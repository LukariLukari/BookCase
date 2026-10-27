import { NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

const deny = () => NextResponse.json({ detail: 'Phiên đăng nhập không hợp lệ.' }, { status: 401 });
const currencies = new Set(['VND', 'USD', 'EUR', 'JPY', 'GBP', 'THB', 'AUD', 'SGD']);
const types = new Set(['cash', 'bank', 'debit_card', 'credit_card', 'e_wallet', 'other']);

const balanceOf = (account: {
  openingBalance: unknown;
  transactions: { type: string; amount: unknown }[];
  incomingTransfers: { type: string; amount: unknown }[];
}) => account.incomingTransfers.reduce(
  (sum, transaction) => sum + (transaction.type === 'transfer' ? Number(transaction.amount) : 0),
  account.transactions.reduce((sum, transaction) => {
    if (transaction.type === 'income') return sum + Number(transaction.amount);
    if (transaction.type === 'expense' || transaction.type === 'transfer') return sum - Number(transaction.amount);
    return sum;
  }, Number(account.openingBalance)),
);

export async function PUT(request: Request, context: RouteContext<'/api/business/finance/accounts/[id]'>) {
  const user = getRequestUser(request);
  if (!user) return deny();
  const { id } = await context.params;
  const account = await prisma.moneyAccount.findFirst({
    where: { id, userId: user.id },
    include: {
      transactions: { select: { type: true, amount: true } },
      incomingTransfers: { select: { type: true, amount: true } },
    },
  });
  if (!account) return NextResponse.json({ detail: 'Không tìm thấy khoản tiền.' }, { status: 404 });

  const body = await request.json();
  const name = String(body.name || '').trim();
  const type = String(body.type || 'cash');
  const currency = String(body.currency || '').toUpperCase();
  const balance = Number(body.balance);
  const creditLimit = type === 'credit_card' && body.creditLimit !== '' && body.creditLimit !== null && body.creditLimit !== undefined
    ? Number(body.creditLimit)
    : null;
  const note = String(body.note || '').trim();
  if (!name || !types.has(type) || !currencies.has(currency)) return NextResponse.json({ detail: 'Tên, loại khoản tiền hoặc tiền tệ không hợp lệ.' }, { status: 400 });
  if (!Number.isFinite(balance) || (creditLimit !== null && (!Number.isFinite(creditLimit) || creditLimit < 0))) return NextResponse.json({ detail: 'Số dư hiện tại hoặc hạn mức không hợp lệ.' }, { status: 400 });

  const previousBalance = balanceOf(account);
  const previousCreditLimit = account.creditLimit === null ? null : Number(account.creditLimit);
  const changed = name !== account.name || type !== account.type || currency !== account.currency
    || balance !== previousBalance || creditLimit !== previousCreditLimit;
  if (!changed) return NextResponse.json({ detail: 'Chưa có thông tin nào thay đổi.' }, { status: 400 });

  const openingBalance = Number(account.openingBalance) + balance - previousBalance;
  await prisma.$transaction(async transaction => {
    await transaction.moneyAccountEdit.create({ data: {
      userId: user.id,
      accountId: account.id,
      previousName: account.name,
      newName: name,
      previousType: account.type,
      newType: type,
      previousCurrency: account.currency,
      newCurrency: currency,
      previousCreditLimit,
      newCreditLimit: creditLimit,
      previousBalance,
      newBalance: balance,
      note: note || null,
    } });
    await transaction.moneyAccount.update({
      where: { id: account.id },
      data: { name, type, currency, creditLimit, openingBalance },
    });
  });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request, context: RouteContext<'/api/business/finance/accounts/[id]'>) {
  const user = getRequestUser(request);
  if (!user) return deny();
  const { id } = await context.params;
  const account = await prisma.moneyAccount.findFirst({ where: { id, userId: user.id }, select: { id: true } });
  if (!account) return NextResponse.json({ detail: 'Không tìm thấy khoản tiền.' }, { status: 404 });
  await prisma.moneyAccount.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
