'use client';

import StyledSelect from '@/components/StyledSelect';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { Check, Copy, Download, Loader2, Plus, Search, Ticket, Pencil } from 'lucide-react';
import { useAuth } from '@/app/contexts/AuthContext';
import Sidebar from '@/components/Sidebar';
import CustomersNav from '../CustomersNav';
import { normalizeVoucherCode, validateVoucherCode, validateVoucherBenefit, voucherBenefitLabel, readBuyXPayYRule, type VoucherBenefit, type BuyXPayYRule } from '@/lib/vouchers';
import VoucherGroupFields from './VoucherGroupFields';

type Voucher = VoucherBenefit & { id: string; code: string; note: string | null; createdAt: string; barcodeDataUrl: string };
const errorText = (reason: unknown, fallback: string) => axios.isAxiosError<{ detail?: string }>(reason) ? reason.response?.data.detail || fallback : fallback;
const defaultGroupRule = (): BuyXPayYRule => ({ requiredQuantity: 4, paidQuantity: 3, grouping: 'mixed', eligibleProductIds: [], repeatable: true, maxFreeQuantity: null });

export default function VouchersClient() {
  const { user, token, isLoading } = useAuth();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [code, setCode] = useState('');
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [benefitType, setBenefitType] = useState<VoucherBenefit['benefitType']>('amount');
  const [benefitValue, setBenefitValue] = useState('');
  const [benefitText, setBenefitText] = useState('');
  const [groupRule, setGroupRule] = useState<BuyXPayYRule>(defaultGroupRule);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) return;
    let active = true;
    axios.get<Voucher[]>('/api/sales/vouchers', { headers: { Authorization: `Bearer ${token}` } })
      .then(response => { if (active) { setVouchers(response.data); setLoadError(''); } })
      .catch(reason => { if (active) setLoadError(errorText(reason, 'Không tải được danh sách voucher.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, reload]);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || saving) return;
    const normalized = normalizeVoucherCode(code);
    const invalid = validateVoucherCode(normalized);
    if (invalid) { setError(invalid); return; }
    const benefit: VoucherBenefit = { benefitType, benefitValue: benefitType === 'custom' || benefitType === 'buy_x_pay_y' ? 0 : Number(benefitValue), benefitText: benefitType === 'buy_x_pay_y' ? JSON.stringify(groupRule) : benefitType === 'custom' ? benefitText.trim() : null };
    const invalidBenefit = validateVoucherBenefit(benefit);
    if (invalidBenefit) { setError(invalidBenefit); return; }
    setSaving(true); setError(''); setMessage('');
    try {
      const response = await axios.request<Voucher>({ url: '/api/sales/vouchers', method: editing ? 'PATCH' : 'POST', data: { id: editing, code: normalized, note, ...benefit }, headers: { Authorization: `Bearer ${token}` } });
      setVouchers(previous => [response.data, ...previous.filter(voucher => voucher.id !== response.data.id)]);
      setCode(''); setNote(''); setSearch(''); setEditing(null); setBenefitValue(''); setBenefitText('');
      setGroupRule(defaultGroupRule());
      setMessage(`Đã lưu voucher ${response.data.code}: ${voucherBenefitLabel(response.data)}.`);
    } catch (reason) { setError(errorText(reason, 'Không tạo được voucher. Vui lòng thử lại.')); }
    finally { setSaving(false); }
  };

  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); setMessage(`Đã sao chép mã ${value}.`); }
    catch { setMessage('Không sao chép được. Bạn có thể chọn và sao chép mã trực tiếp.'); }
  };
  const shown = vouchers.filter(voucher => `${voucher.code} ${voucher.note || ''}`.toLocaleUpperCase('vi-VN').includes(search.toLocaleUpperCase('vi-VN').trim()));

  if (isLoading || !user) return <div className="min-h-screen"/>;
  return <div className="business-shell min-h-screen p-3 pb-[calc(12rem+env(safe-area-inset-bottom))] pt-[calc(4.75rem+env(safe-area-inset-top,0px))] md:flex md:gap-5 md:p-6 md:pb-8">
    <Sidebar/>
    <main className="business-main min-w-0 flex-1"><div className="business-content mx-auto max-w-6xl">
      <header className="page-heading page-heading-panel card-push p-5">
        <p className="text-xs font-black uppercase tracking-wide">CRM bán hàng</p>
        <h1 className="mt-2 font-black">Voucher khách hàng</h1>
        <p className="mt-2 text-sm">Tạo mã theo ý bạn và gửi mã QR cho khách. Voucher không có ngày hết hạn.</p>
      </header>
      <CustomersNav view="vouchers"/>
      <section className="card-push p-4 md:p-6" aria-labelledby="create-voucher-heading">
        <h2 id="create-voucher-heading" className="voucher-section-title">{editing ? 'Sửa quyền lợi voucher' : 'Tạo voucher'}</h2>
        <form onSubmit={save} className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <label className="block min-w-0"><span className="mb-2 block text-sm font-bold">Mã voucher</span><input required autoCapitalize="characters" autoComplete="off" spellCheck={false} value={code} onChange={event => { setCode(event.target.value.toUpperCase()); setError(''); }} maxLength={64} disabled={saving || !!editing} placeholder="VD: CAMON2026" aria-describedby="voucher-code-help" className="input-push h-12 w-full min-w-0 px-3"/></label>
          <label className="block min-w-0"><span className="mb-2 block text-sm font-bold">Ghi chú (không bắt buộc)</span><input value={note} onChange={event => setNote(event.target.value)} maxLength={500} disabled={saving} placeholder="Ưu đãi, điều kiện sử dụng..." className="input-push h-12 w-full min-w-0 px-3"/></label>
          <button type="submit" disabled={saving || loading || !!loadError} className="btn-push-primary flex h-12 items-center justify-center gap-2 px-4 text-sm font-bold disabled:opacity-50">{saving ? <Loader2 size={18} className="animate-spin"/> : <Plus size={18}/>}{editing ? 'Lưu quyền lợi' : 'Tạo voucher'}</button>
          <label className="block min-w-0"><span className="mb-2 block text-sm font-bold">Loại quyền lợi</span><StyledSelect aria-label="Loại quyền lợi" value={benefitType} disabled={saving} onChange={e => setBenefitType(e.target.value as VoucherBenefit['benefitType'])} className="input-push h-12 w-full px-3"><option value="amount">Giảm số tiền (đ)</option><option value="percent">Giảm phần trăm (%)</option><option value="buy_x_pay_y">Đi X tính tiền Y</option><option value="custom">Quyền lợi khác / tặng quà</option></StyledSelect></label>
          {benefitType === 'buy_x_pay_y' ? <VoucherGroupFields rule={groupRule} onChange={setGroupRule} disabled={saving} token={token}/> : benefitType === 'custom' ? <label className="block min-w-0 md:col-span-2"><span className="mb-2 block text-sm font-bold">Nội dung quyền lợi</span><input required value={benefitText} onChange={e => setBenefitText(e.target.value)} disabled={saving} maxLength={500} placeholder="VD: Tặng 1 ly cà phê" className="input-push h-12 w-full px-3"/></label> : <label className="block min-w-0"><span className="mb-2 block text-sm font-bold">{benefitType === 'percent' ? 'Phần trăm giảm' : 'Số tiền giảm (đ)'}</span><input required type="number" min="1" max={benefitType === 'percent' ? 100 : 2147483647} step="1" value={benefitValue} onChange={e => setBenefitValue(e.target.value)} disabled={saving} className="input-push h-12 w-full px-3"/></label>}
          <p className="text-xs md:col-span-3">{benefitType === 'custom' ? 'Nhân viên thực hiện quyền lợi ghi trên đơn; hệ thống không tự trừ kho quà tặng.' : 'Tự giảm trên tiền hàng, không gồm phí ship. Không cộng dồn với giảm thủ công; mức giảm tối đa bằng tiền hàng.'}</p>
          {editing && <button type="button" disabled={saving} onClick={() => { setEditing(null); setCode(''); setNote(''); setBenefitType('amount'); setBenefitValue(''); setBenefitText(''); setGroupRule(defaultGroupRule()); setError(''); }} className="btn-push px-3 py-2 text-sm">Hủy sửa</button>}
          <p id="voucher-code-help" className="text-xs md:col-span-3">Chữ được tự động viết hoa. Dùng chữ, số, dấu - hoặc _, tối đa 64 ký tự.</p>
        </form>
        {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      </section>
      <p role="status" aria-live="polite" className="my-4 text-sm font-bold">{message}</p>
      <section className="card-push p-4 md:p-6" aria-labelledby="voucher-list-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="voucher-list-heading" className="voucher-section-title">Voucher đã tạo ({vouchers.length})</h2>
          <label className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-sm"><Search size={18} className="shrink-0"/><input type="search" aria-label="Tìm voucher" placeholder="Tìm mã, ghi chú..." value={search} onChange={event => setSearch(event.target.value)} className="input-push h-11 w-full min-w-0 px-3"/></label>
        </div>
        {loading ? <div role="status" className="flex justify-center py-12"><Loader2 className="animate-spin"/><span className="sr-only">Đang tải voucher</span></div>
          : loadError ? <div role="alert" className="py-6"><p>{loadError}</p><button type="button" onClick={() => { setLoading(true); setReload(value => value + 1); }} className="btn-push mt-3 px-4 py-2">Thử lại</button></div>
          : shown.length ? <div className="voucher-grid mt-5">{shown.map(voucher => <article key={voucher.id} className="card-push-subtle voucher-card">
            <div className="voucher-barcode">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={voucher.barcodeDataUrl} alt={`Mã QR voucher ${voucher.code}`} width={320} height={320}/>
            </div>
            <div className="min-w-0 flex-1">
              <b className="voucher-code select-all">{voucher.code}</b>
              <p className="voucher-benefit mt-1 text-sm font-bold">{voucherBenefitLabel(voucher)}</p>
              <p className="mt-1 flex items-center gap-1 text-xs text-green-700"><Check size={15}/>Không hết hạn</p>
              {voucher.note && <p className="mt-2 break-words text-sm">{voucher.note}</p>}
              <p className="mt-1 text-xs">Ngày tạo: {new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short' }).format(new Date(voucher.createdAt))}</p>
              <div className="voucher-card-actions">
                <button type="button" onClick={() => { setEditing(voucher.id); setCode(voucher.code); setNote(voucher.note || ''); setBenefitType(voucher.benefitType === 'none' ? 'amount' : voucher.benefitType); setBenefitValue(voucher.benefitValue ? String(voucher.benefitValue) : ''); setBenefitText(voucher.benefitType === 'custom' ? voucher.benefitText || '' : ''); setGroupRule(readBuyXPayYRule(voucher) || defaultGroupRule()); setError(''); document.getElementById('create-voucher-heading')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} aria-label="Sửa quyền lợi" title="Sửa quyền lợi" className="voucher-action btn-push"><Pencil size={16}/></button>
                <button type="button" onClick={() => void copy(voucher.code)} aria-label="Sao chép mã" title="Sao chép mã" className="voucher-action btn-push"><Copy size={16}/></button>
                <a href={voucher.barcodeDataUrl} download={`voucher-${voucher.code}.png`} aria-label="Tải mã QR" title="Tải mã QR" className="voucher-action btn-push"><Download size={16}/></a>
              </div>
            </div>
          </article>)}</div>
          : <div className="flex flex-col items-center gap-3 py-12 text-center"><Ticket size={32}/><p>{search.trim() ? 'Không tìm thấy voucher phù hợp.' : 'Chưa có voucher. Tạo mã đầu tiên để nhận mã QR.'}</p></div>}
      </section>
    </div></main>
  </div>;
}
