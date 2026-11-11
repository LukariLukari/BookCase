'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { ScanQrCode, Loader2, X } from 'lucide-react';
import { useAuth } from '@/app/contexts/AuthContext';
import FinanceDialog from './expenses/FinanceDialog';
import { validateVoucherBenefit, voucherBenefitLabel, groupVoucherDiscount, type VoucherBenefit, type VoucherLine } from '@/lib/vouchers';

function VoucherCamera({ onRead }: { onRead: (value: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState('');
  const readingImage = useRef(false);
  const delivered = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const readImage = async (file: File) => {
    if (readingImage.current || delivered.current) return;
    readingImage.current = true;
    setImageBusy(true); setImageError('');
    try {
      const { readVoucherImage } = await import('@/lib/voucherScanner');
      const value = await readVoucherImage(file);
      if (alive.current && !delivered.current) { delivered.current = true; onRead(value); }
    } catch {
      if (alive.current) setImageError('Không đọc được mã trong ảnh. Hãy chọn ảnh rõ, có trọn mã QR và viền trắng.');
    } finally {
      readingImage.current = false;
      if (alive.current) setImageBusy(false);
    }
  };
  useEffect(() => {
    let active = true, captured = false;
    let stream: MediaStream | undefined;
    let controls: { stop: () => void } | undefined;
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('CAMERA_UNAVAILABLE');
        const { createVoucherScanner, isUnreadableBarcodeFrame } = await import('@/lib/voucherScanner');
        if (!active) return;
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        if (!active) { stream.getTracks().forEach(track => track.stop()); return; }
        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities?.() as (MediaTrackCapabilities & { focusMode?: string[] }) | undefined;
        if (capabilities?.focusMode?.includes('continuous')) {
          // Unsupported focus constraints must not prevent decoding.
          await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => {});
        }
        if (!active) { stream.getTracks().forEach(track => track.stop()); return; }
        const reader = createVoucherScanner();
        let failed = false;
        controls = await reader.decodeFromStream(stream, video.current!, (result, scanError, scanner) => {
          if (active && !captured && !delivered.current && !readingImage.current && result) { captured = true; delivered.current = true; scanner.stop(); onRead(result.getText()); }
          else if (active && scanError && !isUnreadableBarcodeFrame(scanError)) {
            failed = true;
            setError('Bộ đọc mã đã dừng. Hãy đóng cửa sổ và mở lại để thử quét lại.');
          }
        });
        if (!active || captured || failed) controls.stop();
        else setReady(true);
      } catch {
        stream?.getTracks().forEach(track => track.stop());
        if (active) setError('Không mở được camera. Hãy cho phép truy cập camera hoặc nhập mã voucher bên ngoài cửa sổ này.');
      }
    };
    void start();
    return () => { active = false; controls?.stop(); stream?.getTracks().forEach(track => track.stop()); };
  }, [onRead]);
  return <div>
    <video ref={video} autoPlay muted playsInline aria-label="Camera quét QR voucher" className="voucher-camera"/>
    <p className="mt-3 text-sm" role={error ? 'alert' : 'status'}>{error || (ready ? 'Đưa trọn mã QR vuông vào hình, giữ máy ổn định và đủ sáng. Voucher sẽ tự áp dụng khi đọc được mã. Bạn cũng có thể chọn ảnh QR bên dưới.' : 'Đang khởi động bộ đọc QR…')}</p>
    <label className="btn-push mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 px-3 py-2 text-sm focus-within:outline-2">
      <input type="file" accept="image/*" className="sr-only" disabled={imageBusy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void readImage(file); }}/>
      {imageBusy ? <><Loader2 size={16} className="animate-spin"/>Đang đọc ảnh…</> : 'Chọn ảnh QR / barcode'}
    </label>
    {imageError && <p role="alert" className="mt-2 text-sm text-red-700">{imageError}</p>}
  </div>;
}

