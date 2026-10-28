'use client';

import { ArrowRightLeft, Check, Delete, Loader2, Plus } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { FinanceDatePicker, FinanceSelect } from './FinancePicker';
import FinanceCategoryIcon from './FinanceCategoryIcon';
import type { FinanceCategory } from './categoryData';

export type TransactionDraft = {
  type: 'income' | 'expense';
  accountId: string;
  amount: string;
  category: string;
  description: string;
  date: string;
};

export default function TransactionEntry({ form, accounts, categories, saving, error, message, change, changeType, press, save, transfer, openTransfer }: {
  transfer?: { destinationAccountId: string; changeDestination: (id: string) => void };
  openTransfer: () => void;
  form: TransactionDraft;
  accounts: { id: string; name: string; currency: string }[];
  categories: FinanceCategory[];
  saving: boolean;
  error: string;
  message: string;
  change: (patch: Partial<TransactionDraft>) => void;
  changeType: (type: TransactionDraft['type']) => void;
  press: (key: string) => void;
  save: (closeAfter: boolean) => void;
}) {
  const categoryScroller = useRef<HTMLDivElement>(null);
  const [whole, decimal] = form.amount.split('.');
  const displayedAmount = (whole || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (decimal === undefined ? '' : `.${decimal}`);
  const currency = accounts.find(account => account.id === form.accountId)?.currency || 'VND';
  const key = (value: string) => <button key={value} type="button" onClick={() => press(value)} aria-label={value} className="finance-entry-key">{value}</button>;

  useEffect(() => {
    const scroller = categoryScroller.current;
    const selected = scroller?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!scroller || !selected) return;
    scroller.scrollTo({ left: Math.max(0, selected.offsetLeft - (scroller.clientWidth - selected.offsetWidth) / 2), behavior: 'smooth' });
  }, [form.category, form.type]);

  return (
    <form className="finance-entry" onSubmit={event => { event.preventDefault(); save(true); }}>
      <fieldset disabled={saving} className="finance-entry-fields">
        <div className="finance-entry-main">
          <div className="finance-entry-meta">
            {transfer ? <label className="block"><span className="mb-2 block text-xs font-bold">Đến khoản tiền</span><FinanceSelect label="Chọn tài khoản nhận" placeholder="Chọn tài khoản cùng tiền tệ" value={transfer.destinationAccountId} onChange={transfer.changeDestination} options={accounts.filter(account => account.id !== form.accountId && account.currency === currency).map(account => ({ value: account.id, label: `${account.name} · ${account.currency}` }))}/></label> : <><div ref={categoryScroller} className="finance-entry-categories" role="group" aria-label={`Danh mục ${form.type === 'income' ? 'thu' : 'chi'}`}>
              <div className="finance-entry-category-track">
                {categories.map(category => <button type="button" key={category.id} aria-pressed={form.category===category.id} title={category.name} onClick={()=>change({category:category.id})}><FinanceCategoryIcon name={category.icon} color={category.color}/><span>{category.name}</span></button>)}
              </div>
            </div>
            {!categories.length && <Link href="/business/expenses/categories" className="finance-entry-category-empty">Bạn chưa có danh mục loại này · Tạo danh mục</Link>}</>}
            <input aria-label="Ghi chú" placeholder="Ghi chú (không bắt buộc)" value={form.description} onChange={event => change({ description: event.target.value })} />
          </div>

          <div className="finance-entry-amount">
            <output aria-label="Số tiền" style={{ fontSize: `clamp(24px, ${Math.min(14, 145 / displayedAmount.length)}vw, 80px)` }}>{displayedAmount}</output>
            <span>{currency}</span>
          </div>
          <div className="finance-entry-feedback">
            {error ? <p role="alert">{error}</p> : message ? <p role="status">{message}</p> : null}
          </div>
        </div>

        <div className="finance-entry-console">
          <div className="finance-entry-toolbar">
            <button type="button" onClick={openTransfer} aria-label="Chuyển tiền giữa các tài khoản" title="Chuyển tiền giữa các tài khoản" aria-pressed={!!transfer} className="finance-entry-type finance-entry-transfer"><ArrowRightLeft size={24}/></button>
            <button type="button" aria-pressed={!transfer && form.type === 'income'} onClick={() => changeType('income')} className="finance-entry-type finance-entry-income">Thu</button>
            <button type="button" aria-pressed={!transfer && form.type === 'expense'} onClick={() => changeType('expense')} className="finance-entry-type finance-entry-expense">Chi</button>
            <div className="finance-entry-account"><FinanceSelect compact triggerLabel={accounts.find(account => account.id === form.accountId)?.name} label={transfer ? "Chọn tài khoản chuyển tiền" : "Chọn khoản tiền"} placeholder="Chọn tài khoản" value={form.accountId} onChange={accountId => change({ accountId })} options={accounts.map(account => ({ value: account.id, label: `${account.name} · ${account.currency}` }))} /></div>
            <div className="finance-entry-date"><FinanceDatePicker compact label="Chọn ngày giao dịch" value={form.date} onChange={date => change({ date })} /></div>
          </div>
          <div className="finance-entry-keypad" aria-label="Bàn phím nhập khoản tiền">
            {['1', '2', '3'].map(key)}
            <button type="button" onClick={() => press('backspace')} aria-label="Xóa một số" className="finance-entry-key finance-entry-delete"><Delete /></button>
            {['4', '5', '6'].map(key)}
            <button type="button" data-sound="money" onClick={() => save(false)} aria-label="Thêm giao dịch và tiếp tục" className="finance-entry-key finance-entry-add">{saving ? <Loader2 className="animate-spin" /> : <Plus />}</button>
            {['7', '8', '9', '000', '0', '.'].map(key)}
            <button type="submit" data-sound="money" aria-label="Hoàn thành thêm giao dịch" className="finance-entry-key finance-entry-done">{saving ? <Loader2 className="animate-spin" /> : <Check />}</button>
          </div>
        </div>
      </fieldset>
    </form>
  );
}
