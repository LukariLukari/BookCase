export const durationUnits = ['day', 'month', 'year'] as const;
export type DurationUnit = typeof durationUnits[number];
export const subscriptionCurrencies = ['VND', 'USD', 'THB', 'EUR'] as const;
export type SubscriptionStatus = 'active' | 'cancelled' | 'renewed';

export type SubscriptionInput = {
  customerId: string | null;
  customerName: string;
  customerContact: string;
  appName: string;
  planName: string;
  account: string;
  durationValue: number;
  durationUnit: DurationUnit;
  price: string;
  currency: string;
  startDate: string;
  cancelDate: string;
  note: string;
};

export type Subscription = SubscriptionInput & {
  id: string;
  endDate: string;
  status: SubscriptionStatus;
};

export function todayKey(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '2000-01-01' || value > '2199-12-31') return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// Keep monthly renewals on the final available day for dates such as 31 January.
export function subscriptionEnd(start: string, count: number, unit: DurationUnit) {
  if (!validDate(start) || !Number.isInteger(count) || count < 1 || count > 3650) return '';
  if (unit === 'day') return addDays(start, count);
  const date = new Date(`${start}T00:00:00Z`);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + count * (unit === 'year' ? 12 : 1));
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.toISOString().slice(0, 10);
}

export function defaultCancelDate(start: string, end: string, daysBefore = 0) {
  return end ? [start, addDays(end, -daysBefore)].sort().at(-1)! : '';
}

export function calendarDays(month: string) {
  const first = `${month}-01`;
  const weekday = new Date(`${first}T00:00:00Z`).getUTCDay();
  const start = addDays(first, -((weekday + 6) % 7));
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

export function reminderState(item: Pick<Subscription, 'status' | 'cancelDate'>, today: string) {
  if (item.status !== 'active') return item.status;
  if (item.cancelDate < today) return 'overdue';
  if (item.cancelDate === today) return 'today';
  return 'upcoming';
}

export function validateSubscription(value: unknown): { data: SubscriptionInput & { endDate: string } } | { error: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { error: 'Dữ liệu gói không hợp lệ.' };
  const body = value as Record<string, unknown>;
  const text = (key: string) => typeof body[key] === 'string' ? body[key].trim() : '';
  const customerName = text('customerName'), appName = text('appName'), account = text('account');
  if (!customerName || !appName || !account) return { error: 'Nhập tên khách, ứng dụng và tài khoản sử dụng gói.' };
  for (const key of ['customerName', 'customerContact', 'appName', 'planName', 'account']) {
    if (text(key).length > 250) return { error: 'Mỗi thông tin chỉ được tối đa 250 ký tự.' };
  }
  if (text('note').length > 5000) return { error: 'Ghi chú chỉ được tối đa 5.000 ký tự.' };
  const durationUnit = text('durationUnit') as DurationUnit;
  const durationValue = body.durationValue;
  if (!durationUnits.includes(durationUnit) || typeof durationValue !== 'number' || !Number.isInteger(durationValue) || durationValue < 1 || durationValue > ({ day: 3650, month: 120, year: 10 }[durationUnit] ?? 0)) {
    return { error: 'Thời hạn phải từ 1 ngày đến tối đa 10 năm.' };
  }
  const price = text('price');
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(price)) return { error: 'Giá gói phải là số không âm, tối đa 12 chữ số và 2 số thập phân.' };
  const currency = text('currency');
  if (!subscriptionCurrencies.includes(currency as typeof subscriptionCurrencies[number])) return { error: 'Đơn vị tiền tệ không hợp lệ.' };
  const startDate = text('startDate'), cancelDate = text('cancelDate');
  if (!validDate(startDate) || !validDate(cancelDate)) return { error: 'Ngày bắt đầu hoặc ngày nhắc hủy không hợp lệ.' };
  const endDate = subscriptionEnd(startDate, durationValue, durationUnit);
  if (!validDate(endDate) || cancelDate < startDate || cancelDate > endDate) return { error: 'Ngày nhắc hủy phải nằm trong thời gian của gói.' };
  const customerId = text('customerId') || null;
  if (customerId && !/^[a-zA-Z0-9-]{1,100}$/.test(customerId)) return { error: 'Khách hàng không hợp lệ.' };
  return { data: { customerId, customerName, customerContact: text('customerContact'), appName, planName: text('planName'), account, durationValue, durationUnit, price, currency, startDate, endDate, cancelDate, note: text('note') } };
}
