'use client';

import { useState } from 'react';

export default function KindleReceiverPage() {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const handleDownload = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPin = pin.trim();
    if (cleanPin.length !== 4) {
      setError('Vui lòng nhập đúng 4 chữ số mã PIN.');
      return;
    }

    setError(null);
    setLoading(true);

    // Tự động thay thế localhost bằng hostname thực tế để Kindle kết nối tới máy chủ backend LAN
    let backendUrl = API_URL;
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      if (host && host !== 'localhost' && host !== '127.0.0.1') {
        backendUrl = API_URL.replace('localhost', host).replace('127.0.0.1', host);
      }
    }

    const downloadUrl = `${backendUrl}/api/kindle/download-by-pin/${cleanPin}`;
    
    // Chuyển hướng trực tiếp để Kindle tự động nhận diện đòn tải file
    window.location.href = downloadUrl;

    setTimeout(() => {
      setLoading(false);
    }, 3000);
  };

  const handlePinChange = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 4);
    setPin(digits);
    setError(null);
  };

  return (
    <div style={{ backgroundColor: '#FFFFFF', color: '#000000', fontFamily: 'sans-serif', minHeight: '100vh', padding: '20px' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto', textAlign: 'center', paddingTop: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', borderBottom: '3px solid #000000', paddingBottom: '10px', marginBottom: '20px' }}>
          BookCase Kindle Receiver
        </h1>

        <p style={{ fontSize: '15px', marginBottom: '20px', lineHeight: '1.4' }}>
          Nhập <strong>mã PIN 4 số</strong> hiển thị trên máy tính/điện thoại để nhận sách trực tiếp qua Wi-Fi:
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
          💡 <strong>Mẹo:</strong> Hãy bấm nút Menu (⋮) trên Kindle và chọn <strong>Add Bookmark (Lưu Dấu Trang)</strong> trang web này để lần sau chỉ cần bấm vào là nhận sách ngay!
        </div>
      </div>
    </div>
  );
}
