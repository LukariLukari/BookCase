'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Download, Loader2 } from 'lucide-react';
import ModalShell from '@/app/business/expenses/FinanceDialog';
import { FinanceDatePicker, FinanceSelect } from '@/app/business/expenses/FinancePicker';
import type { Order, Report } from '@/app/business/BusinessClient';
import { defaultSalesFilters, filterSalesOrders, loadLedgerOrders, saleChannelLabels, saleStatusLabels, salesDay, type SalesFilters } from '@/lib/salesData';
import type { SalesFormat, SalesSection } from '@/lib/salesExcel';

const sections: [SalesSection, string][] = [['summary', 'Tổng hợp'], ['daily', 'Tổng hợp theo ngày và loại đơn'], ['orders', 'Chi tiết đơn hàng'], ['items', 'Chi tiết từng món trong đơn'], ['products', 'Sản phẩm đã bán'], ['expenses', 'Chi phí chung']];
const button = 'btn-push flex min-h-11 items-center justify-center gap-2 px-3 py-2 text-sm font-bold disabled:opacity-40';

export default function SalesExportDialog({ ledger, ledgerName, headers, report, orders: providedOrders, initialFilters, close, notify, base = '/api/backend' }: {
  ledger: string; ledgerName: string; headers: Record<string, string>; report?: Report; orders?: Order[];
  initialFilters?: SalesFilters; close: () => void; notify: (message: string) => void; base?: string;
}) {
  const [orders, setOrders] = useState<Order[]>(providedOrders || []);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState<SalesFilters>(initialFilters || defaultSalesFilters);
  const [format, setFormat] = useState<SalesFormat>('xlsx');
  const [selected, setSelected] = useState<SalesSection[]>(report ? ['summary', 'daily', 'orders', 'products', 'expenses'] : ['summary', 'daily', 'orders', 'items']);
  const canIncludeExpenses = !!report && filters.channel === 'all' && filters.payment === 'all' && filters.status === 'all' && !filters.query.trim();
  const visibleSections = sections.filter(([key]) => key !== 'expenses' || canIncludeExpenses);
  const selectedSections = selected.filter(key => visibleSections.some(([visible]) => visible === key));
  const matching = useMemo(() => filterSalesOrders(orders, filters), [orders, filters]);
  const expenseCount = canIncludeExpenses ? report!.expenses.filter(expense => (!filters.from || salesDay(expense.spent_at) >= filters.from) && (!filters.to || salesDay(expense.spent_at) <= filters.to)).length : 0;
  const hasData = matching.length > 0 || (selectedSections.some(key => key === 'summary' || key === 'expenses') && expenseCount > 0);
  useEffect(() => {
    const controller = new AbortController();
    loadLedgerOrders(ledger, headers, base, controller.signal).then(rows => { if (!controller.signal.aborted) setOrders(rows); }).catch(reason => { if (!controller.signal.aborted) { setLoadFailed(true); setError(reason instanceof Error ? reason.message : 'Không tải được đơn hàng.'); } }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [ledger, headers, base, reload]);

  const update = (value: Partial<SalesFilters>) => { setFilters(current => ({ ...current, ...value })); setError(''); };
  const exportFile = async () => {
    if (exporting || loading || loadFailed) return;
    if (filters.from && filters.to && filters.from > filters.to) { setError('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.'); return; }
    if (!selectedSections.length) { setError('Chọn ít nhất một nội dung cần xuất.'); return; }
    setExporting(true); setError('');
    try {
      const { downloadSalesExport } = await import('@/lib/salesExcel');
      await downloadSalesExport({ orders, report, filters, sections: selectedSections, format, ledgerName });
      notify('Đã tải file báo cáo về máy.'); close();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không xuất được file.'); }
    finally { setExporting(false); }
  };

  return <ModalShell title="Xuất báo cáo đơn hàng" close={close} busy={exporting}>
    <div className="space-y-5">
      <p className="rounded-xl border bg-[#fff6d8] p-3 text-sm font-semibold">Sổ: {ledgerName}. Chọn loại đơn, khoảng ngày và những phần cần xuất.</p>
      <fieldset disabled={exporting || loading || loadFailed} className="space-y-5 border-0 p-0">
        <div><span className="mb-2 block text-xs font-black uppercase">Loại đơn hàng</span><div className="grid grid-cols-2 gap-2">{(Object.entries(saleChannelLabels) as [SalesFilters['channel'], string][]).map(([value, label]) => <button type="button" key={value} aria-pressed={filters.channel === value} onClick={() => update({ channel: value })} className={`${button} ${filters.channel === value ? 'btn-push-primary' : ''}`}>{label}</button>)}</div></div>
        <label className="block"><span className="mb-2 block text-xs font-black uppercase">Thanh toán</span><FinanceSelect placeholder="" label="Lọc thanh toán khi xuất file" value={filters.payment} onChange={value => update({ payment: value })} options={[{ value: 'all', label: 'Tất cả trạng thái' }, { value: 'paid', label: 'Đã thanh toán' }, { value: 'pending', label: 'Chưa thanh toán' }, { value: 'partial', label: 'Thanh toán một phần' }]} /></label>
        <label className="block"><span className="mb-2 block text-xs font-black uppercase">Trạng thái đơn</span><FinanceSelect placeholder="" label="Lọc trạng thái đơn khi xuất" value={filters.status} onChange={status => update({ status })} options={Object.entries(saleStatusLabels).map(([value, label]) => ({ value, label }))} /></label>
        <div className="grid gap-3 sm:grid-cols-2"><label><span className="mb-2 block text-xs font-black uppercase">Từ ngày</span><FinanceDatePicker label="Ngày bắt đầu xuất" value={filters.from} onChange={value => update({ from: value })} /></label><label><span className="mb-2 block text-xs font-black uppercase">Đến ngày</span><FinanceDatePicker label="Ngày kết thúc xuất" value={filters.to} onChange={value => update({ to: value })} /></label></div>
        <button type="button" className="ui-flat-control text-sm underline" onClick={() => update({ from: '', to: '' })}>Toàn bộ thời gian của sổ</button>
        <label className="block"><span className="mb-2 block text-xs font-black uppercase">Tìm trong đơn hàng</span><input value={filters.query} onChange={event => update({ query: event.target.value })} placeholder="Mã đơn, khách, sản phẩm, ghi chú..." className="w-full px-3 py-2" /></label>
        <label className="block"><span className="mb-2 block text-xs font-black uppercase">Định dạng file</span><FinanceSelect placeholder="" label="Định dạng file báo cáo" value={format} onChange={value => { const next = value as SalesFormat; setFormat(next); if (next === 'csv') setSelected([selectedSections[0] || 'orders']); setError(''); }} options={[{ value: 'xlsx', label: 'Excel (.xlsx) — nhiều sheet' }, { value: 'xls', label: 'Excel 97–2003 (.xls) — nhiều sheet' }, { value: 'csv', label: 'CSV (.csv) — một nội dung' }]} /></label>
        <div><div className="mb-2 flex items-center justify-between gap-3"><span className="text-xs font-black uppercase">Nội dung cần xuất</span>{format !== 'csv' && <button type="button" className="ui-flat-control text-xs underline" onClick={() => setSelected(selectedSections.length === visibleSections.length ? [] : visibleSections.map(([key]) => key))}>{selectedSections.length === visibleSections.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}</button>}</div>
          <div className="overflow-hidden rounded-xl border">{visibleSections.map(([key, label]) => <label key={key} className="finance-export-category flex cursor-pointer items-center gap-3 border-b px-3 py-3 last:border-0"><input type={format === 'csv' ? 'radio' : 'checkbox'} name="sales-export-section" checked={selectedSections.includes(key)} onChange={() => setSelected(current => format === 'csv' ? [key] : current.includes(key) ? current.filter(item => item !== key) : [...current, key])} className="finance-export-checkbox" /><Check aria-hidden="true" className="finance-export-tick" strokeWidth={3} /><span className="text-sm font-bold">{label}</span></label>)}</div>
        </div>
        {format === 'csv' && <p className="text-xs font-semibold">CSV chỉ chứa một bảng. Chọn .xlsx hoặc .xls để xuất nhiều phần trong cùng file.</p>}
        <p className="text-xs font-semibold">Đơn hủy vẫn có trong chi tiết nhưng không cộng doanh thu. Chi phí chung chỉ xuất khi chọn tất cả loại đơn, trạng thái và không giới hạn từ khóa.</p>
        <div className="flex justify-between gap-3 rounded-xl bg-[#ffe69a] p-3 text-sm font-black"><span>Dữ liệu phù hợp</span><span>{loading ? 'Đang tải...' : `${matching.length} đơn${canIncludeExpenses ? ` · ${expenseCount} khoản chi` : ''}`}</span></div>
        {loading && <Loader2 className="mx-auto animate-spin" aria-label="Đang tải đơn hàng" />}
        {error && <p role="alert" className="text-sm font-bold text-red-700">{error}</p>}
        <button type="button" onClick={() => void exportFile()} disabled={exporting || loading || loadFailed || !hasData || !selectedSections.length || (!!filters.from && !!filters.to && filters.from > filters.to)} className={`${button} btn-push-primary w-full`}>
          {exporting ? <Loader2 className="animate-spin" /> : <Download size={18} />} {exporting ? 'Đang tạo file...' : `Tải file .${format}`}
        </button>
      </fieldset>
      {loadFailed && <button type="button" className={button} onClick={() => { setLoading(true); setLoadFailed(false); setError(''); setReload(value => value + 1); }}>Thử tải lại đơn hàng</button>}
    </div>
  </ModalShell>;
}
