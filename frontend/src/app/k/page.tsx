'use client';

import { useState } from 'react';

export default function KindleReceiverPage() {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const getBackendUrl = () => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('b')) {
        return decodeURIComponent(params.get('b')!);
      }

      const host = window.location.hostname;
      if (host && host !== 'localhost' && host !== '127.0.0.1' && !host.includes('vercel.app')) {
        return `http://${host}:8000`;
      }
    }
    return API_URL;
  };

  const handleDownload = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPin = pin.trim();
    if (cleanPin.length !== 4) {
      setError('Vui lòng nhập đúng 4 chữ số mã PIN.');
      return;
    }

    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    const targetBackend = getBackendUrl();
    const verifyUrl = `${targetBackend}/api/kindle/verify-pin/${cleanPin}`;
    const downloadUrl = `${targetBackend}/api/kindle/download-by-pin/${cleanPin}`;

    try {
      // 1. Kiểm tra xem mã PIN có hợp lệ hay không trước khi chuyển hướng
      const res = await fetch(verifyUrl, { method: 'GET' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || 'Mã PIN không đúng hoặc đã hết hạn (5 phút).');
        setLoading(false);
        return;
      }

      const data = await res.json().catch(() => ({}));
      const titleStr = data.title ? ` "${data.title}"` : '';
      setSuccessMsg(`🚀 Đang khởi tạo tải sách${titleStr}... Kindle sẽ tự động bắt đầu tải về.`);

      // 2. Chuyển hướng trực tiếp URL để trình duyệt Kindle kích hoạt trình tải file hệ thống (Content-Disposition)
      window.location.href = downloadUrl;
    } catch (err: any) {
      // Fallback nếu fetch verify bị chặn
      window.location.href = downloadUrl;
    } finally {
      setLoading(false);
    }
  };

  const handlePinChange = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 4);
    setPin(digits);
    setError(null);
    setSuccessMsg(null);
  };

  return (
    <div style={{ backgroundColor: '#FFFFFF', color: '#000000', fontFamily: 'sans-serif', minHeight: '100vh', padding: '20px' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto', textAlign: 'center', paddingTop: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', borderBottom: '3px solid #000000', paddingBottom: '10px', marginBottom: '20px' }}>
          BookCase Kindle Receiver
        </h1>

        <p style={{ fontSize: '15px', marginBottom: '20px', lineHeight: '1.4' }}>
          Nhập <strong>mã PIN 4 số</strong> hiển thị trên máy tính/điện thoại để nhận sách trực tiếp:
        </p>

        <form onSubmit={handleDownload} style={{ marginBottom: '20px' }}>
          <div style={{ marginBottom: '15px' }}>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={pin}
              onChange={(e) => handlePinChange(e.target.value)}
              placeholder="0 0 0 0"
              style={{
                fontSize: '36px',
                textAlign: 'center',
                letterSpacing: '8px',
                fontWeight: 'bold',
                width: '80%',
                padding: '12px',
                border: '3px solid #000000',
                borderRadius: '8px',
                backgroundColor: '#FFFFFF',
                color: '#000000'
              }}
              autoFocus
            />
          </div>

          {error && (
            <div style={{ color: '#000000', backgroundColor: '#F0F0F0', border: '2px solid #000000', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontWeight: 'bold', fontSize: '14px' }}>
              ⚠️ {error}
            </div>
          )}

          {successMsg && (
            <div style={{ color: '#000000', backgroundColor: '#E6F4EA', border: '2px solid #000000', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontWeight: 'bold', fontSize: '14px' }}>
              {successMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || pin.length !== 4}
            style={{
              backgroundColor: loading || pin.length !== 4 ? '#888888' : '#000000',
              color: '#FFFFFF',
              fontSize: '18px',
              fontWeight: 'bold',
              padding: '14px 28px',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              width: '85%'
            }}
          >
            {loading ? 'Đang gửi file sang Kindle...' : '📥 TẢI SÁCH NGAY'}
          </button>
        </form>

        <div style={{ marginTop: '30px', borderTop: '1px solid #CCCCCC', paddingTop: '15px', fontSize: '13px', color: '#444444' }}>
          💡 <strong>Mẹo:</strong> Bấm nút Menu (⋮) trên trình duyệt và chọn <strong>Add Bookmark (Lưu Dấu Trang)</strong> để lần sau mở nhanh!
        </div>
      </div>
    </div>
  );
}
