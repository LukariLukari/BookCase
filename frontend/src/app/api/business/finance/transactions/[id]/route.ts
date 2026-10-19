import { NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

const deny = () => NextResponse.json({ detail:'Phiên đăng nhập không hợp lệ.' }, { status:401 });
const parseDate = (value:unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(value||'')) ? new Date(`${String(value)}T12:00:00+07:00`) : null;

export async function PUT(request:Request,context:RouteContext<'/api/business/finance/transactions/[id]'>){
  const user=getRequestUser(request);if(!user)return deny();const {id}=await context.params;const current=await prisma.financeTransaction.findFirst({where:{id,userId:user.id}});if(!current)return NextResponse.json({detail:'Không tìm thấy giao dịch.'},{status:404});
  const body=await request.json(),accountId=String(body.accountId||''),type=String(body.type||''),amount=Number(body.amount),category=String(body.category||'').trim(),description=String(body.description||'').trim(),transactionDate=parseDate(body.date);const account=await prisma.moneyAccount.findFirst({where:{id:accountId,bookId:current.bookId,userId:user.id}});
  if(!account||!['income','expense'].includes(type)||!Number.isFinite(amount)||amount<=0||!category||!transactionDate)return NextResponse.json({detail:'Thông tin giao dịch không hợp lệ.'},{status:400});
  const row=await prisma.financeTransaction.update({where:{id},data:{accountId,type,amount,currency:account.currency,category,description:description||null,transactionDate},include:{account:{select:{id:true,name:true,type:true}}}});return NextResponse.json({id:row.id,type:row.type,amount:Number(row.amount),currency:row.currency,category:row.category,description:row.description||'',date:row.transactionDate,createdAt:row.createdAt,account:row.account});
}

export async function DELETE(request:Request,context:RouteContext<'/api/business/finance/transactions/[id]'>){const user=getRequestUser(request);if(!user)return deny();const {id}=await context.params;const current=await prisma.financeTransaction.findFirst({where:{id,userId:user.id}});if(!current)return NextResponse.json({detail:'Không tìm thấy giao dịch.'},{status:404});await prisma.financeTransaction.delete({where:{id}});return NextResponse.json({success:true});}
