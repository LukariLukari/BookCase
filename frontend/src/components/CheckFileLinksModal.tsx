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
  onSuccess?: () => void;
}

export default function CheckFileLinksModal({
  isOpen,
  onClose,
  onOpenSearchOnline,
  onOpenEditBook,
  initialBrokenBooks = [],
  initialBrokenCount = null,
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
        sessionStorage.removeItem('cached_books');
      }
      if (onSuccess) onSuccess();
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
          className="relative bg-[#1F1D20] text-[#F5ECDC] rounded-3xl max-w-3xl w-full border border-[#4D4845]/60 shadow-2xl overflow-hidden z-10 flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="p-6 md:p-8 pb-4 border-b border-[#4D4845]/40 flex justify-between items-start">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-[#2A272A] border border-[#4D4845] rounded-2xl text-[#F5ECDC] flex-shrink-0 mt-0.5">
                <Link2 size={22} className="stroke-[2.5] text-[#F5ECDC]" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl md:text-2xl font-black text-[#F5ECDC] leading-tight">
                    Kiểm Tra & Khắc Phục File Sách
                  </h2>
                  {unlinkedBooks.length > 0 && (
                    <span className="px-2.5 py-0.5 bg-[#363236] border border-[#4D4845] text-[#F5ECDC] text-xs font-black rounded-full">
                      {unlinkedBooks.length} cuốn chưa thể tải
                    </span>
                  )}
                </div>
                <p className="text-xs md:text-sm text-[#D7C9B2] mt-1">
                  Rà soát toàn bộ sách trong hệ thống để tìm các cuốn chưa thể tải về trực tiếp từ web và tiến hành khắc phục
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2.5 bg-[#2A272A] hover:bg-[#363236] text-[#D7C9B2] hover:text-[#F5ECDC] rounded-full transition-colors cursor-pointer border border-[#4D4845]/40 flex-shrink-0"
            >
              <X size={18} />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 md:p-8 flex-1 overflow-y-auto space-y-6">
            {statusMsg && (
              <div className="p-4 rounded-2xl text-sm font-bold border border-[#4D4845] bg-[#2A272A] text-[#F5ECDC] flex items-center gap-3">
                {statusMsg.type === 'success' ? <Check size={18} className="text-[#F5ECDC] flex-shrink-0" /> : <AlertTriangle size={18} className="text-[#D7C9B2] flex-shrink-0" />}
                <span>{statusMsg.text}</span>
              </div>
            )}

            {/* SCAN RESULTS BANNER */}
            {isScanning ? (
              <div className="p-6 bg-[#2A272A] border border-[#4D4845]/40 rounded-2xl flex flex-col items-center justify-center gap-3">
                <Loader2 size={26} className="animate-spin text-[#D7C9B2]" />
                <span className="text-sm font-bold text-[#D7C9B2]">Đang kiểm tra dữ liệu file tải về trên máy chủ & PostgreSQL...</span>
              </div>
            ) : unlinkedBooks.length === 0 ? (
              /* SAFE BANNER */
              <div className="p-5 bg-[#262326] border border-[#4D4845] rounded-2xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 text-[#F5ECDC] font-bold text-sm leading-snug">
                  <div className="p-1.5 bg-[#363236] border border-[#4D4845] rounded-full flex-shrink-0">
                    <Check size={16} className="text-[#F5ECDC] stroke-[3]" />
                  </div>
                  <span>
                    Toàn bộ {totalBooks || 'tất cả'} cuốn sách đều đã có file dữ liệu EPUB/PDF đầy đủ và sẵn sàng tải về trực tiếp từ web.
                  </span>
                </div>
                <button
                  onClick={handleScan}
                  className="px-4 py-2 bg-[#2A272A] hover:bg-[#363236] text-[#F5ECDC] border border-[#4D4845] rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw size={14} /> Quét lại
                </button>
              </div>
            ) : (
              /* UNLINKED BANNER & UNLINKED LIST */
              <div className="p-5 bg-[#262326] border border-[#4D4845] rounded-2xl space-y-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2.5 text-[#F5ECDC] font-black text-sm md:text-base">
                    <AlertTriangle size={18} className="text-[#D7C9B2] flex-shrink-0" />
                    <span>Có {unlinkedBooks.length} cuốn sách chưa thể tải về trực tiếp từ web:</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleScan}
                      disabled={isScanning}
                      className="px-3.5 py-1.5 bg-[#2A272A] hover:bg-[#363236] text-[#F5ECDC] border border-[#4D4845] rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5"
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
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-[#1F1D20] hover:bg-[#221F22] rounded-xl border border-[#4D4845] transition-colors"
                      >
                        {/* Book Info */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {coverSrc ? (
                            <img 
                              src={coverSrc} 
                              alt={book.title} 
                              className="w-10 h-14 rounded object-cover flex-shrink-0 border border-[#4D4845]/50 bg-[#2A272A]"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-10 h-14 rounded bg-[#2A272A] border border-[#4D4845]/50 flex items-center justify-center text-[#D7C9B2]/60 flex-shrink-0">
                              <BookOpen size={16} />
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="text-xs md:text-sm font-bold text-[#F5ECDC] truncate" title={book.title}>
                              {book.title}
                            </div>
                            <div className="text-[11px] text-[#D7C9B2]/80 truncate mt-0.5">
                              {book.author ? `${book.author}` : 'Tác giả: Chưa rõ'}
                            </div>
                            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                              <span className="px-2 py-0.5 bg-[#363236] text-[#D7C9B2] rounded text-[10px] font-bold border border-[#4D4845]">
                                Chưa thể tải
                              </span>
                              <span className="text-[11px] text-[#8A817C] font-medium">
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
                              style={{ backgroundColor: '#F5ECDC', color: '#181618' }}
                              className="px-3 py-1.5 rounded-lg text-xs font-black transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
                              title={`Tìm online để bù file cho cuốn '${book.title}'`}
                            >
                              <Search size={12} style={{ color: '#181618', stroke: '#181618' }} />
                              <span style={{ color: '#181618' }}>Tìm online</span>
                            </button>
                          )}

                          {/* Button 2: Tải File Lên Trực Tiếp Cho Cuốn Này */}
                          <label
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer border ${
                              isUploadingThis
                                ? 'bg-[#363236] text-[#F5ECDC] border-[#4D4845] cursor-wait'
                                : 'bg-[#2A272A] hover:bg-[#363236] text-[#D7C9B2] hover:text-[#F5ECDC] border border-[#4D4845] hover:border-[#D7C9B2]'
                            }`}
                            title={`Tải file .epub hoặc .pdf từ máy tính để gắn thẳng vào cuốn '${book.title}'`}
                          >
                            {isUploadingThis ? (
                              <>
                                <Loader2 size={12} className="animate-spin text-[#F5ECDC]" />
                                <span className="text-[#F5ECDC]">Đang lưu...</span>
                              </>
                            ) : (
                              <>
                                <Upload size={12} className="text-[#D7C9B2]" />
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
                              className="p-1.5 bg-[#2A272A] hover:bg-[#363236] text-[#D7C9B2] hover:text-[#F5ECDC] rounded-lg text-xs transition-all border border-[#4D4845] hover:border-[#D7C9B2] cursor-pointer"
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

                <div className="p-3.5 bg-[#2A272A] rounded-xl text-xs text-[#D7C9B2] leading-relaxed border border-[#4D4845]">
                  <strong className="text-[#F5ECDC]">Hướng dẫn:</strong> Bấm <strong className="text-[#F5ECDC]">"Tìm online"</strong> để tìm và gắn file trực tuyến, hoặc bấm <strong className="text-[#F5ECDC]">"Tải file"</strong> để chọn file từ máy tính cho từng cuốn. Bạn cũng có thể kéo thả hàng loạt file vào ô bên dưới để hệ thống tự động đối chiếu theo tên.
                </div>
              </div>
            )}

            {/* DROP ZONE AREA FOR BATCH REPAIR */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[#4D4845] hover:border-[#D7C9B2] bg-[#2A272A]/50 hover:bg-[#2A272A] rounded-2xl p-6 md:p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group"
            >
              <input
                type="file"
                multiple
                accept=".epub,.pdf"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="p-3 bg-[#1F1D20] rounded-full text-[#D7C9B2] border border-[#4D4845] group-hover:border-[#D7C9B2] group-hover:text-[#F5ECDC] transition-all">
                <Link2 size={24} />
              </div>
              <p className="text-sm font-black text-[#F5ECDC] mt-1">
                Kéo thả file sách (.epub, .pdf) vào đây để khôi phục hàng loạt
              </p>
              <p className="text-xs text-[#8A817C]">
                Hệ thống sẽ tự động ghép nối theo tên sách và lưu vĩnh viễn vào Database
              </p>
            </div>

            {/* SELECTED FILES LIST FOR BATCH REPAIR */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-[#D7C9B2]">
                  <span>File đã chọn để khôi phục ({selectedFiles.length})</span>
                  <button
                    onClick={() => setSelectedFiles([])}
                    className="text-[#D7C9B2] hover:text-[#F5ECDC] cursor-pointer"
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
                        <FileText size={14} className="text-[#D7C9B2] shrink-0" />
                        <span className="truncate text-[#F5ECDC]">{file.name}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
                        }}
                        className="text-[#D7C9B2] hover:text-[#F5ECDC] p-1 cursor-pointer"
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
          <div className="p-6 md:p-8 pt-4 border-t border-[#4D4845]/40 bg-[#1F1D20]">
            <button
              onClick={handleRepairSubmit}
              disabled={isRepairing || selectedFiles.length === 0}
              style={
                selectedFiles.length > 0 && !isRepairing
                  ? { backgroundColor: '#F5ECDC', color: '#181618', borderColor: '#F5ECDC' }
                  : { backgroundColor: '#2A272A', color: '#7B7369', borderColor: '#4D4845' }
              }
              className={`w-full py-3.5 md:py-4 rounded-2xl font-black text-sm md:text-base flex items-center justify-center gap-2 transition-all shadow-xl cursor-pointer border ${
                selectedFiles.length > 0 && !isRepairing
                  ? 'hover:bg-[#E8DCC8] active:scale-[0.99]'
                  : 'cursor-not-allowed opacity-60'
              }`}
            >
              {isRepairing ? (
                <>
                  <Loader2 size={18} className="animate-spin" style={{ color: '#181618', stroke: '#181618' }} />
                  <span style={{ color: '#181618' }} className="font-black">Đang gắn file và lưu vào Database...</span>
                </>
              ) : (
                <span style={{ color: selectedFiles.length > 0 ? '#181618' : '#7B7369' }} className="font-black">
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
