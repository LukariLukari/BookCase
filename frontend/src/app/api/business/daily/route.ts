import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getRequestUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function getVietnamDateString(date: Date = new Date()): string {
  // Asia/Ho_Chi_Minh is UTC+7
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date); // Returns YYYY-MM-DD
}

function orderTotals(o: any) {
  const subtotal = (o.items || []).reduce((s: number, i: any) => s + i.quantity * i.unitPrice, 0);
  const capital = (o.items || []).reduce((s: number, i: any) => s + i.quantity * i.unitCost, 0);
  const total = subtotal + (o.shippingFee || 0) - (o.discount || 0);
  const profit = total - capital - (o.shippingCost || 0) - (o.otherFee || 0);
  return { subtotal, capital_cost: capital, total, profit };
}

export async function GET(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) {
    return NextResponse.json({ detail: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' }, { status: 401 });
  }

  const todayVN = getVietnamDateString();
  const queryDate = request.nextUrl.searchParams.get('date')?.trim();
  let targetDateStr = queryDate && /^\d{4}-\d{2}-\d{2}$/.test(queryDate)
    ? queryDate
    : todayVN;

  // Cannot query future dates:
  if (targetDateStr > todayVN) {
    targetDateStr = todayVN;
  }

  // Create date window in UTC corresponding to Vietnam UTC+7 day:
  // VN 00:00:00 is UTC-7h of previous day:
  const dayStartVN = new Date(`${targetDateStr}T00:00:00+07:00`);
  const dayEndVN = new Date(`${targetDateStr}T23:59:59.999+07:00`);

  // To also ensure any orders with orderedAt stored as raw UTC or local are captured,
  // we query with a slightly wider buffer and filter accurately in memory:
  const searchStart = new Date(dayStartVN.getTime() - 14 * 3600 * 1000);
  const searchEnd = new Date(dayEndVN.getTime() + 14 * 3600 * 1000);

  const candidateOrders = await prisma.businessOrder.findMany({
    where: {
      userId: user.id,
      status: { not: 'cancelled' },
      orderedAt: {
        gte: searchStart,
        lte: searchEnd,
      },
    },
    include: {
      items: true,
    },
    orderBy: {
      orderedAt: 'desc',
    },
  });

  // Accurate day matching: check both VN timezone and raw date string
  const orders = candidateOrders.filter(order => {
    const vnDate = getVietnamDateString(new Date(order.orderedAt));
    const rawIsoDate = new Date(order.orderedAt).toISOString().slice(0, 10);
    return vnDate === targetDateStr || rawIsoDate === targetDateStr;
  });

  let totalRevenue = 0;
  let totalProfit = 0;
  let totalSoldUnits = 0;

  const itemMap = new Map<string, {
    productId: string;
    productName: string;
    quantity: number;
    revenue: number;
    unitPrice: number;
    orderCount: number;
  }>();

  for (const order of orders) {
    const totals = orderTotals(order);
    totalRevenue += totals.total;
    totalProfit += totals.profit;

    for (const item of order.items) {
      totalSoldUnits += item.quantity;
      const key = item.productId || item.productName;
      const existing = itemMap.get(key) || {
        productId: item.productId,
        productName: item.productName,
        quantity: 0,
        revenue: 0,
        unitPrice: item.unitPrice,
        orderCount: 0,
      };

      existing.quantity += item.quantity;
      existing.revenue += item.quantity * item.unitPrice;
      existing.orderCount += 1;
      existing.unitPrice = item.unitPrice; // latest price
      itemMap.set(key, existing);
    }
  }

  const items = Array.from(itemMap.values()).map(item => ({
    ...item,
    percentageQuantity: totalSoldUnits > 0 ? Math.round((item.quantity / totalSoldUnits) * 100) : 0,
    percentageRevenue: totalRevenue > 0 ? Math.round((item.revenue / totalRevenue) * 100) : 0,
  }));

  // Also query recent dates with orders for quick navigation
  const recentOrders = await prisma.businessOrder.findMany({
    where: {
      userId: user.id,
      status: { not: 'cancelled' },
    },
    select: {
      orderedAt: true,
      shippingFee: true,
      discount: true,
      items: {
        select: {
          quantity: true,
          unitPrice: true,
        },
      },
    },
    orderBy: {
      orderedAt: 'desc',
    },
    take: 300,
  });

  const datesMap = new Map<string, { date: string; revenue: number; orderCount: number }>();
  for (const o of recentOrders) {
    const d = getVietnamDateString(new Date(o.orderedAt));
    const subtotal = o.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const tot = subtotal + (o.shippingFee || 0) - (o.discount || 0);
    const curr = datesMap.get(d) || { date: d, revenue: 0, orderCount: 0 };
    curr.revenue += tot;
    curr.orderCount += 1;
    datesMap.set(d, curr);
  }

  const availableDates = Array.from(datesMap.values())
    .filter(d => d.date <= todayVN)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30);

  return NextResponse.json({
    date: targetDateStr,
    totalRevenue,
    orderCount: orders.length,
    soldUnits: totalSoldUnits,
    totalProfit,
    averageOrderValue: orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0,
    items,
    orders: orders.map(o => ({
      id: o.id,
      code: o.code,
      customerName: o.customerName,
      customerContact: o.customerContact,
      orderedAt: o.orderedAt,
      total: orderTotals(o).total,
      profit: orderTotals(o).profit,
      itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
      items: o.items.map(i => ({
        productName: i.productName,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
    })),
    availableDates,
  });
}