export default function VoucherScanField({ value, benefit, items = [], onChange, onBusyChange }: { value: string; benefit?: VoucherBenefit | null; items?: VoucherLine[]; onChange: (code: string, benefit?: VoucherBenefit | null) => void; onBusyChange: (busy: boolean) => void }) {
  const { token } = useAuth();
  const [input, setInput] = useState('');
  const [note, setNote] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const read = useCallback(async (raw: string) => {
    setOpen(false);
    if (!token || !raw.trim() || submitting.current) return;
    submitting.current = true; setBusy(true); onBusyChange(true); setError('');
    try {
      const response = await axios.post<VoucherBenefit & { code: string; note: string | null }>('/api/sales/vouchers/resolve', { value: raw }, { headers: { Authorization: `Bearer ${token}` } });
      if (validateVoucherBenefit(response.data)) { setError('Voucher chưa có quyền lợi. Hãy sửa voucher trước khi sử dụng.'); return; }
      if (alive.current) { onChange(response.data.code, response.data); setNote(response.data.note || ''); setInput(''); }
    } catch (reason) {
      if (alive.current) setError(axios.isAxiosError<{ detail?: string }>(reason) ? reason.response?.data.detail || 'Không kiểm tra được voucher. Vui lòng thử lại.' : 'Không kiểm tra được voucher.');
    } finally { submitting.current = false; if (alive.current) { setBusy(false); onBusyChange(false); } }
  }, [token, onChange, onBusyChange]);
  const onRead = useCallback((raw: string) => { void read(raw); }, [read]);
  const groupResult = benefit?.benefitType === 'buy_x_pay_y' && !validateVoucherBenefit(benefit) ? groupVoucherDiscount(benefit, items) : null;
  return <div className="min-w-0">
    <label className="mb-2 block text-xs font-black" htmlFor="sale-voucher-code">Voucher (không bắt buộc)</label>
    <div className="voucher-scan-controls">
      <input id="sale-voucher-code" autoComplete="off" autoCapitalize="characters" spellCheck={false} value={input} disabled={busy} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void read(input); } }} placeholder="Nhập hoặc quét mã" className="min-w-0 flex-1 px-2"/>
      <button type="button" disabled={busy || !input.trim()} onClick={() => void read(input)} className="btn-push px-2 text-xs">{busy ? <Loader2 size={16} className="animate-spin"/> : 'Áp dụng'}</button>
      <button type="button" disabled={busy} onClick={() => { setError(''); setOpen(true); }} aria-label="Quét QR voucher" title="Quét QR voucher" className="btn-push voucher-scan-button"><ScanQrCode size={22}/></button>
    </div>
    {value && <div role="status" className="mt-2 text-sm"><div className="flex items-center justify-between gap-2"><b className="break-all text-green-700">Đã áp dụng: {value}</b><button type="button" disabled={busy} onClick={() => { onChange(''); setNote(''); setError(''); }} aria-label="Bỏ voucher" className="flex h-9 w-9 shrink-0 items-center justify-center"><X size={16}/></button></div>{benefit && <p className="mt-1 break-words text-sm font-bold">{voucherBenefitLabel(benefit)}</p>}{benefit?.benefitType==='custom'&&<p className="text-xs">Nhân viên thực hiện quyền lợi; không tự trừ kho quà tặng.</p>}{note && <p className="break-words text-xs">{note}</p>}</div>}
    {groupResult && <p role="status" className="mt-2 text-xs">{groupResult.freeQuantity > 0 ? `${groupResult.eligibleQuantity} suất thuộc gói áp dụng · Miễn ${groupResult.freeQuantity} suất giá thấp nhất · Giảm ${groupResult.discount.toLocaleString('vi-VN')} đ` : `${groupResult.eligibleQuantity} suất thuộc gói áp dụng. Chưa đủ nhóm theo điều kiện voucher; hiện chưa giảm tiền.`}</p>}
    {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    {open && <FinanceDialog title="Quét QR voucher" close={() => setOpen(false)}><VoucherCamera onRead={onRead}/></FinanceDialog>}
  </div>;
}
