'use client';

import { useState, useEffect } from 'react';

export default function KindleReceiverPage() {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [customBackend, setCustomBackend] = useState<string>('');
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [isMounted, setIsMounted] = useState<boolean>(false);

  const DEFAULT_BACKEND = 'https://bookcase-api.onrender.com';

  useEffect(() => {
    setIsMounted(true);
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

  const getBackendUrl = () => {
    if (customBackend && customBackend.trim()) {
      return customBackend.trim().replace(/\/+$/, '');
    }

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('b')) {
        return decodeURIComponent(params.get('b')!).replace(/\/+$/, '');
      }

      const host = window.location.hostname;
      if (host === 'localhost' || host === '127.0.0.1') {
        return 'http://localhost:8000';
      }
      if (host && !host.includes('vercel.app')) {
        return `http://${host}:8000`;
      }
    }
    const envApi = process.env.NEXT_PUBLIC_API_URL;
    return (envApi || DEFAULT_BACKEND).replace(/\/+$/, '');
  };

  const currentBackend = getBackendUrl();
  const cleanPin = pin.trim();
  const directDownloadUrl = `${currentBackend}/api/kindle/download-by-pin/${cleanPin}`;

  const handleDownload = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (cleanPin.length !== 4) {
      setError('⚠️ Vui lòng nhập đúng 4 chữ số mã PIN (Ví dụ: 3662).');
      return;
    }

    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    const verifyUrl = `${currentBackend}/api/kindle/verify-pin/${cleanPin}`;

    try {
      // 1. Kiểm tra mã PIN với server
      const res = await fetch(verifyUrl, { method: 'GET' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || 'Mã PIN không đúng hoặc đã hết hạn (5 phút).');
        setLoading(false);
        return;
      }

      const data = await res.json().catch(() => ({}));
      const titleStr = data.title ? ` "${data.title}"` : '';
      setSuccessMsg(`🚀 Đang khởi tạo tải sách${titleStr}... Hãy nhấp nút bên dưới nếu file chưa tự động tải.`);

      // 2. Chuyển hướng trình duyệt để tải file
      window.location.href = directDownloadUrl;
    } catch (err: any) {
      // Direct fallback
      window.location.href = directDownloadUrl;
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

  const handleSaveBackend = (val: string) => {
    setCustomBackend(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('kindle_backend_url', val);
    }
  };

  if (!isMounted) {
    return (
      <div style={{ backgroundColor: '#FFFFFF', color: '#000000', fontFamily: 'sans-serif', minHeight: '100vh', padding: '20px', textAlign: 'center' }}>
        <h2>BookCase Receiver</h2>
        <p>Đang tải giao diện máy đọc sách...</p>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#FFFFFF', color: '#000000', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', minHeight: '100vh', padding: '20px' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto', textAlign: 'center', paddingTop: '10px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', borderBottom: '3px solid #000000', paddingBottom: '10px', marginBottom: '20px' }}>
          BookCase Receiver
        </h1>

        <p style={{ fontSize: '15px', marginBottom: '20px', lineHeight: '1.4' }}>
          Nhập <strong>mã PIN 4 số</strong> hiển thị trên máy tính/điện thoại để nhận sách trực tiếp:
        </p>

        <form
          onSubmit={handleDownload}
          action={cleanPin.length === 4 ? directDownloadUrl : '#'}
          method="GET"
          style={{ marginBottom: '15px' }}
        >
          <div style={{ marginBottom: '15px' }}>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={pin}
              onInput={(e: any) => handlePinChange(e.target.value)}
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
            <div style={{ color: '#7F1D1D', backgroundColor: '#FEF2F2', border: '2px solid #991B1B', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontWeight: 'bold', fontSize: '14px' }}>
              {error}
            </div>
          )}

          {successMsg && (
            <div style={{ color: '#065F46', backgroundColor: '#ECFDF5', border: '2px solid #047857', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontWeight: 'bold', fontSize: '14px' }}>
              {successMsg}
            </div>
          )}

          {/* Button TẢI SÁCH NGAY - Luôn bấm được 100%, có màu tương phản cao */}
          <button
            type="submit"
            onClick={handleDownload}
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
            {loading ? '⏳ ĐANG KHỞI TẠO...' : '📥 TẢI SÁCH NGAY'}
          </button>
        </form>

        {/* Nút Link tải file trực tiếp (Dự phòng cho máy đọc sách) */}
        {cleanPin.length === 4 && (
          <div style={{ marginTop: '10px', marginBottom: '20px' }}>
            <a
              href={directDownloadUrl}
              target="_self"
              download
              style={{
                display: 'inline-block',
                backgroundColor: '#15803D',
                color: '#FFFFFF',
                fontSize: '16px',
                fontWeight: 'bold',
                padding: '14px 24px',
                borderRadius: '8px',
                textDecoration: 'none',
                width: '85%',
                boxSizing: 'border-box',
                border: '2px solid #166534'
              }}
            >
              🚀 CLICK ĐỂ TẢI TRỰC TIẾP FILE SÁCH
            </a>
          </div>
        )}

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
                value={customBackend || currentBackend}
                onInput={(e: any) => handleSaveBackend(e.target.value)}
                onChange={(e) => handleSaveBackend(e.target.value)}
                placeholder="http://192.168.1.X:8000 hoặc https://bookcase-api.onrender.com"
                style={{
                  width: '100%',
                  padding: '8px',
                  fontSize: '13px',
                  border: '1px solid #9CA3AF',
                  borderRadius: '4px',
                  boxSizing: 'border-box',
                  marginBottom: '6px'
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
