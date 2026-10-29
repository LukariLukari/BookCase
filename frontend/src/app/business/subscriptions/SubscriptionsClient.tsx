'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { CalendarClock, Check, ChevronLeft, ChevronRight, Loader2, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/app/contexts/AuthContext';
import Dialog from '../expenses/FinanceDialog';
import { addDays, calendarDays, defaultCancelDate, reminderState, subscriptionCurrencies, subscriptionEnd, todayKey, validateSubscription, type DurationUnit, type Subscription, type SubscriptionInput } from '@/lib/subscriptions';

type Customer = { id: string; name: string; phone?: string; email?: string };
type Form = SubscriptionInput & { id?: string; renewFromId?: string };
type Focus = 'day' | 'overdue' | 'week';
const units = { day: 'ngày', month: 'tháng', year: 'năm' };
const states = { overdue: 'Quá hạn hủy', today: 'Cần hủy hôm nay', upcoming: 'Sắp tới', cancelled: 'Đã hủy', renewed: 'Đã gia hạn' };
const dateText = (value: string) => value.split('-').reverse().join('/');
const money = (item: Pick<Subscription, 'price' | 'currency'>) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: item.currency, maximumFractionDigits: item.currency === 'VND' ? 0 : 2 }).format(Number(item.price));
const newForm = (startDate: string): Form => ({ customerId: null, customerName: '', customerContact: '', appName: '', planName: '', account: '', durationValue: 1, durationUnit: 'month', price: '', currency: 'VND', startDate, cancelDate: subscriptionEnd(startDate, 1, 'month'), note: '' });

async function responseData<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.detail || 'Không thể kết nối. Vui lòng thử lại.');
  return body as T;
}

