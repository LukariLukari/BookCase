import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getRequestUser } from '@/lib/auth';
import { createAutomaticBusinessBackup } from '@/lib/businessBackup';

const unauthorized = () => NextResponse.json({ detail: 'Phiên đăng nhập không hợp lệ.' }, { status: 401 });

export async function GET(request: Request, context: RouteContext<'/api/sales/orders/[id]/payments'>) {
  const user = getRequestUser(request); if (!user) return unauthorized();
  const { id } = await context.params;
  const order = await prisma.businessOrder.findFirst({ where: { id, userId: user.id }, include: { items: true, payments: true } });
  if (!order) return NextResponse.json({ detail: 'Không tìm thấy đơn.' }, { status: 404 });
  const total = order.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, order.shippingFee - order.discount);
  const paid = order.payments.reduce((sum, payment) => sum + payment.amount, 0);
  return NextResponse.json({ total, paid, remaining: Math.max(0, total - paid), payments: order.payments });
}

export async function POST(request: Request, context: RouteContext<'/api/sales/orders/[id]/payments'>) {
  const user = getRequestUser(request); if (!user) return unauthorized();
  const { id } = await context.params, body = await request.json();
  const requestedAmount = Math.max(0, Math.round(Number(body.amount) || 0));
  if (!requestedAmount) return NextResponse.json({ detail: 'Số tiền thanh toán phải lớn hơn 0.' }, { status: 400 });
  const order = await prisma.businessOrder.findFirst({ where: { id, userId: user.id }, include: { items: true, payments: true } });
  if (!order) return NextResponse.json({ detail: 'Không tìm thấy đơn.' }, { status: 404 });
  const total = order.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, order.shippingFee - order.discount);
  const paid = order.payments.reduce((sum, payment) => sum + payment.amount, 0);
  const remaining = Math.max(0, total - paid), amount = Math.min(requestedAmount, remaining);
  if (!amount) return NextResponse.json({ detail: 'Đơn hàng đã được thanh toán đủ.' }, { status: 409 });
  const payment = await prisma.$transaction(async tx => {
    const created = await tx.businessOrderPayment.create({ data: { userId:user.id, orderId:id, amount, method:String(body.method||'cash'), note:body.note||null, paidAt:body.paid_at?new Date(body.paid_at):new Date() } });
    await tx.businessOrder.update({ where:{id}, data:{paymentStatus:paid+amount>=total?'paid':'partial'} });
    return created;
  });
  await createAutomaticBusinessBackup(user.id,'Sau khi ghi nhận thanh toán');
  return NextResponse.json({ ...payment, remaining: Math.max(0, remaining - amount) }, { status: 201 });
}
