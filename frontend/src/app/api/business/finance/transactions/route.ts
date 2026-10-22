import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

const deny = () => NextResponse.json({ detail: 'Phiên đăng nhập không hợp lệ.' }, { status: 401 });
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const parseDate = (value: unknown, end = false) => {
  const raw = String(value || '');
  if (!datePattern.test(raw)) return null;
  const parsed = new Date(`${raw}T${end ? '23:59:59.999' : '12:00:00'}+07:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const json = (item: { id:string;type:string;amount:unknown;currency:string;category:string;categoryId:string|null;description:string|null;transactionDate:Date;createdAt:Date;account:{id:string;name:string;type:string};categoryRef:{name:string;icon:string;color:string}|null }) => ({ id:item.id,type:item.type,amount:Number(item.amount),currency:item.currency,categoryId:item.categoryId,category:item.categoryRef?.name||item.category,categoryIcon:item.categoryRef?.icon||null,categoryColor:item.categoryRef?.color||null,description:item.description||'',date:item.transactionDate,createdAt:item.createdAt,account:item.account });

export async function GET(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) return deny();
  const bookId = request.nextUrl.searchParams.get('bookId') || '';
  const from = request.nextUrl.searchParams.get('from');
  const to = request.nextUrl.searchParams.get('to');
  const type = request.nextUrl.searchParams.get('type');
  const book = await prisma.expenseBook.findFirst({ where: { id: bookId, userId: user.id } });
  if (!book) return NextResponse.json({ detail: 'Không tìm thấy sổ chi tiêu.' }, { status: 404 });
  const fromDate = from ? parseDate(from) : null;
  const toDate = to ? parseDate(to, true) : null;
  const transactions = await prisma.financeTransaction.findMany({
    where: { userId:user.id,bookId,...(type==='income'||type==='expense'?{type}:{}),...(fromDate||toDate?{transactionDate:{...(fromDate?{gte:fromDate}:{}),...(toDate?{lte:toDate}:{})}}:{}) },
    include: { account: { select: { id:true,name:true,type:true } }, categoryRef: { select: { name:true,icon:true,color:true } } },
    orderBy: [{ transactionDate:'desc' }, { createdAt:'desc' }],
  });
  return NextResponse.json({ transactions: transactions.map(json) });
}

export async function POST(request: Request) {
  const user = getRequestUser(request);
  if (!user) return deny();
  const body = await request.json();
  const bookId = String(body.bookId || ''), accountId = String(body.accountId || ''), type = String(body.type || 'expense'), categoryId = String(body.categoryId || '');
  const amount = Number(body.amount), description = String(body.description || '').trim(), date = String(body.date || ''), transactionDate = parseDate(date);
  const account = await prisma.moneyAccount.findFirst({ where: { id:accountId,bookId,userId:user.id } });
  if (!account) return NextResponse.json({ detail:'Tài khoản tiền không thuộc sổ đã chọn.' }, { status:404 });
  const category = await prisma.financeCategory.findFirst({ where: { id:categoryId,userId:user.id,type } });
  if (!['income','expense'].includes(type) || !Number.isFinite(amount) || amount<=0 || !category || !transactionDate) return NextResponse.json({ detail:'Vui lòng chọn một danh mục hợp lệ và nhập đầy đủ thông tin.' }, { status:400 });
  const transaction = await prisma.financeTransaction.create({ data:{ userId:user.id,bookId,accountId,type,amount,currency:account.currency,categoryId:category.id,category:category.name,description:description||null,transactionDate }, include:{account:{select:{id:true,name:true,type:true}},categoryRef:{select:{name:true,icon:true,color:true}}} });
  return NextResponse.json(json(transaction), { status:201 });
}