export default function SubscriptionsClient() {
  const { token } = useAuth();
  const [today, setToday] = useState(() => todayKey());
  const [month, setMonth] = useState(() => todayKey().slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(() => todayKey());
  const [items, setItems] = useState<Subscription[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [customerError, setCustomerError] = useState('');
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('active');
  const [app, setApp] = useState('');
  const [focus, setFocus] = useState<Focus>('day');
  const [form, setForm] = useState<Form | null>(null);
  const [detail, setDetail] = useState<Subscription | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Subscription | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [message, setMessage] = useState('');
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }), [token]);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    fetch('/api/sales/subscriptions', { headers, signal: controller.signal })
      .then(responseData<Subscription[]>).then(data => { setItems(data); setLoadError(''); })
      .catch(error => { if (!controller.signal.aborted) setLoadError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    fetch('/api/sales/customers', { headers, signal: controller.signal })
      .then(responseData<Customer[]>).then(data => { setCustomers(data); setCustomerError(''); })
      .catch(() => { if (!controller.signal.aborted) setCustomerError('Chưa tải được danh sách khách. Bạn vẫn có thể nhập tên và liên hệ trực tiếp.'); });
    return () => controller.abort();
  }, [token, headers, revision]);

  useEffect(() => {
    const timer = window.setInterval(() => setToday(todayKey()), 60_000);
    const refreshToday = () => setToday(todayKey());
    window.addEventListener('focus', refreshToday);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refreshToday); };
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(''), 4000);
    return () => window.clearTimeout(timer);
  }, [message]);

  const active = items.filter(item => item.status === 'active');
  const overdue = active.filter(item => item.cancelDate < today);
  const dueToday = active.filter(item => item.cancelDate === today);
  const nextWeek = active.filter(item => item.cancelDate > today && item.cancelDate <= addDays(today, 7));
  const shown = items.filter(item => (status === 'all' || item.status === status) && (!app || item.appName === app) && `${item.customerName} ${item.customerContact} ${item.account} ${item.appName} ${item.planName}`.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi')));
  const byDay = new Map<string, Subscription[]>();
  shown.forEach(item => byDay.set(item.cancelDate, [...(byDay.get(item.cancelDate) || []), item]));
  const agenda = shown.filter(item => focus === 'overdue' ? item.status === 'active' && item.cancelDate < today : focus === 'week' ? item.status === 'active' && item.cancelDate > today && item.cancelDate <= addDays(today, 7) : item.cancelDate === selectedDate);
  const agendaTitle = focus === 'overdue' ? 'Cần xử lý quá hạn' : focus === 'week' ? 'Trong 7 ngày tới' : `Lịch hẹn ${dateText(selectedDate)}`;
  const days = calendarDays(month);
  const monthTitle = new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`));

  function selectDate(date: string) { setSelectedDate(date); setFocus('day'); }
  function selectSummary(next: Focus) { setFocus(next); setStatus('active'); setApp(''); setSearch(''); }
  function moveMonth(direction: number) {
    const date = new Date(`${month}-01T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + direction);
    const next = date.toISOString().slice(0, 7);
    if (next < '2000-01' || next > '2199-12') return;
    setMonth(next);
    selectDate(`${next}-01`);
  }
  function beginForm(value: Form) { setActionError(''); setDetail(null); setForm(value); }
  function renew(item: Subscription) {
    const startDate = item.endDate;
    const endDate = subscriptionEnd(startDate, item.durationValue, item.durationUnit);
    beginForm({ ...item, id: undefined, renewFromId: item.id, startDate, cancelDate: defaultCancelDate(startDate, endDate) });
  }

  async function save(value: Form) {
    if (saving) return;
    const parsed = validateSubscription(value);
    if ('error' in parsed) { setActionError(parsed.error); return; }
    setSaving(true); setActionError('');
    try {
      const response = await fetch(`/api/sales/subscriptions${value.id ? `/${value.id}` : ''}`, { method: value.id ? 'PUT' : 'POST', headers, body: JSON.stringify(value) });
      const row = await responseData<Subscription>(response);
      setItems(current => [...current.filter(item => item.id !== row.id).map(item => item.id === value.renewFromId ? { ...item, status: 'renewed' as const } : item), row].sort((a, b) => a.cancelDate.localeCompare(b.cancelDate)));
      setForm(null); setMonth(row.cancelDate.slice(0, 7)); selectDate(row.cancelDate); setStatus(row.status === 'active' ? 'active' : 'all'); setApp(''); setSearch('');
      setMessage(value.id ? 'Đã cập nhật gói đăng ký.' : value.renewFromId ? 'Đã tạo kỳ gia hạn mới và lưu lịch sử kỳ trước.' : 'Đã thêm gói vào lịch nhắc hủy.');
    } catch (error) { setActionError(error instanceof Error ? error.message : 'Không thể lưu gói.'); }
    finally { setSaving(false); }
  }

  async function changeStatus(item: Subscription, next: 'active' | 'cancelled') {
    if (saving) return;
    setSaving(true); setActionError('');
    try {
      const row = await fetch(`/api/sales/subscriptions/${item.id}`, { method: 'PATCH', headers, body: JSON.stringify({ status: next }) }).then(responseData<Subscription>);
      setItems(current => current.map(existing => existing.id === row.id ? row : existing));
      setDetail(row); setMessage(next === 'cancelled' ? 'Đã đánh dấu hủy gói.' : 'Đã đưa gói trở lại lịch nhắc.');
    } catch (error) { setActionError(error instanceof Error ? error.message : 'Không thể đổi trạng thái.'); }
    finally { setSaving(false); }
  }

  async function remove() {
    if (!deleteTarget || saving) return;
    setSaving(true); setActionError('');
    try {
      await fetch(`/api/sales/subscriptions/${deleteTarget.id}`, { method: 'DELETE', headers }).then(responseData<{ ok: boolean }>);
      setItems(current => current.filter(item => item.id !== deleteTarget.id));
      setDeleteTarget(null); setMessage('Đã xóa gói khỏi lịch.');
    } catch (error) { setActionError(error instanceof Error ? error.message : 'Không thể xóa gói.'); }
    finally { setSaving(false); }
  }

  return <div className="business-shell subscription-tracker min-h-screen bg-[#fef9f4] p-3 pt-[calc(4.75rem+env(safe-area-inset-top,0px))] md:flex md:p-6 md:pt-6">
    <Sidebar />
    <main className="business-main min-w-0 flex-1">
      <div className="business-content mx-auto max-w-7xl">
        <header className="subscription-heading">
          <div><p className="subscription-eyebrow"><CalendarClock size={18} /> Lịch nhắc trong ứng dụng</p><h1>Lịch gia hạn</h1><p>Theo dõi gói của khách, nhớ đúng ngày cần hủy.</p></div>
          <button type="button" className="btn-push-primary subscription-add" onClick={() => beginForm(newForm(today))} disabled={loading || !!loadError}><Plus size={20} /> Thêm gói</button>
        </header>

        <div className="subscription-summary" aria-label="Tổng hợp lịch nhắc">
          <button type="button" data-tone="overdue" onClick={() => selectSummary('overdue')}><span>Quá hạn cần hủy</span><strong>{overdue.length}</strong></button>
          <button type="button" data-tone="today" onClick={() => { setMonth(today.slice(0, 7)); selectDate(today); selectSummary('day'); }}><span>Cần hủy hôm nay</span><strong>{dueToday.length}</strong></button>
          <button type="button" onClick={() => selectSummary('week')}><span>Trong 7 ngày tới</span><strong>{nextWeek.length}</strong></button>
          <div><span>Gói đang theo dõi</span><strong>{active.length}</strong></div>
        </div>

        {loadError ? <div className="subscription-error" role="alert"><p>{loadError}</p><button type="button" onClick={() => { setLoading(true); setLoadError(''); setRevision(value => value + 1); }}>Thử tải lại</button></div> : loading ? <div className="subscription-loading" role="status"><Loader2 className="animate-spin" /> Đang tải lịch gia hạn…</div> : <>
          <div className="subscription-filters">
            <label className="subscription-search"><Search size={18} aria-hidden="true" /><input aria-label="Tìm gói đăng ký" placeholder="Tìm khách, tài khoản, ứng dụng…" value={search} onChange={event => setSearch(event.target.value)} /></label>
            <select aria-label="Lọc theo ứng dụng" value={app} onChange={event => setApp(event.target.value)}><option value="">Tất cả ứng dụng</option>{Array.from(new Set(items.map(item => item.appName))).sort().map(name => <option key={name}>{name}</option>)}</select>
            <select aria-label="Lọc trạng thái" value={status} onChange={event => setStatus(event.target.value)}><option value="active">Đang theo dõi</option><option value="all">Tất cả trạng thái</option><option value="cancelled">Đã hủy</option><option value="renewed">Đã gia hạn</option></select>
            <button type="button" className="subscription-icon-button" aria-label="Tải lại lịch" onClick={() => { setLoading(true); setRevision(value => value + 1); }}><RefreshCw size={18} /></button>
          </div>

          {!items.length && <div className="subscription-welcome"><CalendarClock size={32} /><div><b>Bắt đầu với gói đầu tiên</b><p>Thêm khách, tài khoản và thời hạn. Lịch sẽ đặt hẹn vào đúng ngày hết hạn.</p></div></div>}
          <div className="subscription-workspace">
            <section className="subscription-calendar" aria-label="Lịch tháng nhắc hủy gói">
              <div className="subscription-calendar-toolbar"><h2 aria-live="polite">{monthTitle}</h2><div><button type="button" onClick={() => { setMonth(today.slice(0, 7)); selectDate(today); }}>Hôm nay</button><button type="button" aria-label="Tháng trước" onClick={() => moveMonth(-1)}><ChevronLeft size={20} /></button><button type="button" aria-label="Tháng sau" onClick={() => moveMonth(1)}><ChevronRight size={20} /></button></div></div>
              <div className="subscription-weekdays" aria-hidden="true">{['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(day => <span key={day}>{day}</span>)}</div>
              <div className="subscription-days">
                {days.map(day => {
                  const events = byDay.get(day) || [];
                  return <div key={day} className="subscription-day" data-outside={day.slice(0, 7) !== month} data-selected={day === selectedDate && focus === 'day'}>
                    <button type="button" className="subscription-day-number" aria-label={`${dateText(day)}, ${events.length} lịch hẹn`} aria-pressed={day === selectedDate && focus === 'day'} aria-current={day === today ? 'date' : undefined} onClick={() => selectDate(day)}>{Number(day.slice(-2))}{day === today && <span className="sr-only">, hôm nay</span>}</button>
                    {events.slice(0, 2).map(item => <button type="button" key={item.id} className="subscription-calendar-event" data-state={reminderState(item, today)} title={`${item.appName} · ${item.customerName} · ${item.account} · ${money(item)}`} onClick={() => { selectDate(day); setActionError(''); setDetail(item); }}><b>{item.appName}</b><span>{item.customerName}</span><small>{money(item)}</small></button>)}
                    {events.length > 2 && <button type="button" className="subscription-more" onClick={() => selectDate(day)}>+{events.length - 2} gói</button>}
                  </div>;
                })}
              </div>
              <div className="subscription-legend"><span data-state="overdue">Quá hạn</span><span data-state="today">Hôm nay</span><span data-state="upcoming">Sắp tới</span><span data-state="cancelled">Đã xử lý</span></div>
            </section>

            <aside className="subscription-agenda" aria-label="Danh sách lịch hẹn">
              <h2>{agendaTitle}</h2><p className="subscription-agenda-caption">{agenda.length} gói · bấm để xem và xử lý</p>
              {agenda.length ? agenda.map(item => <button type="button" className="subscription-agenda-item" key={item.id} data-state={reminderState(item, today)} onClick={() => { setActionError(''); setDetail(item); }}><span className="subscription-state">{states[reminderState(item, today)]}</span><strong>{item.appName}{item.planName && ` · ${item.planName}`}</strong><span>{item.customerName}</span><span className="subscription-account">{item.account}</span><span className="subscription-agenda-bottom"><b>{money(item)}</b><span>{dateText(item.cancelDate)}</span></span></button>) : <div className="subscription-agenda-empty"><Check size={28} /><p>{search || app ? 'Không có gói phù hợp bộ lọc.' : 'Không có lịch hẹn cần xử lý ở đây.'}</p></div>}
            </aside>
          </div>
        </>}
      </div>
    </main>

    {form && <SubscriptionForm key={form.id || form.renewFromId || 'new'} initial={form} customers={customers} customerError={customerError} busy={saving} error={actionError} save={save} close={() => { if (!saving) setForm(null); }} />}
    {detail && <Dialog title={`${detail.appName}${detail.planName ? ` · ${detail.planName}` : ''}`} close={() => { if (!saving) setDetail(null); }} busy={saving}>
      <div className="subscription-detail"><span className="subscription-state" data-state={reminderState(detail, today)}>{states[reminderState(detail, today)]}</span><h3>{detail.customerName}</h3><dl>{[['Tài khoản ứng dụng', detail.account], ['Liên hệ khách', detail.customerContact || 'Chưa có'], ['Thời hạn', `${detail.durationValue} ${units[detail.durationUnit]}`], ['Giá gói', money(detail)], ['Bắt đầu', dateText(detail.startDate)], ['Hết hạn', dateText(detail.endDate)], ['Ngày nhắc hủy', dateText(detail.cancelDate)]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{detail.note && <p className="subscription-note">{detail.note}</p>}{actionError && <p className="subscription-error" role="alert">{actionError}</p>}
        <div className="subscription-detail-actions">
          {detail.status === 'active' && <><button type="button" disabled={saving} className="btn-push-primary" onClick={() => void changeStatus(detail, 'cancelled')}><Check size={18} /> Đánh dấu đã hủy</button><button type="button" disabled={saving} className="btn-push" onClick={() => renew(detail)}><RefreshCw size={18} /> Gia hạn kỳ tiếp</button></>}
          {detail.status === 'cancelled' && <button type="button" disabled={saving} className="btn-push" onClick={() => void changeStatus(detail, 'active')}>Đưa lại vào lịch nhắc</button>}
          <button type="button" disabled={saving} className="ui-flat-control" onClick={() => beginForm({ ...detail })}><Pencil size={18} /> Chỉnh sửa</button>
          <button type="button" disabled={saving} className="ui-flat-control" onClick={() => { setDeleteTarget(detail); setDetail(null); setActionError(''); }}><Trash2 size={18} /> Xóa gói</button>
        </div>
      </div>
    </Dialog>}
    {deleteTarget && <Dialog title="Xóa gói khỏi lịch?" alert close={() => { if (!saving) setDeleteTarget(null); }} busy={saving}><p>Xóa gói {deleteTarget.appName} của {deleteTarget.customerName} và lịch hẹn tương ứng?</p>{actionError && <p className="subscription-error" role="alert">{actionError}</p>}<div className="subscription-detail-actions"><button type="button" disabled={saving} className="btn-push" onClick={() => setDeleteTarget(null)}>Giữ lại</button><button type="button" disabled={saving} className="btn-push-danger" onClick={() => void remove()}>{saving ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />} Xóa gói</button></div></Dialog>}
    {message && <div className="subscription-toast" role="status"><Check size={18} />{message}</div>}
  </div>;
}

function SubscriptionForm({ initial, customers, customerError, busy, error, save, close }: { initial: Form; customers: Customer[]; customerError: string; busy: boolean; error: string; save: (value: Form) => Promise<void>; close: () => void }) {
  const [value, setValue] = useState(initial);
  const id = useId();
  const end = subscriptionEnd(value.startDate, value.durationValue, value.durationUnit);
  function changePeriod(patch: Partial<Form>) {
    const next = { ...value, ...patch };
    const nextEnd = subscriptionEnd(next.startDate, next.durationValue, next.durationUnit);
    const previousEnd = subscriptionEnd(value.startDate, value.durationValue, value.durationUnit);
    const lead = previousEnd && value.cancelDate ? Math.max(0, Math.round((Date.parse(previousEnd) - Date.parse(value.cancelDate)) / 86_400_000)) : 0;
    next.cancelDate = defaultCancelDate(next.startDate, nextEnd, lead);
    setValue(next);
  }
  return <Dialog title={value.id ? 'Chỉnh sửa gói' : value.renewFromId ? 'Gia hạn kỳ tiếp' : 'Thêm gói đăng ký'} busy={busy} close={close}>
    <form onSubmit={event => { event.preventDefault(); void save(value); }}><fieldset disabled={busy} className="subscription-form">
      {customerError && <p className="subscription-form-hint">{customerError}</p>}
      <label className="subscription-form-wide">Khách hàng có sẵn<select value={value.customerId || ''} onChange={event => { const customer = customers.find(item => item.id === event.target.value); setValue({ ...value, customerId: customer?.id || null, ...(customer ? { customerName: customer.name, customerContact: customer.phone || customer.email || '' } : {}) }); }}><option value="">Nhập thông tin khách trực tiếp</option>{customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}{customer.phone ? ` · ${customer.phone}` : ''}</option>)}</select></label>
      <label>Tên khách *<input required maxLength={250} value={value.customerName} onChange={event => setValue({ ...value, customerName: event.target.value })} data-dialog-initial-focus /></label>
      <label>Liên hệ khách<input maxLength={250} value={value.customerContact} placeholder="SĐT, email hoặc link liên hệ" onChange={event => setValue({ ...value, customerContact: event.target.value })} /></label>
      <label>Ứng dụng *<input required maxLength={250} placeholder="VD: Canva, Netflix…" value={value.appName} onChange={event => setValue({ ...value, appName: event.target.value })} /></label>
      <label>Tên gói<input maxLength={250} placeholder="VD: Pro, Premium…" value={value.planName} onChange={event => setValue({ ...value, planName: event.target.value })} /></label>
      <label className="subscription-form-wide">Tài khoản sử dụng *<input required maxLength={250} placeholder="Email hoặc tên tài khoản của khách" value={value.account} onChange={event => setValue({ ...value, account: event.target.value })} /></label>
      <label>Thời hạn *<div className="subscription-period"><input aria-label="Số kỳ" required type="number" min="1" max={{ day: 3650, month: 120, year: 10 }[value.durationUnit]} value={value.durationValue || ''} onChange={event => changePeriod({ durationValue: Number(event.target.value) })} /><select aria-label="Đơn vị thời hạn" value={value.durationUnit} onChange={event => changePeriod({ durationUnit: event.target.value as DurationUnit })}>{Object.entries(units).map(([unit, label]) => <option key={unit} value={unit}>{label}</option>)}</select></div></label>
      <label>Ngày bắt đầu *<input required type="date" min="2000-01-01" max="2199-12-31" value={value.startDate} onChange={event => changePeriod({ startDate: event.target.value })} /></label>
      <label>Giá gói *<input required type="number" min="0" max="999999999999.99" step="0.01" value={value.price} onChange={event => setValue({ ...value, price: event.target.value })} /></label>
      <label>Tiền tệ<select value={value.currency} onChange={event => setValue({ ...value, currency: event.target.value })}>{subscriptionCurrencies.map(currency => <option key={currency}>{currency}</option>)}</select></label>
      <div className="subscription-form-hint subscription-form-wide">Ngày hết hạn: <b>{end ? dateText(end) : 'Chọn ngày bắt đầu và thời hạn'}</b></div>
      <label className="subscription-form-wide" htmlFor={`${id}-cancel`}>Ngày nhắc hủy *<input id={`${id}-cancel`} required type="date" min={value.startDate} max={end || '2199-12-31'} value={value.cancelDate} onChange={event => setValue({ ...value, cancelDate: event.target.value })} /><small>Mặc định đúng ngày hết hạn. Có thể chọn ngày sớm hơn.</small></label>
      <label className="subscription-form-wide">Ghi chú<textarea maxLength={5000} rows={3} value={value.note} placeholder="Thông tin cần nhớ khi xử lý gói…" onChange={event => setValue({ ...value, note: event.target.value })} /></label>
      {error && <p role="alert" className="subscription-error subscription-form-wide">{error}</p>}
      <button type="submit" className="btn-push-primary subscription-form-wide subscription-save" disabled={busy}>{busy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}{busy ? 'Đang lưu…' : value.renewFromId ? 'Lưu kỳ gia hạn mới' : 'Lưu gói vào lịch'}</button>
    </fieldset></form>
  </Dialog>;
}
