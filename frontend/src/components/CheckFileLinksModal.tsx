'use client';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link2, X, Check, RefreshCw, AlertTriangle, Search, Upload, FileText, Loader2, Edit3, BookOpen } from 'lucide-react';
import axios from 'axios';

export interface UnlinkedBook {
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
  onOpenEditBook?: (bookId: string) => void;
  initialBrokenBooks?: UnlinkedBook[];
  initialBrokenCount?: number | null;
  refreshKey?: number;
  onSuccess?: () => void;
}

export default function CheckFileLinksModal({
  isOpen,
  onClose,
  onOpenSearchOnline,
  onOpenEditBook,
  initialBrokenBooks = [],
  initialBrokenCount = null,
  refreshKey,
  onSuccess
}: CheckFileLinksModalProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [uploadingBookId, setUploadingBookId] = useState<string | null>(null);
  const [totalBooks, setTotalBooks] = useState<number>(0);
  const [healthyCount, setHealthyCount] = useState<number>(0);
  const [unlinkedBooks, setUnlinkedBooks] = useState<UnlinkedBook[]>(initialBrokenBooks);
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
      // Ưu tiên gọi /api/admin/books/check-files để đảm bảo đồng nhất 100% với badge đếm
      const res = await axios.get(`${API_URL}/api/admin/books/check-files`, {
        headers: getHeaders()
      });
      const list: UnlinkedBook[] = res.data.broken_books || res.data.unlinked_books || [];
      const broken = res.data.broken_count ?? res.data.unlinked_count ?? list.length;
      const total = res.data.total_books || 0;
      setTotalBooks(total);
      setHealthyCount(res.data.healthy_count ?? Math.max(0, total - broken));
      setUnlinkedBooks(list);
    } catch (err: any) {
      console.error('Lỗi khi rà soát file sách:', err);
      // Fallback thử endpoint check-file-links nếu có
      try {
        const fallbackRes = await axios.get(`${API_URL}/api/admin/check-file-links`, {
          headers: getHeaders()
        });
        const list: UnlinkedBook[] = fallbackRes.data.broken_books || fallbackRes.data.unlinked_books || [];
        const broken = fallbackRes.data.broken_count ?? fallbackRes.data.unlinked_count ?? list.length;
        const total = fallbackRes.data.total_books || 0;
        setTotalBooks(total);
        setHealthyCount(fallbackRes.data.healthy_count ?? Math.max(0, total - broken));
        setUnlinkedBooks(list);
      } catch (fallbackErr: any) {
        setStatusMsg({ type: 'error', text: err.response?.data?.detail || 'Không thể quét danh sách file sách.' });
      }
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (initialBrokenBooks && initialBrokenBooks.length > 0) {
        setUnlinkedBooks(initialBrokenBooks);
      }
      handleScan();
      setSelectedFiles([]);
      setStatusMsg(null);
    }
  }, [isOpen, refreshKey]);

  useEffect(() => {
    if (initialBrokenBooks) {
      setUnlinkedBooks(initialBrokenBooks);
    }
  }, [initialBrokenBooks]);

  useEffect(() => {
    const onBooksUpdated = () => {
      if (isOpen) {
        handleScan();
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('bookcase:books-updated', onBooksUpdated);
      return () => window.removeEventListener('bookcase:books-updated', onBooksUpdated);
    }
  }, [isOpen]);

  // Upload file trực tiếp cho riêng 1 cuốn sách bị lỗi
  const handleUploadForBook = async (bookId: string, file: File) => {
    setUploadingBookId(bookId);
    setStatusMsg(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await axios.post(`${API_URL}/api/admin/books/${bookId}/upload-file`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...getHeaders()
        }
      });

      setStatusMsg({
        type: 'success',
        text: res.data.message || 'Đã nạp file thành công và lưu vĩnh viễn vào Database!'
      });

      // Loại bỏ cuốn sách vừa sửa khỏi danh sách chưa có file
      setUnlinkedBooks(prev => prev.filter(b => b.id !== bookId));
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.removeItem('cached_books');
        } catch (e) {}
        window.dispatchEvent(new CustomEvent('bookcase:books-updated', { detail: { bookId } }));
      }
      if (onSuccess) onSuccess();
      handleScan();
    } catch (err: any) {
      console.error('Lỗi khi nạp file cho sách:', err);
      setStatusMsg({
        type: 'error',
        text: err.response?.data?.detail || 'Không thể nạp file cho cuốn sách này.'
      });
    } finally {
      setUploadingBookId(null);
    }
  };

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
        try {
          sessionStorage.removeItem('cached_books');
        } catch (e) {}
        window.dispatchEvent(new CustomEvent('bookcase:books-updated'));
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
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-[#FBF8F4] text-[#2A2320] rounded-[36px] max-w-3xl w-full border border-[#ECE2D5] shadow-2xl overflow-hidden z-10 flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="p-6 md:p-8 pb-4 border-b border-[#EFE8DE] flex justify-between items-start">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-[#FAF6F0] border border-[#ECE2D5] rounded-2xl text-[#5F65B9] flex-shrink-0 mt-0.5 shadow-sm">
                <Link2 size={22} className="stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl md:text-2xl font-black text-[#2A2320] leading-tight">
                    Kiểm Tra & Khắc Phục File Sách
                  </h2>
                  {unlinkedBooks.length > 0 && (
                    <span className="px-3 py-0.5 bg-[#FAF0F0] border border-red-200 text-red-600 text-xs font-black rounded-full">
                      {unlinkedBooks.length} cuốn chưa thể tải
                    </span>
                  )}
                </div>
                <p className="text-xs md:text-sm text-[#7A6F68] mt-1 font-medium">
                  Rà soát toàn bộ sách trong hệ thống để tìm các cuốn chưa thể tải về trực tiếp từ web và tiến hành khắc phục
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2.5 bg-[#FAF6F0] hover:bg-[#EFE8DE] text-[#7A6F68] hover:text-[#2A2320] rounded-full transition-colors cursor-pointer border border-[#ECE2D5] flex-shrink-0 shadow-sm"
            >
              <X size={18} />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 md:p-8 flex-1 overflow-y-auto space-y-6">
            {statusMsg && (
              <div className="p-4 rounded-2xl text-sm font-bold border border-emerald-200 bg-emerald-50 text-emerald-700 flex items-center gap-3">
                {statusMsg.type === 'success' ? <Check size={18} className="text-emerald-700 flex-shrink-0" /> : <AlertTriangle size={18} className="text-red-500 flex-shrink-0" />}
                <span>{statusMsg.text}</span>
              </div>
            )}

            {/* SCAN RESULTS BANNER */}
            {isScanning ? (
              <div className="p-6 bg-[#FAF6F0] border border-[#ECE2D5] rounded-2xl flex flex-col items-center justify-center gap-3">
                <Loader2 size={26} className="animate-spin text-[#5F65B9]" />
                <span className="text-xs font-bold text-[#7A6F68]">Đang kiểm tra dữ liệu file tải về trên máy chủ & PostgreSQL...</span>
              </div>
            ) : unlinkedBooks.length === 0 ? (
              /* SAFE BANNER */
              <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 text-emerald-800 font-bold text-sm leading-snug">
                  <div className="p-1.5 bg-emerald-100 border border-emerald-300 rounded-full flex-shrink-0">
                    <Check size={16} className="text-emerald-700 stroke-[3]" />
                  </div>
                  <span>
                    Toàn bộ {totalBooks || 'tất cả'} cuốn sách đều đã có file dữ liệu EPUB/PDF đầy đủ và sẵn sàng tải về trực tiếp từ web.
                  </span>
                </div>
                <button
                  onClick={handleScan}
                  className="px-4 py-2 bg-white hover:bg-[#FAF6F0] text-[#2A2320] border border-emerald-200 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  <RefreshCw size={14} /> Quét lại
                </button>
              </div>
            ) : (
              /* UNLINKED BANNER & UNLINKED LIST */
              <div className="p-5 bg-[#FAF6F0] border border-[#ECE2D5] rounded-2xl space-y-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2.5 text-[#2A2320] font-black text-sm md:text-base">
                    <AlertTriangle size={18} className="text-[#C06060] flex-shrink-0" />
                    <span>Có {unlinkedBooks.length} cuốn sách chưa thể tải về trực tiếp từ web:</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleScan}
                      disabled={isScanning}
                      className="px-3.5 py-1.5 bg-white hover:bg-[#FAF6F0] text-[#2A2320] border border-[#E5DACD] rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 shadow-sm"
                    >
                      <RefreshCw size={14} className={isScanning ? "animate-spin" : ""} /> Quét lại
                    </button>
                  </div>
                </div>

                {/* List of Unlinked Books with Actions */}
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {unlinkedBooks.map(book => {
                    const isUploadingThis = uploadingBookId === book.id;
                    const coverSrc = book.cover_url 
                      ? (book.cover_url.startsWith('http') ? book.cover_url : `${API_URL}${book.cover_url}`)
                      : null;

                    return (
                      <div
                        key={book.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white hover:bg-[#FAF6F0] rounded-2xl border border-[#ECE2D5] transition-colors shadow-sm"
                      >
                        {/* Book Info */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {coverSrc ? (
                            <img 
                              src={coverSrc} 
                              alt={book.title} 
                              className="w-10 h-14 rounded-lg object-cover flex-shrink-0 border border-[#ECE2D5] bg-[#FAF6F0] shadow-sm"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-10 h-14 rounded-lg bg-[#FAF6F0] border border-[#ECE2D5] flex items-center justify-center text-[#A0958C] flex-shrink-0 shadow-sm">
                              <BookOpen size={16} />
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="text-xs md:text-sm font-bold text-[#2A2320] truncate" title={book.title}>
                              {book.title}
                            </div>
                            <div className="text-[11px] text-[#7A6F68] truncate mt-0.5">
                              {book.author ? `${book.author}` : 'Tác giả: Chưa rõ'}
                            </div>
                            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                              <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded-full text-[10px] font-bold border border-red-200">
                                Chưa thể tải
                              </span>
                              <span className="text-[11px] text-[#A0958C] font-medium">
                                {book.reason || 'File chưa có trên server hoặc database'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons for this book */}
                        <div className="flex items-center gap-1.5 flex-shrink-0 self-end sm:self-center">
                          {/* Button 1: Tìm Online */}
                          {onOpenSearchOnline && (
                            <button
                              onClick={() => onOpenSearchOnline(book.title, book.id)}
                              className="btn-gradient text-white px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95 border-none"
                              title={`Tìm online để bù file cho cuốn '${book.title}'`}
                            >
                              <Search size={12} className="text-white" />
                              <span>Tìm online</span>
                            </button>
                          )}

                          {/* Button 2: Tải File Lên Trực Tiếp Cho Cuốn Này */}
                          <label
                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer border ${
                              isUploadingThis
                                ? 'bg-[#EFE8DE] text-[#2A2320] border-[#E5DACD] cursor-wait'
                                : 'bg-[#FAF6F0] hover:bg-[#EFE8DE] text-[#2A2320] border border-[#E5DACD]'
                            }`}
                            title={`Tải file .epub hoặc .pdf từ máy tính để gắn thẳng vào cuốn '${book.title}'`}
                          >
                            {isUploadingThis ? (
                              <>
                                <Loader2 size={12} className="animate-spin text-[#2A2320]" />
                                <span>Đang lưu...</span>
                              </>
                            ) : (
                              <>
                                <Upload size={12} className="text-[#7A6F68]" />
                                <span>Tải file</span>
                              </>
                            )}
                            <input
                              type="file"
                              accept=".epub,.pdf"
                              disabled={isUploadingThis}
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handleUploadForBook(book.id, file);
                                }
                              }}
                            />
                          </label>

                          {/* Button 3: Chỉnh sửa thông tin / link */}
                          {onOpenEditBook && (
                            <button
                              onClick={() => onOpenEditBook(book.id)}
                              className="p-1.5 bg-[#FAF6F0] hover:bg-[#EFE8DE] text-[#7A6F68] hover:text-[#2A2320] rounded-full text-xs transition-all border border-[#E5DACD] cursor-pointer"
                              title="Chỉnh sửa thông tin sách hoặc dán link Google Drive/ngoài"
                            >
                              <Edit3 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="p-3.5 bg-white rounded-2xl text-xs text-[#7A6F68] leading-relaxed border border-[#ECE2D5]">
                  <strong className="text-[#2A2320]">Hướng dẫn:</strong> Bấm <strong className="text-[#2A2320]">"Tìm online"</strong> để tìm và gắn file trực tuyến, hoặc bấm <strong className="text-[#2A2320]">"Tải file"</strong> để chọn file từ máy tính cho từng cuốn. Bạn cũng có thể kéo thả hàng loạt file vào ô bên dưới để hệ thống tự động đối chiếu theo tên.
                </div>
              </div>
            )}

            {/* DROP ZONE AREA FOR BATCH REPAIR */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[#D8C9BB] hover:border-[#5F65B9] bg-[#FAF6F0] hover:bg-[#FAF0E6] rounded-3xl p-6 md:p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group"
            >
              <input
                type="file"
                multiple
                accept=".epub,.pdf"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="p-3 bg-white rounded-full text-[#5F65B9] border border-[#ECE2D5] shadow-sm transition-all">
                <Link2 size={24} />
              </div>
              <p className="text-sm font-black text-[#2A2320] mt-1">
                Kéo thả file sách (.epub, .pdf) vào đây để khôi phục hàng loạt
              </p>
              <p className="text-xs text-[#7A6F68]">
                Hệ thống sẽ tự động ghép nối theo tên sách và lưu vĩnh viễn vào Database
              </p>
            </div>

            {/* SELECTED FILES LIST FOR BATCH REPAIR */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-[#7A6F68]">
                  <span>File đã chọn để khôi phục ({selectedFiles.length})</span>
                  <button
                    onClick={() => setSelectedFiles([])}
                    className="text-[#7A6F68] hover:text-[#2A2320] cursor-pointer"
                  >
                    Xóa tất cả
                  </button>
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {selectedFiles.map((file, idx) => (
                    <div
                      key={`${file.name}-${idx}`}
                      className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-[#ECE2D5] text-xs font-medium"
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <FileText size={14} className="text-[#5F65B9] shrink-0" />
                        <span className="truncate text-[#2A2320] font-semibold">{file.name}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
                        }}
                        className="text-[#A0958C] hover:text-[#2A2320] p-1 cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer & High-Contrast Submit Button */}
          <div className="p-6 md:p-8 pt-4 border-t border-[#EFE8DE] bg-[#FBF8F4]">
            <button
              onClick={handleRepairSubmit}
              disabled={isRepairing || selectedFiles.length === 0}
              className={`w-full py-3.5 md:py-4 rounded-full font-black text-xs md:text-sm flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer border-none ${
                selectedFiles.length > 0 && !isRepairing
                  ? 'btn-gradient text-white hover:opacity-95 active:scale-[0.99]'
                  : 'bg-[#EFE8DE] text-[#A0958C] cursor-not-allowed opacity-60'
              }`}
            >
              {isRepairing ? (
                <>
                  <Loader2 size={18} className="animate-spin text-white" />
                  <span className="text-white font-black">Đang gắn file và lưu vào Database...</span>
                </>
              ) : (
                <span className="font-black">
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
