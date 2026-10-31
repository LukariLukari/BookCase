'use client';

import { useEffect, useState } from 'react';
import { Bell, Download } from 'lucide-react';
import { useAuth } from '@/app/contexts/AuthContext';
import { todayKey, type Subscription } from '@/lib/subscriptions';
import { reminderLeadDays, subscriptionCalendar } from '@/lib/subscriptionReminders';
import { applicationServerKey, notificationWorker, pushRequest, pushScope, pushSupported, stopDevicePush } from '@/lib/webPushClient';

export default function SubscriptionReminders({ items, disabled }: { items: Subscription[]; disabled: boolean }) {
  const { token } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [daysBefore, setDaysBefore] = useState(3);
  const [publicKey, setPublicKey] = useState('');
  const [ready, setReady] = useState(false);
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    let stopped = false;
    const controller = new AbortController();
    async function restore() {
      setReady(false); setError(''); setEnabled(false); setPublicKey('');
      const support = pushSupported();
      setSupported(support);
      try {
        const config = await pushRequest<{ publicKey: string }>(token!, 'GET', undefined, controller.signal);
        if (stopped) return;
        setPublicKey(config.publicKey);
        if (!support) return;
        const registration = await navigator.serviceWorker.getRegistration(pushScope);
        const subscription = await registration?.pushManager.getSubscription();
        if (!subscription || Notification.permission !== 'granted') return;
        const status = await pushRequest<{ enabled: boolean; daysBefore: number }>(token!, 'POST', { action: 'status', endpoint: subscription.endpoint }, controller.signal);
        if (!stopped) { setEnabled(status.enabled); setDaysBefore(status.daysBefore); }
      } catch (cause) { if (!stopped) setError(cause instanceof Error ? cause.message : 'Chưa kiểm tra được Web Push.'); }
      finally { if (!stopped) setReady(true); }
    }
    void restore();
    return () => { stopped = true; controller.abort(); };
  }, [token, revision]);

  async function enable() {
    if (!token || !publicKey) return;
    setBusy(true); setError(''); setMessage('');
    try {
      // This must be the first async call, directly from the user's tap on iOS.
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Chưa được cấp quyền thông báo. Hãy bật quyền trong cài đặt trình duyệt/thiết bị.');
      const worker = await notificationWorker();
      let subscription = await worker.pushManager.getSubscription();
      const key = applicationServerKey(publicKey);
      const existingKey = subscription?.options.applicationServerKey;
      if (subscription && (!existingKey || String(new Uint8Array(existingKey)) !== String(key))) {
        await stopDevicePush(token);
        subscription = null;
      }
      subscription ??= await worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      await pushRequest(token, 'PUT', { subscription: subscription.toJSON(), daysBefore });
      setEnabled(true);
      setMessage('Đã bật Web Push trên thiết bị này. Bấm Gửi thử để kiểm tra đường gửi từ máy chủ.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể bật Web Push.'); }
    finally { setBusy(false); }
  }

  async function disable() {
    if (!token) return;
    setBusy(true); setError(''); setMessage('');
    try { await stopDevicePush(token); setEnabled(false); setMessage('Đã tắt Web Push trên thiết bị này.'); }
    catch { setEnabled(false); setError('Chưa xác nhận được việc xóa đăng ký trên máy chủ. Kiểm tra kết nối và tải lại trang.'); }
    finally { setBusy(false); }
  }

  async function changeDays(days: number) {
    if (!enabled) { setDaysBefore(days); return; }
    if (!token) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const registration = await navigator.serviceWorker.getRegistration(pushScope);
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription) { setEnabled(false); throw new Error('Thiết bị chưa đăng ký. Hãy bật lại Web Push.'); }
      await pushRequest(token, 'PUT', { subscription: subscription.toJSON(), daysBefore: days });
      setDaysBefore(days); setMessage('Đã lưu thời điểm nhắc trên máy chủ cho thiết bị này.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể lưu cài đặt.'); }
    finally { setBusy(false); }
  }

  async function testPush() {
    if (!token) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const registration = await navigator.serviceWorker.getRegistration(pushScope);
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription) { setEnabled(false); throw new Error('Hãy bật lại Web Push trước khi gửi thử.'); }
      await pushRequest(token, 'POST', { action: 'test', endpoint: subscription.endpoint });
      setMessage('Dịch vụ push đã nhận thông báo thử từ máy chủ. Nếu chưa thấy, kiểm tra quyền thông báo và chế độ Không làm phiền.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể gửi thử.'); }
    finally { setBusy(false); }
  }

  function downloadCalendar() {
    const calendar = subscriptionCalendar(items, todayKey(), daysBefore);
    const url = URL.createObjectURL(new Blob([calendar], { type: 'text/calendar;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'billy-nhac-huy-goi.ics';
    document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10000);
    setMessage('Đã tải lịch. Nhập tệp .ics vào ứng dụng lịch và kiểm tra cảnh báo.');
  }

  const upcomingCount = items.filter(item => item.status === 'active' && item.cancelDate >= todayKey()).length;
  return <section className="subscription-reminders" aria-label="Cài đặt thông báo nhắc hủy">
    <div><h2><Bell size={19} /> Thông báo nhắc hủy · Web Push</h2><p>Nhận bản tổng hợp hằng ngày kể cả khi đóng tab, từ số ngày nhắc trước đã chọn đến khi gói được xử lý. Bao gồm gói quá hạn. Lịch mặc định: 9 giờ sáng Việt Nam; giờ nhận có thể trễ.</p></div>
    <p role="status">{!ready ? 'Đang kiểm tra Web Push…' : enabled ? 'Đã bật trên thiết bị này.' : 'Chưa bật trên thiết bị này.'}</p>
    <div className="subscription-reminder-actions">
      <label>Thời điểm nhắc<select value={daysBefore} disabled={!ready || busy} onChange={event => void changeDays(Number(event.target.value))}>{reminderLeadDays.map(days => <option key={days} value={days}>{days ? `Nhắc trước ${days} ngày` : 'Đúng ngày hủy'}</option>)}</select></label>
      <button className="btn-push" type="button" disabled={!ready || busy || (!enabled && (!supported || !publicKey))} onClick={() => enabled ? void disable() : void enable()}><Bell size={17} />{busy ? 'Đang xử lý…' : enabled ? 'Tắt Web Push trên thiết bị' : 'Bật Web Push trên thiết bị'}</button>
      {enabled && <button className="ui-flat-control" type="button" disabled={busy} onClick={() => void testPush()}>Gửi thử</button>}
      <button className="btn-push" type="button" disabled={disabled || !upcomingCount} onClick={downloadCalendar}><Download size={17} /> Tải lịch nhắc ({upcomingCount} gói)</button>
      <button className="ui-flat-control" type="button" disabled={busy || !ready} onClick={() => setRevision(value => value + 1)}>Kiểm tra lại</button>
    </div>
    <p>iPhone/iPad: iOS 16.4 trở lên → thêm web vào Màn hình chính → mở từ biểu tượng Billy → bật Web Push. Mỗi điện thoại, máy tính hoặc trình duyệt cần bật riêng. Máy tính có thể cần trình duyệt chạy nền để nhận.</p>
    <p>Tắt Web Push chỉ áp dụng cho thiết bị này. Đăng xuất cũng hủy đăng ký trên thiết bị. Cần kết nối mạng và cho phép thông báo trong hệ điều hành.</p>
    <p>Tệp lịch .ics là lựa chọn bổ sung, hẹn lúc 9:00 (UTC+7). Lịch đã nhập không tự đồng bộ; khi thay đổi gói, xóa sự kiện cũ rồi nhập lại. Nhập lịch và bật Web Push cùng lúc có thể nhắc trùng.</p>
    {message && <p role="status">{message}</p>}{error && <p className="subscription-error" role="alert">{error}</p>}
  </section>;
}
