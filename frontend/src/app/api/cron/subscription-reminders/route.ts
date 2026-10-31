import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { dispatchSubscriptionPush } from '@/lib/webPushServer';
import { SubscriptionError } from '@/lib/subscriptionServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const received = Buffer.from(request.headers.get('authorization') || '');
  const expected = Buffer.from(`Bearer ${secret || ''}`);
  if (!secret || received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  try {
    const result = await dispatchSubscriptionPush();
    return NextResponse.json(result, { status: result.failed || result.incomplete ? 503 : 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[WebPush] Scheduled dispatch failed');
    return NextResponse.json({ detail: error instanceof SubscriptionError ? error.message : 'Không thể chạy lịch nhắc. Kiểm tra máy chủ và cơ sở dữ liệu.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
