'use client';

import { Check, Delete, Loader2, Plus } from 'lucide-react';

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
            <label><span className="sr-only">Danh mục</span><select aria-label="Danh mục" value={form.category} onChange={event => change({ category: event.target.value })}>
              <option value="">Chọn danh mục</option>
              {form.category && !categories.includes(form.category) && <option>{form.category}</option>}
              {categories.map(category => <option key={category}>{category}</option>)}
            </select></label>
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
            <label><span>Khoản tiền</span><select aria-label="Tài khoản tiền" value={form.accountId} onChange={event => change({ accountId: event.target.value })}>{accounts.map(account => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}</select></label>
            <label><span>Ngày giao dịch</span><input aria-label="Ngày giao dịch" type="date" value={form.date} onChange={event => change({ date: event.target.value })} /></label>
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
