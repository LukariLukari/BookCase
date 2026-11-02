import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';

const deny = () => NextResponse.json({ detail: 'Phiên đăng nhập không hợp lệ.' }, { status: 401 });
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const parseDate = (value: unknown, end = false) => {
  const raw = String(value || '');
  if (!datePattern.test(raw)) return null;
  const parsed = new Date(`${raw}T${end ? '23:59:59.999' : '12:00:00'}+07:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const json = (item: { id:string;type:string;amount:unknown;currency:string;category:string;categoryId:string|null;description:string|null;transactionDate:Date;createdAt:Date;account:{id:string;name:string;type:string};destinationAccount:{id:string;name:string;type:string}|null;categoryRef:{name:string;icon:string;color:string}|null }) => ({ id:item.id,type:item.type,amount:Number(item.amount),currency:item.currency,categoryId:item.categoryId,category:item.categoryRef?.name||item.category,categoryIcon:item.categoryRef?.icon||null,categoryColor:item.categoryRef?.color||null,description:item.description||'',date:item.transactionDate,createdAt:item.createdAt,account:item.account,destinationAccount:item.destinationAccount });

export async function DELETE(request: Request) {
  const user = getRequestUser(request);
  if (!user) return deny();
  const body = await request.json().catch(() => null);
  if (!body || typeof body.bookId !== 'string' || !body.bookId || !Array.isArray(body.ids) || !body.ids.length || body.ids.some((id: unknown) => typeof id !== 'string' || !id.trim())) {
    return NextResponse.json({ detail: 'Vui lòng chọn sổ và các giao dịch cần xóa.' }, { status: 400 });
  }
  const book = await prisma.expenseBook.findFirst({ where: { id: body.bookId, userId: user.id } });
  if (!book) return NextResponse.json({ detail: 'Không tìm thấy sổ chi tiêu.' }, { status: 404 });
  // One atomic deletion, scoped to this user's book and the confirmed snapshot of IDs.
  // Wallet balances and statistics are derived from the remaining transactions.
  const result = await prisma.financeTransaction.deleteMany({ where: { userId: user.id, bookId: book.id, id: { in: [...new Set<string>(body.ids)] } } });
  return NextResponse.json({ success: true, deletedCount: result.count });
}

export async function GET(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) return deny();
  const bookId = request.nextUrl.searchParams.get('bookId') || '';
  const from = request.nextUrl.searchParams.get('from');
  const to = request.nextUrl.searchParams.get('to');
  const type = request.nextUrl.searchParams.get('type');
  const typeFilter = type === 'income' || type === 'expense' || type === 'transfer' ? type : undefined;
  const book = await prisma.expenseBook.findFirst({ where: { id: bookId, userId: user.id } });
  if (!book) return NextResponse.json({ detail: 'Không tìm thấy sổ chi tiêu.' }, { status: 404 });
  const fromDate = from ? parseDate(from) : null;
  const toDate = to ? parseDate(to, true) : null;
  const transactions = await prisma.financeTransaction.findMany({
    where: { userId:user.id,bookId,...(typeFilter?{type:typeFilter}:{}),...(fromDate||toDate?{transactionDate:{...(fromDate?{gte:fromDate}:{}),...(toDate?{lte:toDate}:{})}}:{}) },
    include: { account: { select: { id:true,name:true,type:true } }, destinationAccount: { select: { id:true,name:true,type:true } }, categoryRef: { select: { name:true,icon:true,color:true } } },
    orderBy: [{ transactionDate:'desc' }, { createdAt:'desc' }],
  });
  return NextResponse.json({ transactions: transactions.map(json) });
}

export async function POST(request: Request) {
  const user = getRequestUser(request);
  if (!user) return deny();
  const body = await request.json();
  const clientId = body.clientId;
  if (clientId !== undefined && (typeof clientId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientId))) {
    return NextResponse.json({ detail: 'Mã giao dịch không hợp lệ.' }, { status: 400 });
  }
  const bookId = String(body.bookId || ''), accountId = String(body.accountId || ''), type = String(body.type || 'expense'), categoryId = String(body.categoryId || ''), destinationAccountId = String(body.destinationAccountId || '');
  const amount = Number(body.amount), description = String(body.description || '').trim(), date = String(body.date || ''), transactionDate = parseDate(date);
  // Independent authorization reads run together instead of adding round trips.
  const [account, category, destinationAccount] = await Promise.all([
    prisma.moneyAccount.findFirst({ where: { id:accountId,bookId,userId:user.id } }),
    type === 'transfer' ? null : prisma.financeCategory.findFirst({ where: { id:categoryId,userId:user.id,type } }),
    type === 'transfer' ? prisma.moneyAccount.findFirst({ where: { id:destinationAccountId,bookId,userId:user.id } }) : null,
  ]);
  if (!account) return NextResponse.json({ detail:'Tài khoản tiền không thuộc sổ đã chọn.' }, { status:404 });
  const create = async (data: Prisma.FinanceTransactionUncheckedCreateInput) => {
    const include = { account: { select: { id:true,name:true,type:true } }, destinationAccount: { select: { id:true,name:true,type:true } }, categoryRef: { select: { name:true,icon:true,color:true } } } as const;
    const persist = async () => {
      try {
        return clientId
          ? await prisma.financeTransaction.upsert({ where: { id:clientId }, create: { ...data,id:clientId }, update: {}, include })
          : await prisma.financeTransaction.create({ data,include });
      } catch (reason) {
        if (clientId && (reason as { code?:string })?.code === 'P2002') {
          const existing = await prisma.financeTransaction.findUnique({ where: { id:clientId }, include });
          if (existing) return existing;
        }
        throw reason;
      }
    };
    const transaction = await persist();
    // Retrying the same UUID is safe; reusing it for a different owner or payload is not.
    if (transaction.userId !== user.id || transaction.bookId !== bookId || transaction.accountId !== accountId || transaction.type !== type || Number(transaction.amount) !== Number(amount.toFixed(2)) || transaction.categoryId !== (data.categoryId || null) || transaction.destinationAccountId !== (data.destinationAccountId || null) || (transaction.description || '') !== description || transaction.transactionDate.getTime() !== transactionDate?.getTime()) {
      return NextResponse.json({ detail: 'Mã giao dịch đã được sử dụng cho dữ liệu khác.' }, { status:409 });
    }
    return NextResponse.json(json(transaction), { status:201 });
  };
  if (type === 'transfer') {
    if (!destinationAccount || destinationAccount.id === account.id) return NextResponse.json({ detail:'Vui lòng chọn hai ví khác nhau.' }, { status:400 });
    if (destinationAccount.currency !== account.currency) return NextResponse.json({ detail:'Chỉ có thể chuyển tiền giữa hai ví cùng loại tiền tệ.' }, { status:400 });
    if (!Number.isFinite(amount) || amount<=0 || !transactionDate) return NextResponse.json({ detail:'Vui lòng nhập số tiền và ngày chuyển hợp lệ.' }, { status:400 });
    return create({ userId:user.id,bookId,accountId,destinationAccountId,type,amount,currency:account.currency,categoryId:null,category:'Chuyển tiền',description:description||null,transactionDate });
  }
  if (!['income','expense'].includes(type) || !Number.isFinite(amount) || amount<=0 || !category || !transactionDate) return NextResponse.json({ detail:'Vui lòng chọn một danh mục hợp lệ và nhập đầy đủ thông tin.' }, { status:400 });
  return create({ userId:user.id,bookId,accountId,type,amount,currency:account.currency,categoryId:category.id,category:category.name,description:description||null,transactionDate });
}
