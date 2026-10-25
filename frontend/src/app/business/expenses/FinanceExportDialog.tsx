'use client';

import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import ModalShell from './FinanceDialog';
import { FinanceDatePicker } from './FinancePicker';
import type { FinanceCategory } from './categoryData';

type ExportType = 'all' | 'income' | 'expense';
type ExportTransaction = { type: 'income' | 'expense'; categoryId: string | null; date: string };
const button = 'inline-flex items-center justify-center gap-2 border-2 border-black px-4 font-black text-[#171513] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50';
const dateKey = (value: string) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date(value));

export default function FinanceExportDialog({ bookId, transactions, categories, headers, close, notify }: {
  bookId: string;
  transactions: ExportTransaction[];
  categories: FinanceCategory[];
  headers: Record<string, string>;
  close: () => void;
  notify: (message: string) => void;
}) {
  const bounds = useMemo(() => {
    const dates = transactions.map(item => dateKey(item.date)).sort();
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    return { from: dates[0] || today, to: dates.at(-1) || today };
  }, [transactions]);
  const [from, setFrom] = useState(bounds.from);
  const [to, setTo] = useState(bounds.to);
  const [type, setType] = useState<ExportType>('all');
  const [selected, setSelected] = useState(() => new Set(categories.map(category => category.id)));
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const visibleCategories = categories.filter(category => type === 'all' || category.type === type);
  const selectedVisible = visibleCategories.filter(category => selected.has(category.id));
  const allVisibleSelected = visibleCategories.length > 0 && selectedVisible.length === visibleCategories.length;
  const matchingCount = transactions.filter(item => {
    const day = dateKey(item.date);
    return day >= from && day <= to && (type === 'all' || item.type === type)
      && (allVisibleSelected || (!!item.categoryId && selected.has(item.categoryId)));
  }).length;

  const toggleAll = () => setSelected(current => {
    const next = new Set(current);
    if (allVisibleSelected) visibleCategories.forEach(category => next.delete(category.id));
    else visibleCategories.forEach(category => next.add(category.id));
    return next;
  });

  const exportFile = async () => {
    if (from > to) { setError('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.'); return; }
    if (!selectedVisible.length) { setError('Hãy chọn ít nhất một danh mục để xuất.'); return; }
    setExporting(true);
    setError('');
    try {
      const categoryIds = allVisibleSelected ? undefined : selectedVisible.map(category => category.id);
      const response = await fetch('/api/business/finance/export', {
        method: 'POST', headers, body: JSON.stringify({ bookId, from, to, type, categoryIds }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || 'Không xuất được file Excel.');
      }
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') || '';
      const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
      const filename = encodedName ? decodeURIComponent(encodedName) : `bao-cao-thu-chi-${from}-${to}.xlsx`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify('Đã xuất và tải file Excel về máy.');
      close();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không xuất được file Excel.');
    } finally {
      setExporting(false);
    }
  };

  return <ModalShell title="Xuất báo cáo Excel" busy={exporting} close={close}>
    <div className="space-y-5">
      <div className="border-2 border-black bg-[#fff6d8] p-4 text-sm font-semibold">
        File gồm sheet tổng hợp toàn kỳ và từng sheet tháng, có tổng thu/chi theo ngày, tháng và tiền tệ.
      </div>
      <fieldset disabled={exporting} className="space-y-5">
        <div>
          <span className="mb-2 block text-xs font-black uppercase tracking-wide">Loại giao dịch</span>
          <div className="grid grid-cols-3 gap-2">
            {([['all', 'Tất cả'], ['income', 'Khoản thu'], ['expense', 'Khoản chi']] as const).map(([value, label]) =>
              <button key={value} type="button" onClick={() => { setType(value); setError(''); }} aria-pressed={type === value} className={`${button} h-11 px-2 text-xs ${type === value ? 'bg-[#ef7c3b]' : 'bg-white'}`}>{label}</button>)}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label><span className="mb-2 block text-xs font-black uppercase tracking-wide">Từ ngày</span><FinanceDatePicker label="Chọn ngày bắt đầu" value={from} onChange={setFrom} /></label>
          <label><span className="mb-2 block text-xs font-black uppercase tracking-wide">Đến ngày</span><FinanceDatePicker label="Chọn ngày kết thúc" value={to} onChange={setTo} /></label>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-xs font-black uppercase tracking-wide">Danh mục cần xuất</span>
            <button type="button" onClick={toggleAll} className="text-xs font-black underline">{allVisibleSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}</button>
          </div>
          <div className="max-h-52 space-y-2 overflow-y-auto border-2 border-black bg-white p-3">
            {visibleCategories.map(category => {
              const checked = selected.has(category.id);
              return <label key={category.id} className="flex cursor-pointer items-center gap-3 border-b border-black/15 py-2 last:border-0">
                <input type="checkbox" checked={checked} onChange={() => setSelected(current => { const next = new Set(current); if (checked) next.delete(category.id); else next.add(category.id); return next; })} className="h-5 w-5 accent-[#df5b2a]" />
                <span className="h-4 w-4 shrink-0 border border-black" style={{ backgroundColor: category.color }} />
                <span className="min-w-0 flex-1 truncate text-sm font-bold">{category.name}</span>
                <small className="font-bold text-black/55">{category.type === 'income' ? 'Thu' : 'Chi'}</small>
              </label>;
            })}
          </div>
        </div>
        <div className="flex items-center justify-between border-2 border-black bg-[#ffe69a] px-4 py-3 text-sm font-black">
          <span>Dữ liệu phù hợp</span><span>{matchingCount} giao dịch</span>
        </div>
        {error && <p role="alert" className="border-2 border-black bg-[#ffc9ba] p-3 text-sm font-bold">{error}</p>}
        <button type="button" onClick={() => void exportFile()} disabled={exporting || matchingCount === 0} className={`${button} h-12 w-full bg-[#8ee0a8]`}>
          {exporting ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />} {exporting ? 'Đang tạo file...' : 'Xuất file Excel (.xlsx)'}
        </button>
      </fieldset>
    </div>
  </ModalShell>;
}
