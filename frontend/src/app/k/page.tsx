'use client';

import { useState, useEffect } from 'react';

export default function KindleReceiverPage() {
  const [customBackend, setCustomBackend] = useState<string>('');
  const [showConfig, setShowConfig] = useState<boolean>(false);

  const DEFAULT_BACKEND = 'https://bookcase-api.onrender.com';
  const API_URL = process.env.NEXT_PUBLIC_API_URL || DEFAULT_BACKEND;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const bParam = params.get('b');
      if (bParam) {
        const decoded = decodeURIComponent(bParam).trim();
        setCustomBackend(decoded);
        localStorage.setItem('kindle_backend_url', decoded);
      } else {
        const saved = localStorage.getItem('kindle_backend_url');
        if (saved) {
          setCustomBackend(saved.trim());
        }
      }
    }
  }, []);

  const currentBackend = (customBackend && customBackend.trim() ? customBackend.trim() : API_URL).replace(/\/+$/, '');
  const formActionUrl = `${currentBackend}/api/kindle/download`;

  const handleSaveBackend = (val: string) => {
    setCustomBackend(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('kindle_backend_url', val);
    }
  };

  return (
    <div style={{ backgroundColor: '#FFFFFF', color: '#000000', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', minHeight: '100vh', padding: '20px' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto', textAlign: 'center', paddingTop: '10px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', borderBottom: '3px solid #000000', paddingBottom: '10px', marginBottom: '20px' }}>
          BookCase Receiver
        </h1>

        <p style={{ fontSize: '15px', marginBottom: '20px', lineHeight: '1.4' }}>
          Nhập <strong>mã PIN 4 số</strong> hiển thị trên máy tính/điện thoại để nhận sách trực tiếp:
        </p>

        {/* Form thuần HTML: submit GET trực tiếp đến backend, trình duyệt máy đọc sách sẽ điều hướng và tải file ngay mà không qua Javascript fetch */}
        <form
          action={formActionUrl}
          method="GET"
          style={{ marginBottom: '15px' }}
        >
          <div style={{ marginBottom: '15px' }}>
            <input
              type="text"
              name="pin"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              placeholder="0 0 0 0"
              required
              autoFocus
              autoComplete="off"
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
            />
          </div>

          {/* Button TẢI SÁCH NGAY - Luôn bấm được 100%, có màu tương phản cao */}
          <button
            type="submit"
            style={{
              backgroundColor: '#000000',
              color: '#FFFFFF',
              fontSize: '18px',
              fontWeight: 'bold',
              padding: '14px 28px',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              width: '85%',
              marginBottom: '12px'
            }}
          >
            📥 TẢI SÁCH NGAY
          </button>
        </form>

        {/* Cấu hình Server IP dành cho sự cố (High Contrast) */}
        <div style={{ marginTop: '25px', paddingTop: '15px', borderTop: '1px solid #E5E7EB' }}>
          <button
            type="button"
            onClick={() => setShowConfig(!showConfig)}
            style={{
              backgroundColor: '#E5E7EB',
              color: '#111827',
              fontSize: '13px',
              fontWeight: 'bold',
              padding: '8px 16px',
              border: '1px solid #9CA3AF',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            ⚙️ {showConfig ? 'Ẩn cấu hình Server IP' : 'Cấu hình Server IP (Dành cho sự cố)'}
          </button>

          {showConfig && (
            <div style={{ marginTop: '12px', backgroundColor: '#F9FAFB', padding: '12px', borderRadius: '8px', border: '1px solid #D1D5DB', textAlign: 'left' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px', color: '#374151' }}>
                Địa chỉ Backend Server API:
              </label>
              <input
                type="text"
                value={customBackend}
                onInput={(e: any) => handleSaveBackend(e.target.value)}
                onChange={(e) => handleSaveBackend(e.target.value)}
                placeholder="Ví dụ: http://192.168.1.X:8000"
                style={{
                  width: '100%',
                  padding: '8px',
                  fontSize: '13px',
                  border: '1px solid #9CA3AF',
                  borderRadius: '4px',
                  boxSizing: 'border-box',
                  marginBottom: '6px',
                  color: '#000000'
                }}
              />
              <span style={{ fontSize: '11px', color: '#6B7280' }}>
                Đang dùng: <strong>{currentBackend}</strong>
              </span>
            </div>
          )}
        </div>

        <div style={{ marginTop: '25px', fontSize: '13px', color: '#4B5563' }}>
          💡 <strong>Mẹo:</strong> Bấm nút Menu (⋮) trên trình duyệt và chọn <strong>Add Bookmark (Lưu Dấu Trang)</strong> để lần sau mở nhanh!
        </div>
      </div>
    </div>
  );
}
