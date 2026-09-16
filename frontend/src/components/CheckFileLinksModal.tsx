'use client';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link2, X, Check, RefreshCw, AlertTriangle, Search, Upload, FileText, Loader2 } from 'lucide-react';
import axios from 'axios';

interface UnlinkedBook {
  id: string;
  title: string;
  author?: string;
  cover_url?: string;
  reason?: string;
}

interface CheckFileLinksModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSearchOnline?: (query: string, bookId?: string) => void;
  onSuccess?: () => void;
}

export default function CheckFileLinksModal({
  isOpen,
  onClose,
  onOpenSearchOnline,
  onSuccess
}: CheckFileLinksModalProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [totalBooks, setTotalBooks] = useState<number>(0);
  const [healthyCount, setHealthyCount] = useState<number>(0);
  const [unlinkedBooks, setUnlinkedBooks] = useState<UnlinkedBook[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const getHeaders = () => {
    const token = localStorage.getItem('access_token') || localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const handleScan = async () => {
    setIsScanning(true);
    setStatusMsg(null);
    try {
      const res = await axios.get(`${API_URL}/api/admin/check-file-links`, {
        headers: getHeaders()
      });
      setTotalBooks(res.data.total_books || 0);
      setHealthyCount(res.data.healthy_count || 0);
      setUnlinkedBooks(res.data.unlinked_books || []);
    } catch (err: any) {
      console.error('Lỗi khi rà soát file sách:', err);
      setStatusMsg({ type: 'error', text: err.response?.data?.detail || 'Không thể quét danh sách file sách.' });
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      handleScan();
      setSelectedFiles([]);
      setStatusMsg(null);
    }
  }, [isOpen]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...files]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const files = Array.from(e.dataTransfer.files).filter(f => 
        f.name.endsWith('.epub') || f.name.endsWith('.pdf')
      );
      if (files.length > 0) {
        setSelectedFiles(prev => [...prev, ...files]);
      }
    }
  };

  const handleRepairSubmit = async () => {
    if (selectedFiles.length === 0) return;
    setIsRepairing(true);
    setStatusMsg(null);

    try {
      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append('files', file);
      });

      const res = await axios.post(`${API_URL}/api/admin/repair-file-links`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...getHeaders()
        }
      });

      setStatusMsg({ type: 'success', text: res.data.message || `Đã khôi phục thành công ${res.data.repaired_count} file sách!` });
      setSelectedFiles([]);
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('cached_books');
      }
      handleScan();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Lỗi khôi phục file sách:', err);
      setStatusMsg({ type: 'error', text: err.response?.data?.detail || 'Lỗi khi khôi phục và đính kèm file sách.' });
    } finally {
      setIsRepairing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
          onClick={onClose}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-[#1F1D20] text-[#F5ECDC] rounded-3xl max-w-2xl w-full border border-[#4D4845]/60 shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-6 md:p-8 pb-4 border-b border-[#4D4845]/40 flex justify-between items-start">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-[#D97706]/20 border border-[#D97706]/40 rounded-2xl text-[#F59E0B] flex-shrink-0 mt-0.5">
                <Link2 size={24} className="stroke-[2.5]" />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-black text-[#F5ECDC] leading-tight">
                  Kiểm Tra & Khắc Phục Liên Kết File Sách
                </h2>
                <p className="text-xs md:text-sm text-[#D7C9B2] mt-1">
                  Rà soát toàn bộ sách xem cuốn nào chưa có file hoặc bị mất liên kết tải về
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2.5 bg-[#2A272A] hover:bg-[#3A373A] text-[#D7C9B2] hover:text-[#F5ECDC] rounded-full transition-colors cursor-pointer border border-[#4D4845]/40 flex-shrink-0"
            >
              <X size={18} />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 md:p-8 flex-1 overflow-y-auto space-y-6">
            {statusMsg && (
              <div className={`p-4 rounded-2xl text-sm font-bold border flex items-center gap-3 ${
                statusMsg.type === 'success' 
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400' 
                  : 'bg-red-950/60 border-red-500/40 text-red-400'
              }`}>
                {statusMsg.type === 'success' ? <Check size={18} /> : <AlertTriangle size={18} />}
                <span>{statusMsg.text}</span>
              </div>
            )}

            {/* SCAN RESULTS BANNER */}
            {isScanning ? (
              <div className="p-6 bg-[#2A272A] border border-[#4D4845]/40 rounded-2xl flex flex-col items-center justify-center gap-3">
                <Loader2 size={28} className="animate-spin text-[#F59E0B]" />
                <span className="text-sm font-bold text-[#D7C9B2]">Đang kiểm tra dữ liệu file sách trên PostgreSQL...</span>
              </div>
            ) : unlinkedBooks.length === 0 ? (
              /* GREEN SAFE BANNER */
              <div className="p-5 bg-emerald-950/50 border border-emerald-500/40 rounded-2xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 text-emerald-400 font-bold text-sm leading-snug">
                  <div className="p-1.5 bg-emerald-500/20 rounded-full flex-shrink-0">
                    <Check size={18} className="text-emerald-400 stroke-[3]" />
                  </div>
                  <span>
                    Toàn bộ {totalBooks} cuốn sách đều đã được gắn file dữ liệu EPUB/PDF đầy đủ và sẵn sàng tải trên web.
                  </span>
                </div>
                <button
                  onClick={handleScan}
                  className="px-4 py-2 bg-[#2A272A] hover:bg-[#3A373A] text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw size={14} /> Quét lại
                </button>
              </div>
            ) : (
              /* YELLOW UNLINKED BANNER & UNLINKED LIST */
              <div className="p-5 bg-amber-950/40 border border-amber-500/40 rounded-2xl space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 text-amber-300 font-extrabold text-sm md:text-base">
                    <AlertTriangle size={20} className="text-amber-400 flex-shrink-0" />
                    <span>Phát hiện {unlinkedBooks.length} cuốn sách chưa có file / mất liên kết:</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {onOpenSearchOnline && (
                      <button
                        onClick={() => onOpenSearchOnline(unlinkedBooks[0]?.title || '', unlinkedBooks[0]?.id)}
                        className="px-3.5 py-2 bg-[#D97706] hover:bg-[#B45309] text-white font-bold rounded-xl text-xs transition-all whitespace-nowrap cursor-pointer shadow-md flex items-center gap-1.5"
                        style={{ color: '#FFFFFF' }}
                      >
                        <Search size={14} className="text-white" />
                        <span>Tìm sách online</span>
                      </button>
                    )}
                    <button
                      onClick={handleScan}
                      className="px-3.5 py-2 bg-[#2A272A] hover:bg-[#3A373A] text-amber-200 border border-amber-500/40 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5"
                    >
                      <RefreshCw size={14} /> Quét lại
                    </button>
                  </div>
                </div>

                {/* List of Unlinked Books */}
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {unlinkedBooks.map(book => (
                    <div
                      key={book.id}
                      className="flex items-center justify-between gap-3 p-3 bg-[#1F1D20]/90 hover:bg-[#1F1D20] rounded-xl border border-amber-500/25 transition-colors"
                    >
                      <div className="truncate flex-1 min-w-0">
                        <div className="text-xs md:text-sm font-bold text-[#F5ECDC] truncate">
                          • {book.title}
                        </div>
                        <div className="text-[11px] text-[#D7C9B2]/80 truncate mt-0.5 flex items-center gap-1.5">
                          {book.author && <span>{book.author} —</span>}
                          <span className="text-amber-400/90 font-medium">{book.reason || 'Chưa có file dữ liệu EPUB/PDF để tải'}</span>
                        </div>
                      </div>

                      {onOpenSearchOnline && (
                        <button
                          onClick={() => onOpenSearchOnline(book.title, book.id)}
                          className="px-3 py-1.5 bg-[#D97706] hover:bg-[#B45309] text-white font-bold rounded-lg text-xs transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 shrink-0 shadow-sm active:scale-95"
                          style={{ color: '#FFFFFF' }}
                          title={`Tìm và tải bù file online cho: ${book.title}`}
                        >
                          <Search size={12} className="text-white" />
                          <span>Tìm online</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-amber-500/10 rounded-xl text-xs text-amber-200/90 leading-relaxed border border-amber-500/20">
                  💡 <strong>Bấm "Tìm online"</strong> cạnh từng cuốn sách để tải trực tiếp từ Z-Library/LibGen, hoặc kéo thả file từ máy tính vào ô bên dưới. Hệ thống sẽ tự động ghép nối và lưu vĩnh viễn vào Database PostgreSQL.
                </div>
              </div>
            )}

            {/* DROP ZONE AREA */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[#4D4845] hover:border-[#D97706] bg-[#2A272A]/50 hover:bg-[#2A272A] rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group"
            >
              <input
                type="file"
                multiple
                accept=".epub,.pdf"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="p-3 bg-[#1F1D20] rounded-full text-[#D97706] border border-[#4D4845]/60 group-hover:scale-110 transition-transform">
                <Link2 size={32} />
              </div>
              <p className="text-sm font-black text-[#F5ECDC] mt-1">
                Kéo thả toàn bộ file sách (.epub, .pdf) vào đây
              </p>
              <p className="text-xs text-[#D7C9B2]">
                hoặc bấm vào để chọn cùng lúc nhiều file từ máy tính của bạn
              </p>
            </div>

            {/* SELECTED FILES LIST */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-[#D7C9B2]">
                  <span>File đã chọn để khôi phục ({selectedFiles.length})</span>
                  <button
                    onClick={() => setSelectedFiles([])}
                    className="text-red-400 hover:text-red-300"
                  >
                    Xóa tất cả
                  </button>
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {selectedFiles.map((file, idx) => (
                    <div
                      key={`${file.name}-${idx}`}
                      className="flex items-center justify-between p-2.5 bg-[#2A272A] rounded-xl border border-[#4D4845]/40 text-xs font-medium"
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <FileText size={14} className="text-[#D97706] shrink-0" />
                        <span className="truncate text-[#F5ECDC]">{file.name}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
                        }}
                        className="text-[#D7C9B2] hover:text-red-400 p-1"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer & High-Contrast Submit Button (RULE[user_global]) */}
          <div className="p-6 md:p-8 pt-4 border-t border-[#4D4845]/40 bg-[#1F1D20]">
            <button
              onClick={handleRepairSubmit}
              disabled={isRepairing || selectedFiles.length === 0}
              className={`w-full py-4 rounded-2xl font-black text-sm md:text-base flex items-center justify-center gap-2 transition-all shadow-xl cursor-pointer ${
                selectedFiles.length > 0 && !isRepairing
                  ? 'bg-[#F5ECDC] hover:bg-white text-[#1F1D20] active:scale-[0.99]'
                  : 'bg-[#2A272A] text-[#7B7369] border border-[#4D4845]/40 cursor-not-allowed opacity-70'
              }`}
              style={selectedFiles.length > 0 && !isRepairing ? { color: '#1F1D20' } : {}}
            >
              {isRepairing ? (
                <>
                  <Loader2 size={18} className="animate-spin text-[#1F1D20]" />
                  <span className="text-[#1F1D20] font-black">Đang gắn file và lưu vào PostgreSQL Database...</span>
                </>
              ) : (
                <span className={selectedFiles.length > 0 ? "text-[#1F1D20] font-black" : "text-[#7B7369]"}>
                  Khôi Phục & Gắn File Vào Database ({selectedFiles.length} file đã chọn)
                </span>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
