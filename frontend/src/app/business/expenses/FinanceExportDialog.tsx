'use client';

import { Check, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import ModalShell from './FinanceDialog';
import { FinanceDatePicker } from './FinancePicker';
import type { FinanceCategory } from './categoryData';

type ExportType = 'all' | 'income' | 'expense';
type ExportTransaction = {
  id?: string;
  type: 'income' | 'expense';
  amount?: number;
  currency?: string;
  categoryId: string | null;
  category?: string;
  description?: string;
  date: string;
  account?: { id: string; name: string; type?: string };
};
const button = 'inline-flex items-center justify-center gap-2 border-2 border-black px-4 font-black text-[#171513] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50';
const dateKey = (value: string) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date(value));
const monthKey = (value: string) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit',
}).format(new Date(value));
const vnDate = (value: string) => new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric',
}).format(new Date(value));
const safeSheetName = (name: string) => name.replace(/[\\/?*:[\]]/g, '-').slice(0, 31) || 'Sheet';
const slug = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'so-chi-tieu';

function buildClientFinanceWorkbook(bookName: string, rows: ExportTransaction[]) {
  const xlsx = ((XLSX as unknown as { default?: typeof XLSX }).default || XLSX);
  const workbook = xlsx.utils.book_new();
  const sorted = [...rows].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // 1. Tổng hợp tháng
  const monthMap = new Map<string, { income: number; expense: number; count: number }>();
  for (const item of sorted) {
    const key = `${monthKey(item.date)} (${item.currency || 'VND'})`;
    const current = monthMap.get(key) || { income: 0, expense: 0, count: 0 };
    if (item.type === 'income') current.income += Number(item.amount || 0);
    else current.expense += Number(item.amount || 0);
    current.count += 1;
    monthMap.set(key, current);
  }
  const monthlyRows: (string | number)[][] = [
    [`BÁO CÁO THU CHI - ${bookName.toUpperCase()}`],
    ['Tháng (Tiền tệ)', 'Tổng thu', 'Tổng chi', 'Chênh lệch (Thu - Chi)', 'Số giao dịch'],
    ...[...monthMap.entries()].map(([label, m]) => [label, m.income, m.expense, m.income - m.expense, m.count]),
  ];
  const monthlySheet = xlsx.utils.aoa_to_sheet(monthlyRows);
  monthlySheet['!cols'] = [{ wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 14 }];
  xlsx.utils.book_append_sheet(workbook, monthlySheet, safeSheetName('Tổng hợp tháng'));

  // 2. Báo cáo từng ngày
  const dayMap = new Map<string, { dateLabel: string; currency: string; income: number; expense: number; count: number }>();
  for (const item of sorted) {
    const dKey = `${dateKey(item.date)}_${item.currency || 'VND'}`;
    const current = dayMap.get(dKey) || { dateLabel: vnDate(item.date), currency: item.currency || 'VND', income: 0, expense: 0, count: 0 };
    if (item.type === 'income') current.income += Number(item.amount || 0);
    else current.expense += Number(item.amount || 0);
    current.count += 1;
    dayMap.set(dKey, current);
  }
  const dailyRows: (string | number)[][] = [
    ['Ngày', 'Tiền tệ', 'Tổng thu', 'Tổng chi', 'Chênh lệch', 'Số giao dịch'],
    ...[...dayMap.values()].map(d => [d.dateLabel, d.currency, d.income, d.expense, d.income - d.expense, d.count]),
  ];
  const dailySheet = xlsx.utils.aoa_to_sheet(dailyRows);
  dailySheet['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 14 }];
  xlsx.utils.book_append_sheet(workbook, dailySheet, safeSheetName('Theo ngày'));

  // 3. Chi tiết giao dịch
  const detailRows: (string | number)[][] = [
    ['Ngày', 'Tháng', 'Loại', 'Danh mục', 'Khoản tiền', 'Ghi chú', 'Tiền tệ', 'Số tiền', 'Thu (+)', 'Chi (-)'],
    ...sorted.map(item => {
      const amount = Number(item.amount || 0);
      return [
        vnDate(item.date),
        monthKey(item.date),
        item.type === 'income' ? 'Khoản thu' : 'Khoản chi',
        item.category || 'Chưa phân loại',
        item.account?.name || 'Tài khoản',
        item.description || '',
        item.currency || 'VND',
        item.type === 'income' ? amount : -amount,
        item.type === 'income' ? amount : 0,
        item.type === 'expense' ? amount : 0,
      ];
    }),
  ];
  const detailSheet = xlsx.utils.aoa_to_sheet(detailRows);
  detailSheet['!cols'] = [
    { wch: 14 }, { wch: 10 }, { wch: 13 }, { wch: 22 }, { wch: 20 },
    { wch: 32 }, { wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
  ];
  xlsx.utils.book_append_sheet(workbook, detailSheet, safeSheetName('Chi tiết giao dịch'));

  const data = xlsx.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export default function FinanceExportDialog({ bookId, bookName = 'Sổ chi tiêu', transactions, categories, headers, close, notify }: {
  bookId: string;
  bookName?: string;
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
  const matchingTransactions = useMemo(() => transactions.filter(item => {
    const day = dateKey(item.date);
    return day >= from && day <= to && (type === 'all' || item.type === type)
      && (allVisibleSelected || (!!item.categoryId && selected.has(item.categoryId)));
  }), [transactions, from, to, type, allVisibleSelected, selected]);
  const matchingCount = matchingTransactions.length;

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
      let blob: Blob;
      let filename = `bao-cao-thu-chi-${slug(bookName)}-${from}-den-${to}.xlsx`;
      if (matchingTransactions.length > 0 && matchingTransactions.every(item => typeof item.amount === 'number')) {
        blob = buildClientFinanceWorkbook(bookName, matchingTransactions);
      } else {
        const categoryIds = allVisibleSelected ? undefined : selectedVisible.map(category => category.id);
        const response = await fetch('/api/business/finance/export', {
          method: 'POST', headers, body: JSON.stringify({ bookId, from, to, type, categoryIds }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.detail || 'Không xuất được file Excel.');
        }
        blob = await response.blob();
        const disposition = response.headers.get('Content-Disposition') || '';
        const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
        if (encodedName) filename = decodeURIComponent(encodedName);
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
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
        File gồm tổng hợp theo tháng, báo cáo từng ngày, bảng chi tiết có thể lọc và các sheet tháng hiện tại.
      </div>
      <fieldset disabled={exporting} className="space-y-5">
        <div>
          <span className="mb-2 block text-xs font-black uppercase tracking-wide">Loại giao dịch</span>
          <div className="grid grid-cols-3 gap-2">
            {([['all', 'Tất cả'], ['income', 'Khoản thu'], ['expense', 'Khoản chi']] as const).map(([value, label]) =>
              <button key={value} type="button" onClick={() => { setType(value); setError(''); }} aria-pressed={type === value} className={`${button} h-11 px-2 text-xs ${type === value ? 'bg-[#ff8a24]' : 'bg-white'}`}>{label}</button>)}
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
          <div className="max-h-52 overflow-y-auto border-2 border-black bg-white">
            {visibleCategories.map(category => {
              const checked = selected.has(category.id);
              return <label key={category.id} className="finance-export-category flex cursor-pointer items-center gap-3 border-b border-black/15 px-3 py-3 last:border-0" style={{ backgroundColor: `color-mix(in srgb, ${category.color} ${checked ? 24 : 14}%, var(--reps-paper, #fffaf0))` }}>
                <input type="checkbox" checked={checked} onChange={() => setSelected(current => { const next = new Set(current); if (checked) next.delete(category.id); else next.add(category.id); return next; })} className="finance-export-checkbox" />
                <Check aria-hidden="true" className="finance-export-tick" strokeWidth={3} />
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
