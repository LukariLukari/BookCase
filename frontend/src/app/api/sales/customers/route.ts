import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getRequestUser } from '@/lib/auth';
import type { Prisma } from '@prisma/client';
import { createAutomaticBusinessBackup } from '@/lib/businessBackup';

const deny = () => NextResponse.json({ detail: 'Phiên đăng nhập không hợp lệ.' }, { status: 401 });
type CustomerWithOrders = Prisma.BusinessCustomerGetPayload<{ include: { orders: { include: { items: true } } } }>;
const customerJson = (customer: CustomerWithOrders) => {
  const orders = customer.orders || [];
  const revenue = orders.filter(order => order.status !== 'cancelled').reduce((sum, order) => sum + order.items.reduce((subtotal, item) => subtotal + item.quantity * item.unitPrice, order.shippingFee - order.discount), 0);
  return { id:customer.id,name:customer.name,phone:customer.phone,email:customer.email,social_link:customer.socialLink,address:customer.address,tags:customer.tags,note:customer.note,order_count:orders.length,total_spent:revenue,last_order_at:orders[0]?.orderedAt||null,created_at:customer.createdAt };
};

export async function GET(request: NextRequest) {
  const user = getRequestUser(request); if (!user) return deny();
  const query = request.nextUrl.searchParams.get('q')?.trim();
  const customers = await prisma.businessCustomer.findMany({ where:{userId:user.id,...(query?{OR:[{name:{contains:query,mode:'insensitive'}},{phone:{contains:query}},{email:{contains:query,mode:'insensitive'}}]}:{})}, include:{orders:{include:{items:true},orderBy:{orderedAt:'desc'}}}, orderBy:{updatedAt:'desc'} });
  return NextResponse.json(customers.map(customerJson));
}

export async function POST(request: Request) {
  const user = getRequestUser(request); if (!user) return deny();
  const body = await request.json(); const name=String(body.name||'').trim(),phone=String(body.phone||'').trim()||null;
  if(!name)return NextResponse.json({detail:'Vui lòng nhập tên khách hàng.'},{status:400});
  const customer=await prisma.businessCustomer.create({data:{userId:user.id,name,phone,email:String(body.email||'').trim().toLowerCase()||null,socialLink:body.social_link||null,address:body.address||null,tags:Array.isArray(body.tags)?body.tags:[],note:body.note||null},include:{orders:{include:{items:true}}}});
  await createAutomaticBusinessBackup(user.id,'Sau khi thêm khách hàng');
  return NextResponse.json(customerJson(customer),{status:201});
}
