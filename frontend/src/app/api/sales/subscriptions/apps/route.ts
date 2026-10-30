import { NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { SubscriptionError, subscriptionBody, subscriptionFailure, subscriptionUnauthorized } from '@/lib/subscriptionServer';

export async function GET(request: Request) {
  const user = getRequestUser(request);
  if (!user) return subscriptionUnauthorized();
  try {
    const [apps, subscriptions] = await Promise.all([
      prisma.subscriptionApp.findMany({ where: { userId: user.id }, select: { name: true } }),
      prisma.customerSubscription.findMany({ where: { userId: user.id }, distinct: ['appName'], select: { appName: true } }),
    ]);
    return NextResponse.json([...new Set(['Canva', 'Netflix', ...apps.map(app => app.name), ...subscriptions.map(item => item.appName)])].sort((a, b) => a.localeCompare(b, 'vi')));
  } catch (error) { return subscriptionFailure(error); }
}

export async function POST(request: Request) {
  const user = getRequestUser(request);
  if (!user) return subscriptionUnauthorized();
  try {
    const body = await subscriptionBody(request);
    const name = body && typeof body === 'object' && 'name' in body && typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 250) throw new SubscriptionError('Tên ứng dụng phải từ 1 đến 250 ký tự.');
    const app = await prisma.subscriptionApp.upsert({
      where: { userId_name: { userId: user.id, name } },
      create: { userId: user.id, name }, update: {},
    });
    return NextResponse.json({ name: app.name });
  } catch (error) { return subscriptionFailure(error); }
}
