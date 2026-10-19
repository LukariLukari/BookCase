'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  CalendarDays,
  CircleDollarSign,
  Edit3,
  Loader2,
  Plus,
  RefreshCcw,
  ReceiptText,
  Trash2,
  WalletCards,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import Sidebar from '@/components/Sidebar';

type Expense = {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  createdAt: string;
};

type ExpenseForm = {
  amount: string;
  category: string;
  date: string;
  description: string;
};

const categories = ['Nguyên vật liệu', 'Điện nước', 'Mặt bằng', 'Lương', 'Quảng cáo', 'Vận chuyển', 'Khác'];

const cardClass = 'border-2 border-black bg-[#fffaf0] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]';
const fieldClass = 'h-12 w-full border-2 border-black bg-[#fffdf7] px-3 font-bold text-[#171513] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] outline-none transition focus:bg-[#fff3c4] focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]';
const buttonClass = 'inline-flex items-center justify-center gap-2 border-2 border-black px-4 font-black text-[#171513] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] disabled:cursor-not-allowed disabled:opacity-50';

function vietnamDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function dateInputValue(value: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function money(value: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value || 0);
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

function PressButton({
  className = '',
  children,
  ...props
}: React.ComponentProps<typeof motion.button>) {
  return (
    <motion.button
      whileHover={{ x: 2, y: 2, boxShadow: '2px 2px 0px 0px rgba(0,0,0,1)' }}
      whileTap={{ x: 4, y: 4, boxShadow: '0px 0px 0px 0px rgba(0,0,0,1)' }}
      transition={{ duration: 0.1 }}
      className={`${buttonClass} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-wide text-[#171513]">{label}</span>
      {children}
    </label>
  );
}

export default function ExpensesPage() {
  const { token } = useAuth();
  const today = useMemo(() => vietnamDate(), []);
  const initialFilters = useMemo(() => ({ from: `${today.slice(0, 7)}-01`, to: today, category: '' }), [today]);
  const emptyForm = useMemo<ExpenseForm>(() => ({ amount: '', category: '', date: today, description: '' }), [today]);
  const [filters, setFilters] = useState(initialFilters);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<ExpenseForm>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }), [token]);

  const loadExpenses = useCallback(async (signal?: AbortSignal) => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      if (filters.category) params.set('category', filters.category);
      const response = await fetch(`/api/business/expenses?${params}`, { headers, signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Không tải được danh sách chi tiêu.');
      setExpenses(data.expenses);
      setTotal(data.total);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
      setError(errorMessage(loadError, 'Không tải được danh sách chi tiêu.'));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [filters, headers, token]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => loadExpenses(controller.signal), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadExpenses]);

  const notify = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 2400);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setFormOpen(true);
  };

  const openEdit = (expense: Expense) => {
    setEditing(expense);
    setForm({
      amount: String(expense.amount),
      category: expense.category,
      date: dateInputValue(expense.date),
      description: expense.description,
    });
    setError('');
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setEditing(null);
  };

  const saveExpense = async (event: React.FormEvent) => {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0 || !form.category || !form.date) {
      setError('Vui lòng nhập đủ số tiền, danh mục và ngày chi.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const response = await fetch(editing ? `/api/business/expenses/${editing.id}` : '/api/business/expenses', {
        method: editing ? 'PUT' : 'POST',
        headers,
        body: JSON.stringify({ ...form, amount }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Không lưu được khoản chi.');
      setFormOpen(false);
      setEditing(null);
      await loadExpenses();
      notify(editing ? 'Đã cập nhật khoản chi.' : 'Đã thêm khoản chi mới.');
    } catch (saveError) {
      setError(errorMessage(saveError, 'Không lưu được khoản chi.'));
    } finally {
      setSaving(false);
    }
  };

  const deleteExpense = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/business/expenses/${deleteTarget.id}`, { method: 'DELETE', headers });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Không xóa được khoản chi.');
      setDeleteTarget(null);
      await loadExpenses();
      notify('Đã xóa khoản chi.');
    } catch (deleteError) {
      setError(errorMessage(deleteError, 'Không xóa được khoản chi.'));
      setDeleteTarget(null);
    } finally {
      setSaving(false);
    }
  };

  const resetFilters = () => setFilters(initialFilters);

  return (
    <div
      className="min-h-screen bg-[#f4ead6] p-3 pb-16 pt-[calc(4.75rem+env(safe-area-inset-top,0px))] font-sans text-[#171513] md:flex md:gap-5 md:p-6"
      style={{
        backgroundImage: 'linear-gradient(rgba(23,21,19,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(23,21,19,.055) 1px, transparent 1px), radial-gradient(circle at 25% 20%, rgba(255,255,255,.8), transparent 35%)',
        backgroundSize: '28px 28px, 28px 28px, 100% 100%',
      }}
    >
      <Sidebar />
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-7xl">
          <section className="grid gap-5 lg:grid-cols-[1fr_380px]">
            <div className={`${cardClass} p-5 md:p-8`}>
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center border-2 border-black bg-[#ffc857] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <WalletCards size={28} />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[.2em]">Vận hành cửa hàng</p>
                  <h1 className="mt-1 text-3xl font-black uppercase leading-tight text-[#df5b2a] md:text-5xl">Thống kê chi tiêu</h1>
                  <p className="mt-3 max-w-2xl text-sm font-semibold leading-6">Theo dõi mọi khoản chi, lọc theo thời gian và kiểm soát ngân sách vận hành ngay trong một màn hình.</p>
                </div>
              </div>
              <PressButton onClick={openCreate} className="mt-6 h-14 w-full bg-[#ef7c3b] text-base md:w-auto">
                <Plus size={22} strokeWidth={3} /> Thêm khoản chi mới
              </PressButton>
            </div>

            <div className={`${cardClass} flex min-h-52 flex-col items-center justify-center bg-[#ffd978] p-6 text-center`}>
              <CircleDollarSign size={35} strokeWidth={2.5} />
              <p className="mt-3 text-xs font-black uppercase tracking-[.15em]">Tổng chi phí trong tháng</p>
              <strong className="mt-3 break-all text-3xl font-black text-[#b43f20] md:text-4xl">{money(total)}</strong>
              <span className="mt-2 text-xs font-bold">{expenses.length} khoản chi đang hiển thị</span>
            </div>
          </section>

          <section className={`${cardClass} mt-7 bg-[#fff6d8] p-4 md:p-5`}>
            <div className="mb-4 flex items-center gap-2">
              <CalendarDays size={21} />
              <h2 className="text-lg font-black uppercase">Bộ lọc</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1.25fr_auto] xl:items-end">
              <FormField label="Từ ngày">
                <input type="date" value={filters.from} max={filters.to || today} onChange={event => setFilters(current => ({ ...current, from: event.target.value }))} className={fieldClass} />
              </FormField>
              <FormField label="Đến ngày">
                <input type="date" value={filters.to} min={filters.from} max={today} onChange={event => setFilters(current => ({ ...current, to: event.target.value }))} className={fieldClass} />
              </FormField>
              <FormField label="Danh mục chi tiêu">
                <select value={filters.category} onChange={event => setFilters(current => ({ ...current, category: event.target.value }))} className={fieldClass}>
                  <option value="">Tất cả danh mục</option>
                  {categories.map(category => <option key={category}>{category}</option>)}
                </select>
              </FormField>
              <PressButton onClick={resetFilters} className="h-12 bg-[#fffaf0]">
                <RefreshCcw size={17} /> Làm mới
              </PressButton>
            </div>
          </section>

          {error && !formOpen && !deleteTarget && (
            <div role="alert" className="mt-6 border-2 border-black bg-[#ffd3c4] p-4 font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">{error}</div>
          )}

          <section className={`${cardClass} mt-7 overflow-hidden`}>
            <div className="flex items-center justify-between border-b-2 border-black bg-[#ffc857] px-4 py-4 md:px-6">
              <div className="flex items-center gap-2">
                <ReceiptText size={21} />
                <h2 className="text-lg font-black uppercase">Danh sách chi tiêu</h2>
              </div>
              <span className="border-2 border-black bg-[#fffaf0] px-3 py-1 text-xs font-black">{expenses.length} mục</span>
            </div>

            {loading ? (
              <div className="flex min-h-64 items-center justify-center gap-3 font-black"><Loader2 className="animate-spin" /> Đang tải dữ liệu...</div>
            ) : expenses.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center px-5 text-center">
                <ReceiptText size={42} />
                <h3 className="mt-3 text-lg font-black uppercase">Chưa có khoản chi</h3>
                <p className="mt-1 text-sm font-semibold">Thêm khoản chi đầu tiên hoặc thay đổi bộ lọc.</p>
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full border-collapse text-left">
                    <thead className="bg-[#ffe69a] text-xs uppercase tracking-wide">
                      <tr>
                        {['Ngày tháng', 'Danh mục', 'Số tiền', 'Ghi chú / Lý do', 'Hành động'].map(label => (
                          <th key={label} className="border-b-2 border-r-2 border-black px-4 py-3 last:border-r-0">{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.map(expense => (
                        <tr key={expense.id} className="border-b-2 border-black last:border-b-0 hover:bg-[#fff7dc]">
                          <td className="whitespace-nowrap border-r-2 border-black px-4 py-4 text-sm font-bold">{formatDate(expense.date)}</td>
                          <td className="border-r-2 border-black px-4 py-4"><span className="inline-block border-2 border-black bg-[#ffd978] px-2.5 py-1 text-xs font-black">{expense.category}</span></td>
                          <td className="whitespace-nowrap border-r-2 border-black px-4 py-4 font-black text-[#b43f20]">{money(expense.amount)}</td>
                          <td className="max-w-sm border-r-2 border-black px-4 py-4 text-sm font-semibold">{expense.description || '—'}</td>
                          <td className="px-4 py-4">
                            <div className="flex gap-2">
                              <PressButton aria-label="Sửa khoản chi" title="Sửa" onClick={() => openEdit(expense)} className="h-10 w-10 bg-[#fffaf0] p-0"><Edit3 size={16} /></PressButton>
                              <PressButton aria-label="Xóa khoản chi" title="Xóa" onClick={() => setDeleteTarget(expense)} className="h-10 w-10 bg-[#ffb8a5] p-0"><Trash2 size={16} /></PressButton>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid gap-4 p-4 md:hidden">
                  {expenses.map(expense => (
                    <article key={expense.id} className="border-2 border-black bg-[#fffdf7] p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="inline-block border-2 border-black bg-[#ffd978] px-2 py-1 text-[10px] font-black uppercase">{expense.category}</span>
                          <p className="mt-2 text-xs font-bold">{formatDate(expense.date)}</p>
                        </div>
                        <strong className="text-right font-black text-[#b43f20]">{money(expense.amount)}</strong>
                      </div>
                      <p className="mt-3 min-h-5 text-sm font-semibold">{expense.description || 'Không có ghi chú'}</p>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <PressButton onClick={() => openEdit(expense)} className="h-10 bg-[#fffaf0]"><Edit3 size={15} /> Sửa</PressButton>
                        <PressButton onClick={() => setDeleteTarget(expense)} className="h-10 bg-[#ffb8a5]"><Trash2 size={15} /> Xóa</PressButton>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      </main>

      <AnimatePresence>
        {formOpen && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-3 md:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={closeForm}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="expense-form-title"
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.18 }}
              onMouseDown={event => event.stopPropagation()}
              className="max-h-[92vh] w-full max-w-xl overflow-y-auto border-2 border-black bg-[#fffaf0] p-5 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] md:p-7"
            >
              <div className="mb-6 flex items-center justify-between gap-3 border-b-2 border-black pb-4">
                <h2 id="expense-form-title" className="text-xl font-black uppercase text-[#df5b2a]">{editing ? 'Sửa khoản chi' : 'Thêm khoản chi mới'}</h2>
                <PressButton type="button" aria-label="Đóng" onClick={closeForm} className="h-10 w-10 bg-[#fffaf0] p-0"><X size={19} /></PressButton>
              </div>

              <form onSubmit={saveExpense} className="space-y-5">
                <FormField label="Số tiền (VNĐ) *">
                  <input type="number" min="1" step="1000" inputMode="numeric" required value={form.amount} onChange={event => setForm(current => ({ ...current, amount: event.target.value }))} placeholder="Ví dụ: 250000" className={fieldClass} autoFocus />
                </FormField>
                <FormField label="Danh mục *">
                  <select required value={form.category} onChange={event => setForm(current => ({ ...current, category: event.target.value }))} className={fieldClass}>
                    <option value="">Chọn danh mục</option>
                    {categories.map(category => <option key={category}>{category}</option>)}
                  </select>
                </FormField>
                <FormField label="Ngày chi *">
                  <input type="date" required max={today} value={form.date} onChange={event => setForm(current => ({ ...current, date: event.target.value }))} className={fieldClass} />
                </FormField>
                <FormField label="Ghi chú / Lý do">
                  <textarea value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} placeholder="Ví dụ: Mua ly nhựa, trả tiền điện..." className={`${fieldClass} min-h-28 resize-y py-3`} />
                </FormField>
                {error && <p role="alert" className="border-2 border-black bg-[#ffd3c4] p-3 text-sm font-bold">{error}</p>}
                <div className="grid grid-cols-2 gap-4 pt-1">
                  <PressButton type="button" onClick={closeForm} disabled={saving} className="h-12 bg-[#fffaf0]">Hủy</PressButton>
                  <PressButton type="submit" disabled={saving} className="h-12 bg-[#ef7c3b]">
                    {saving ? <Loader2 size={18} className="animate-spin" /> : <CircleDollarSign size={18} />}
                    {saving ? 'Đang lưu...' : 'Lưu'}
                  </PressButton>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {deleteTarget && (
          <motion.div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div role="alertdialog" aria-modal="true" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-md border-2 border-black bg-[#fffaf0] p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex h-12 w-12 items-center justify-center border-2 border-black bg-[#ffb8a5] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"><Trash2 /></div>
              <h2 className="mt-5 text-xl font-black uppercase">Xóa khoản chi?</h2>
              <p className="mt-2 text-sm font-semibold">Khoản <strong>{money(deleteTarget.amount)}</strong> thuộc “{deleteTarget.category}” sẽ bị xóa vĩnh viễn.</p>
              <div className="mt-6 grid grid-cols-2 gap-4">
                <PressButton onClick={() => setDeleteTarget(null)} disabled={saving} className="h-12 bg-[#fffaf0]">Hủy</PressButton>
                <PressButton onClick={deleteExpense} disabled={saving} className="h-12 bg-[#ef7c3b]">{saving ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />} Xóa</PressButton>
              </div>
            </motion.div>
          </motion.div>
        )}

        {message && (
          <motion.div initial={{ opacity: 0, y: -15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="fixed left-1/2 top-20 z-[130] -translate-x-1/2 border-2 border-black bg-[#ffd978] px-5 py-3 text-sm font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">{message}</motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
