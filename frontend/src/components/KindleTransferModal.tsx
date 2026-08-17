'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Smartphone, Copy, Check, Clock, Wifi } from 'lucide-react';
import axios from 'axios';

interface KindleTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookId: string | null;
  bookTitle?: string;
}

export default function KindleTransferModal({ isOpen, onClose, bookId, bookTitle }: KindleTransferModalProps) {
  const [pin, setPin] = useState<string | null>(null);
  const [kindleUrl, setKindleUrl] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState<number>(300);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  useEffect(() => {
    if (isOpen && bookId) {
      generatePin();
    } else {
      setPin(null);
      setTimeLeft(300);
      setIsCopied(false);
    }
  }, [isOpen, bookId]);

  useEffect(() => {
    if (!pin || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [pin, timeLeft]);

  const generatePin = async () => {
    if (!bookId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await axios.post(`${API_URL}/api/kindle/generate-pin/${bookId}`);
      setPin(res.data.pin);
      setKindleUrl(res.data.kindle_url);
      setTimeLeft(res.data.expires_in || 300);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Không thể tạo mã PIN gửi Kindle.');
    } finally {
      setLoading(false);
    }
  };

  const copyUrl = () => {
    if (!kindleUrl) return;
    navigator.clipboard.writeText(kindleUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-[#1F1D20] border border-[#4D4845]/50 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl text-[#F5ECDC] z-10"
        >
          {/* Header */}
          <div className="flex justify-between items-center pb-4 border-b border-[#4D4845]/40 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#F5ECDC] rounded-xl text-black">
                <Smartphone size={20} className="text-black" />
              </div>
              <div>
                <h3 className="font-extrabold text-lg text-[#F5ECDC]">Gửi Sang Máy Đọc Sách</h3>
                <p className="text-xs text-[#D7C9B2] font-semibold flex items-center gap-1 mt-0.5">
                  <Wifi size={12} /> Cùng mạng Wi-Fi LAN
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-[#D7C9B2] hover:text-[#F5ECDC] bg-[#2A272A] rounded-full transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Book Title */}
          {bookTitle && (
            <div className="bg-[#2A272A] p-3.5 rounded-xl border border-[#4D4845]/40 mb-6 text-center">
              <span className="text-xs text-[#8A817C] font-bold block mb-0.5">Sách đang gửi:</span>
              <p className="font-extrabold text-sm text-[#F5ECDC] line-clamp-1">{bookTitle}</p>
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-[#D7C9B2] space-y-3">
              <div className="w-8 h-8 border-3 border-[#F5ECDC] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="font-bold text-sm">Đang tạo mã PIN kết nối...</p>
            </div>
          ) : error ? (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl text-center text-sm mb-4">
              {error}
            </div>
          ) : (
            <div className="space-y-6">
              {/* PIN Code Box */}
              <div className="bg-[#2A272A] border-2 border-[#F5ECDC]/30 rounded-2xl p-6 text-center shadow-inner">
                <span className="text-xs font-black uppercase text-[#D7C9B2] tracking-wider block mb-2">
                  MÃ PIN 4 SỐ CỦA BẠN
                </span>
                
                <div className="text-5xl font-black tracking-[12px] text-[#F5ECDC] my-2 font-mono drop-shadow-md">
                  {pin ? pin.split('').join(' ') : '----'}
                </div>

                <div className="flex items-center justify-center gap-1.5 text-xs text-[#8A817C] mt-3 font-semibold">
                  <Clock size={14} />
                  <span>Hết hạn sau: <strong className="text-[#F5ECDC] font-mono">{formatTime(timeLeft)}</strong></span>
                </div>
              </div>

              {/* Instructions */}
              <div className="space-y-3 text-xs leading-relaxed text-[#D7C9B2] bg-[#2A272A]/60 p-4 rounded-2xl border border-[#4D4845]/30">
                <p className="font-bold text-[#F5ECDC] flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-[#F5ECDC] text-black flex items-center justify-center font-black text-xs shrink-0">1</span>
                  Mở trình duyệt Kindle & nhập địa chỉ bên dưới:
                </p>

                <div className="flex items-center gap-2 bg-[#1F1D20] p-2.5 rounded-xl border border-[#4D4845]/50">
                  <code className="text-[#F5ECDC] font-mono text-xs font-bold flex-1 select-all break-all px-1">
                    {kindleUrl || `http://<IP_LAN>:8000/k`}
                  </code>
                  <button
                    onClick={copyUrl}
                    className="p-1.5 bg-[#4D4845] hover:bg-[#5c5653] text-[#F5ECDC] rounded-lg transition-colors cursor-pointer shrink-0"
                    title="Sao chép link"
                    style={{ backgroundColor: '#4D4845', color: '#F5ECDC' }}
                  >
                    {isCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} style={{ color: '#F5ECDC' }} />}
                  </button>
                </div>

                <p className="font-bold text-[#F5ECDC] flex items-center gap-1.5 pt-1">
                  <span className="w-5 h-5 rounded-full bg-[#F5ECDC] text-black flex items-center justify-center font-black text-xs shrink-0">2</span>
                  Nhập mã <span className="font-mono text-[#F5ECDC] font-black text-sm">{pin}</span> vào ô và bấm Tải sách ngay.
                </p>
              </div>

              {/* Action Button */}
              <button
                onClick={onClose}
                className="w-full py-3.5 px-6 rounded-xl font-black text-sm transition-all shadow-md cursor-pointer hover:bg-white"
                style={{ backgroundColor: '#F5ECDC', color: '#000000' }}
              >
                ĐÃ HIỂU - ĐÓN NHẬN SÁCH TÊN KINDLE
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
