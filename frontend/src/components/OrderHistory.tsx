'use client';

import { useMemo, type ReactNode } from 'react';
import { CalendarDays, Search } from 'lucide-react';
import type { Order } from '@/app/business/BusinessClient';
import { FinanceDatePicker, FinanceSelect } from '@/app/business/expenses/FinancePicker';
import { defaultSalesFilters, filterSalesOrders, groupSalesOrders, orderChannel, saleChannelLabels, saleStatusLabels, type SalesFilters } from '@/lib/salesData';

const money = (value: number) => `${value.toLocaleString('vi-VN')} đ`;
const formatDay = (value: string) => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'full' }).format(new Date(`${value}T00:00:00Z`));

export default function OrderHistory({ orders, loading, filters, onChange, renderOrder }: {
  orders: Order[]; loading: boolean; filters: SalesFilters; onChange: (filters: SalesFilters) => void; renderOrder: (order: Order) => ReactNode;
}) {
  const filtered = useMemo(() => filterSalesOrders(orders, filters), [orders, filters]);
  const groups = useMemo(() => groupSalesOrders(filtered), [filtered]);
  const update = (value: Partial<SalesFilters>) => onChange({ ...filters, ...value });
  const active = filtered.filter(order => order.status !== 'cancelled');
  const invalidDates = !!filters.from && !!filters.to && filters.from > filters.to;
  return <div className="space-y-7">
    <section className="content-panel card-push space-y-4" aria-label="Lọc đơn hàng">
      <div className="flex flex-wrap gap-2">{(Object.entries(saleChannelLabels) as [SalesFilters['channel'], string][]).map(([value, label]) => <button key={value} type="button" onClick={() => update({ channel: value })} aria-pressed={filters.channel === value} className={`btn-push min-h-11 px-3 py-2 text-sm font-bold ${filters.channel === value ? 'btn-push-primary' : ''}`}>{label} <span className="ml-1 text-xs">({value === 'all' ? orders.length : orders.filter(order => orderChannel(order) === value).length})</span></button>)}</div>
      <div className="relative"><Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" /><input value={filters.query} onChange={event => update({ query: event.target.value })} aria-label="Tìm đơn hàng" placeholder="Mã đơn, khách, liên hệ, sản phẩm, ghi chú..." className="h-12 w-full pl-10 pr-3" /></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label><span className="mb-2 block text-xs font-bold">Từ ngày</span><FinanceDatePicker value={filters.from} label="Lọc đơn từ ngày" onChange={from => update({ from })} /></label><label><span className="mb-2 block text-xs font-bold">Đến ngày</span><FinanceDatePicker value={filters.to} label="Lọc đơn đến ngày" onChange={to => update({ to })} /></label><label><span className="mb-2 block text-xs font-bold">Thanh toán</span><FinanceSelect placeholder="" value={filters.payment} label="Lọc trạng thái thanh toán" onChange={payment => update({ payment })} options={[{ value: 'all', label: 'Tất cả trạng thái' }, { value: 'paid', label: 'Đã thanh toán' }, { value: 'pending', label: 'Chưa thanh toán' }, { value: 'partial', label: 'Thanh toán một phần' }]} /></label><label><span className="mb-2 block text-xs font-bold">Trạng thái đơn</span><FinanceSelect placeholder="" value={filters.status} label="Lọc trạng thái đơn" onChange={status => update({ status })} options={Object.entries(saleStatusLabels).map(([value, label]) => ({ value, label }))} /></label></div>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-bold">{filtered.length} đơn · {groups.length} ngày · Doanh thu <span className="text-moss-money">{money(active.reduce((total, order) => total + order.total, 0))}</span></p><button type="button" className="ui-flat-control text-xs font-bold underline" onClick={() => onChange(defaultSalesFilters)}>Xóa bộ lọc</button></div>
      {invalidDates && <p role="alert" className="text-sm text-red-700">Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</p>}
      {orders.some(order => order.sale_channel_inferred) && <p className="text-xs font-semibold text-[#16587B]/60">Đơn cũ được nhận diện theo loại sản phẩm. Đơn thiếu dữ liệu hoặc có cả hai loại sản phẩm nằm trong “Chưa phân loại”.</p>}
    </section>
    {loading ? <p role="status" className="p-6 text-center text-sm font-bold">Đang tải đầy đủ đơn hàng...</p> : !groups.length ? <p className="content-panel card-push p-6 text-center text-sm font-bold">Không có đơn hàng phù hợp.</p> : groups.map(([day, rows]) => <section key={day} className="order-day-group content-panel card-push space-y-5" aria-label={`Đơn hàng ${formatDay(day)}`}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-4"><div className="flex items-center gap-2"><CalendarDays size={20} /><h2 className="text-base font-black capitalize">{formatDay(day)}</h2></div><div className="text-sm font-bold">{rows.length} đơn · <span className="text-moss-money">{money(rows.filter(order => order.status !== 'cancelled').reduce((total, order) => total + order.total, 0))}</span></div></header>
      {(['pos', 'inventory', 'unknown'] as const).map(channel => {
        const matching = rows.filter(order => orderChannel(order) === channel);
        if (!matching.length) return null;
        return <div key={channel} className="space-y-3"><h3 className="flex items-center gap-2 text-sm font-black">{saleChannelLabels[channel]} <span className="text-xs font-semibold">({matching.length} đơn)</span></h3><div className="space-y-3">{matching.map(renderOrder)}</div></div>;
      })}
    </section>)}
  </div>;
}
