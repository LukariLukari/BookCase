import { NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { validateSubscription } from '@/lib/subscriptions';
import { SubscriptionError, subscriptionBody, subscriptionData, subscriptionFailure, subscriptionJson, subscriptionUnauthorized } from '@/lib/subscriptionServer';
import { createAutomaticBusinessBackup } from '@/lib/businessBackup';

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Context) {
  const user = getRequestUser(request);
  if (!user) return subscriptionUnauthorized();
  try {
    const { id } = await context.params;
    const parsed = validateSubscription(await subscriptionBody(request));
    if ('error' in parsed) throw new SubscriptionError(parsed.error);
    const row = await prisma.$transaction(async tx => {
      if (parsed.data.customerId && !await tx.businessCustomer.findFirst({ where: { id: parsed.data.customerId, userId: user.id }, select: { id: true } })) throw new SubscriptionError('Không tìm thấy khách hàng trong tài khoản của bạn.', 404);
      const changed = await tx.customerSubscription.updateMany({ where: { id, userId: user.id }, data: subscriptionData(parsed.data) });
      if (!changed.count) throw new SubscriptionError('Không tìm thấy gói đăng ký.', 404);
      return tx.customerSubscription.findFirstOrThrow({ where: { id, userId: user.id } });
    });
    await createAutomaticBusinessBackup(user.id, 'Sau khi sửa gói gia hạn');
    return NextResponse.json(subscriptionJson(row));
  } catch (error) { return subscriptionFailure(error); }
}

export async function PATCH(request: Request, context: Context) {
  const user = getRequestUser(request);
  if (!user) return subscriptionUnauthorized();
  try {
    const { id } = await context.params;
    const body = await subscriptionBody(request);
    const status = body && typeof body === 'object' ? (body as Record<string, unknown>).status : undefined;
    if (status !== 'active' && status !== 'cancelled') throw new SubscriptionError('Trạng thái không hợp lệ.');
    const row = await prisma.$transaction(async tx => {
      const changed = await tx.customerSubscription.updateMany({ where: { id, userId: user.id, status: { not: 'renewed' } }, data: { status } });
      if (!changed.count) throw new SubscriptionError('Không tìm thấy gói hoặc kỳ này đã được gia hạn.', 404);
      return tx.customerSubscription.findFirstOrThrow({ where: { id, userId: user.id } });
    });
    await createAutomaticBusinessBackup(user.id, 'Sau khi đổi trạng thái gói gia hạn');
    return NextResponse.json(subscriptionJson(row));
  } catch (error) { return subscriptionFailure(error); }
}

export async function DELETE(request: Request, context: Context) {
  const user = getRequestUser(request);
  if (!user) return subscriptionUnauthorized();
  try {
    const { id } = await context.params;
    const deleted = await prisma.customerSubscription.deleteMany({ where: { id, userId: user.id } });
    if (!deleted.count) throw new SubscriptionError('Không tìm thấy gói đăng ký.', 404);
    await createAutomaticBusinessBackup(user.id, 'Sau khi xóa gói gia hạn');
    return NextResponse.json({ ok: true });
  } catch (error) { return subscriptionFailure(error); }
}
