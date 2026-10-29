import { NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { validateSubscription } from '@/lib/subscriptions';
import { SubscriptionError, subscriptionBody, subscriptionData, subscriptionFailure, subscriptionJson, subscriptionUnauthorized } from '@/lib/subscriptionServer';
import { createAutomaticBusinessBackup } from '@/lib/businessBackup';

export async function GET(request: Request) {
  const user = getRequestUser(request);
  if (!user) return subscriptionUnauthorized();
  try {
    const rows = await prisma.customerSubscription.findMany({ where: { userId: user.id }, orderBy: [{ cancelDate: 'asc' }, { createdAt: 'asc' }] });
    return NextResponse.json(rows.map(subscriptionJson));
  } catch (error) { return subscriptionFailure(error); }
}

export async function POST(request: Request) {
  const user = getRequestUser(request);
  if (!user) return subscriptionUnauthorized();
  try {
    const body = await subscriptionBody(request);
    const parsed = validateSubscription(body);
    if ('error' in parsed) throw new SubscriptionError(parsed.error);
    const renewFromId = (body as Record<string, unknown>).renewFromId;
    if (renewFromId !== undefined && (typeof renewFromId !== 'string' || !renewFromId || renewFromId.length > 100)) throw new SubscriptionError('Kỳ gia hạn không hợp lệ.');
    const row = await prisma.$transaction(async tx => {
      if (parsed.data.customerId && !await tx.businessCustomer.findFirst({ where: { id: parsed.data.customerId, userId: user.id }, select: { id: true } })) {
        throw new SubscriptionError('Không tìm thấy khách hàng trong tài khoản của bạn.', 404);
      }
      if (typeof renewFromId === 'string') {
        const previous = await tx.customerSubscription.findFirst({ where: { id: renewFromId, userId: user.id } });
        if (!previous) throw new SubscriptionError('Không tìm thấy kỳ cần gia hạn.', 404);
        if (parsed.data.startDate < previous.endDate.toISOString().slice(0, 10)) throw new SubscriptionError('Kỳ mới phải bắt đầu từ ngày hết hạn của kỳ trước trở đi.');
        const changed = await tx.customerSubscription.updateMany({ where: { id: renewFromId, userId: user.id, status: 'active' }, data: { status: 'renewed' } });
        if (!changed.count) throw new SubscriptionError('Kỳ này đã được xử lý. Hãy tải lại lịch trước khi gia hạn.', 409);
      }
      return tx.customerSubscription.create({ data: { ...subscriptionData(parsed.data), userId: user.id } });
    });
    await createAutomaticBusinessBackup(user.id, 'Sau khi thêm gói gia hạn');
    return NextResponse.json(subscriptionJson(row), { status: 201 });
  } catch (error) { return subscriptionFailure(error); }
}
