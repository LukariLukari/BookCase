'use client';

import { Check, Delete, Loader2, Plus } from 'lucide-react';
import { FinanceDatePicker, FinanceSelect } from './FinancePicker';

export type TransactionDraft = {
  type: 'income' | 'expense';
  accountId: string;
  amount: string;
  category: string;
  description: string;
  date: string;
};

export default function TransactionEntry({ form, accounts, categories, saving, error, message, change, changeType, press, save }: {
  form: TransactionDraft;
  accounts: { id: string; name: string; currency: string }[];
  categories: string[];
  saving: boolean;
  error: string;
  message: string;
  change: (patch: Partial<TransactionDraft>) => void;
  changeType: (type: TransactionDraft['type']) => void;
  press: (key: string) => void;
  save: (closeAfter: boolean) => void;
}) {
  const [whole, decimal] = form.amount.split('.');
  const displayedAmount = (whole || '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (decimal === undefined ? '' : `,${decimal}`);
  const currency = accounts.find(account => account.id === form.accountId)?.currency || 'VND';
  const key = (value: string) => <button key={value} type="button" onClick={() => press(value)} aria-label={value} className="finance-entry-key">{value}</button>;

  return (
    <form className="finance-entry" onSubmit={event => { event.preventDefault(); save(true); }}>
      <fieldset disabled={saving} className="finance-entry-fields">
        <div className="finance-entry-main">
          <div className="finance-entry-meta">
            <FinanceSelect
              label="Chọn danh mục"
              placeholder="Chọn danh mục"
              value={form.category}
              options={(form.category && !categories.includes(form.category) ? [form.category, ...categories] : categories).map(category => ({ value: category, label: category }))}
              onChange={category => change({ category })}
            />
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
            <button type="button" aria-pressed={form.type === 'income'} onClick={() => changeType('income')} className="finance-entry-type finance-entry-income">Thu</button>
            <button type="button" aria-pressed={form.type === 'expense'} onClick={() => changeType('expense')} className="finance-entry-type finance-entry-expense">Chi</button>
            <label><span>Khoản tiền</span><FinanceSelect compact label="Chọn khoản tiền" placeholder="Chọn tài khoản" value={form.accountId} onChange={accountId => change({ accountId })} options={accounts.map(account => ({ value: account.id, label: `${account.name} · ${account.currency}` }))} /></label>
            <label><span>Ngày giao dịch</span><FinanceDatePicker compact label="Chọn ngày giao dịch" value={form.date} onChange={date => change({ date })} /></label>
          </div>
          <div className="finance-entry-keypad" aria-label="Bàn phím nhập khoản tiền">
            {['1', '2', '3'].map(key)}
            <button type="button" onClick={() => press('backspace')} aria-label="Xóa một số" className="finance-entry-key finance-entry-delete"><Delete /></button>
            {['4', '5', '6'].map(key)}
            <button type="button" onClick={() => save(false)} aria-label="Thêm giao dịch và tiếp tục" className="finance-entry-key finance-entry-add">{saving ? <Loader2 className="animate-spin" /> : <Plus />}</button>
            {['7', '8', '9', '000', '0', '.'].map(key)}
            <button type="submit" aria-label="Hoàn thành thêm giao dịch" className="finance-entry-key finance-entry-done">{saving ? <Loader2 className="animate-spin" /> : <Check />}</button>
          </div>
        </div>
      </fieldset>
    </form>
  );
}
