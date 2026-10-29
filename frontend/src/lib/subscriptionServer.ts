import { NextResponse } from 'next/server';
import type { CustomerSubscription } from '@prisma/client';
import type { SubscriptionInput } from './subscriptions';

export class SubscriptionError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function subscriptionBody(request: Request) {
  try { return await request.json() as unknown; }
  catch { throw new SubscriptionError('Dữ liệu gửi lên không hợp lệ.'); }
}

export function subscriptionData(data: SubscriptionInput & { endDate: string }) {
  return {
    ...data,
    startDate: new Date(`${data.startDate}T00:00:00Z`),
    endDate: new Date(`${data.endDate}T00:00:00Z`),
    cancelDate: new Date(`${data.cancelDate}T00:00:00Z`),
  };
}

export function subscriptionJson(row: CustomerSubscription) {
  return {
    id: row.id, customerId: row.customerId, customerName: row.customerName,
    customerContact: row.customerContact || '', appName: row.appName,
    planName: row.planName || '', account: row.account, durationValue: row.durationValue,
    durationUnit: row.durationUnit, price: row.price.toString(), currency: row.currency,
    startDate: row.startDate.toISOString().slice(0, 10),
    endDate: row.endDate.toISOString().slice(0, 10),
    cancelDate: row.cancelDate.toISOString().slice(0, 10),
    status: row.status, note: row.note || '',
  };
}

export function subscriptionFailure(error: unknown) {
  if (error instanceof SubscriptionError) return NextResponse.json({ detail: error.message }, { status: error.status });
  console.error('[Subscriptions] Request failed', error);
  return NextResponse.json({ detail: 'Không thể lưu hoặc tải lịch gia hạn. Vui lòng thử lại.' }, { status: 500 });
}

export const subscriptionUnauthorized = () => NextResponse.json({ detail: 'Phiên đăng nhập không hợp lệ.' }, { status: 401 });
