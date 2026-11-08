import type { Order, Report } from '@/app/business/BusinessClient';

export type SaleChannel = 'pos' | 'inventory' | 'unknown';
export type SalesFilters = { channel: 'all' | SaleChannel; payment: string; status: string; from: string; to: string; query: string };
export const defaultSalesFilters: SalesFilters = { channel: 'all', payment: 'all', status: 'all', from: '', to: '', query: '' };
export const saleChannelLabels = { all: 'Tất cả đơn', pos: 'Bán tại quầy', inventory: 'Đơn từ kho', unknown: 'Chưa phân loại' };
export const saleStatusLabels: Record<string, string> = { all: 'Tất cả trạng thái đơn', confirmed: 'Mới xác nhận', packing: 'Đang đóng gói', shipping: 'Đang giao', completed: 'Hoàn tất', cancelled: 'Đã hủy' };
const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' });

export function salesDay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = dayFormatter.formatToParts(date);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-');
}

export function orderChannel(order: Order): SaleChannel {
  return order.sale_channel === 'pos' || order.sale_channel === 'inventory' ? order.sale_channel : 'unknown';
}

export function filterSalesOrders(orders: Order[], filters: SalesFilters) {
  const query = filters.query.trim().toLocaleLowerCase('vi');
  return orders.filter(order => {
    const day = salesDay(order.ordered_at);
    return (!filters.from || day >= filters.from) && (!filters.to || day <= filters.to)
      && (filters.channel === 'all' || orderChannel(order) === filters.channel)
      && (filters.payment === 'all' || order.payment_status === filters.payment)
      && (filters.status === 'all' || (order.status || 'confirmed') === filters.status)
      && (!query || `${order.code} ${order.customer_name} ${order.customer_contact || ''} ${order.note || ''} ${order.items.map(item => item.product_name).join(' ')}`.toLocaleLowerCase('vi').includes(query));
  });
}

export function groupSalesOrders(orders: Order[]) {
  const groups = new Map<string, Order[]>();
  for (const order of [...orders].sort((a, b) => b.ordered_at.localeCompare(a.ordered_at))) {
    const day = salesDay(order.ordered_at);
    const rows = groups.get(day) || [];
    rows.push(order);
    groups.set(day, rows);
  }
  return [...groups].sort(([a], [b]) => b.localeCompare(a));
}

export async function loadLedgerOrders(ledger: string, headers: Record<string, string>, base = '/api/backend', signal?: AbortSignal): Promise<Order[]> {
  if (!ledger.trim()) throw new Error('Chọn sổ bán hàng trước khi tải đơn để xuất file.');
  const orders: Order[] = [];
  const ids = new Set<string>();
  const size = 500;
  for (let offset = 0; ; offset += size) {
    const response = await fetch(`${base}/api/business/orders?ledger_id=${encodeURIComponent(ledger)}&limit=${size}&offset=${offset}`, { headers, signal });
    if (!response.ok) throw new Error('Không tải được đầy đủ đơn hàng để lọc và xuất file.');
    const page: Order[] = await response.json();
    if (!Array.isArray(page)) throw new Error('Dữ liệu đơn hàng không hợp lệ.');
    for (const order of page) {
      if (ids.has(order.id)) throw new Error('Dữ liệu đơn hàng đã thay đổi. Hãy tải lại để xuất đầy đủ.');
      ids.add(order.id);
      orders.push(order);
    }
    if (page.length < size) break;
  }
  return orders;
}

export function filteredSalesReport(orders: Order[], report: Report, filters: SalesFilters): Report {
  const active = filterSalesOrders(orders, filters).filter(order => order.status !== 'cancelled');
  // Operating expenses belong to a ledger, not to a sales channel/payment status.
  const expenses = filters.channel === 'all' && filters.payment === 'all' && filters.status === 'all' && !filters.query.trim()
    ? report.expenses.filter(expense => (!filters.from || salesDay(expense.spent_at) >= filters.from) && (!filters.to || salesDay(expense.spent_at) <= filters.to)) : [];
  const sum = (key: keyof Order) => active.reduce((total, order) => total + Number(order[key] || 0), 0);
  const revenue = sum('total'), capital = sum('capital_cost'), shipping = sum('shipping_cost'), other = sum('other_fee');
  const operating = expenses.reduce((total, expense) => total + expense.amount, 0);
  const net = sum('profit') - operating;
  const products = new Map<string, { product_id: string; name: string; quantity: number; revenue: number }>();
  for (const order of active) for (const item of order.items) {
    const previous = products.get(item.product_id) || { product_id: item.product_id, name: item.product_name, quantity: 0, revenue: 0 };
    previous.quantity += item.quantity;
    previous.revenue += item.quantity * item.unit_price;
    products.set(item.product_id, previous);
  }
  return { ...report, revenue, net_revenue: revenue - sum('shipping_fee'), capital_cost: capital, shipping_cost: shipping, other_order_fee: other, operating_expense: operating,
    gross_profit: revenue - sum('shipping_fee') - capital, net_profit: net, profit: net, profit_after_inventory: net - report.stock_value,
    order_count: active.length, sold_units: sum('item_count'), average_order_value: active.length ? revenue / active.length : 0,
    daily: groupSalesOrders(active).map(([date, rows]) => ({ date, orders: rows.length, revenue: rows.reduce((total, order) => total + order.total, 0), profit: rows.reduce((total, order) => total + order.profit, 0) })),
    top_products: [...products.values()].sort((a, b) => b.revenue - a.revenue), expenses };
}
