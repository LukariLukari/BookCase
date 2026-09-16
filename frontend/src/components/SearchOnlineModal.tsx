'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Download, Loader2, BookOpen, Pencil, PenTool, Layers } from 'lucide-react';
import axios from 'axios';

interface ExternalSearchItem {
  id: string;
  title: string;
  author: string | null;
  extension: string | null;
  size: string | null;
  language: string | null;
}

interface SearchOnlineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
  initialQuery?: string;
  targetBookId?: string | null;
}

export default function SearchOnlineModal({ isOpen, onClose, onImportSuccess, initialQuery, targetBookId }: SearchOnlineModalProps) {
  const [query, setQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState<'all' | 'zlib' | 'cloudily'>('all');
  const [results, setResults] = useState<ExternalSearchItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const handleSearchWithQuery = async (searchQuery: string, source: string = selectedSource) => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setError(null);
    setResults([]);

    try {
      const url = `${API_URL}/api/external-search?q=${encodeURIComponent(searchQuery.trim())}&source=${source}`;
      const res = await axios.get(url);
      setResults(res.data || []);
      if (!res.data || res.data.length === 0) {
        setError('Không tìm thấy sách nào từ nguồn này. Hãy thử đổi từ khóa hoặc chọn máy chủ khác.');
      }
    } catch (err: any) {
      if (err.response && err.response.status === 504) {
        setError(err.response.data.detail || 'Không thể kết nối đến máy chủ tìm kiếm sách.');
      } else {
        setError(err.response?.data?.detail || 'Đã xảy ra lỗi khi tìm kiếm. Vui lòng thử lại với từ khóa khác.');
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    handleSearchWithQuery(query, selectedSource);
  };

  const handleSourceChange = (src: 'all' | 'zlib' | 'cloudily') => {
    setSelectedSource(src);
    if (query.trim()) {
      handleSearchWithQuery(query, src);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (initialQuery) {
        setQuery(initialQuery);
        handleSearchWithQuery(initialQuery, 'all');
      } else {
        setQuery('');
        setResults([]);
        setError(null);
      }
    }
  }, [isOpen, initialQuery]);

  const handleImport = async (item: ExternalSearchItem) => {
    setImportingId(item.id);
    setImportProgress(10);
    setError(null);

    const interval = setInterval(() => {
      setImportProgress((prev) => {
        if (prev < 90) {
          const step = Math.floor(Math.random() * 8) + 4;
          return Math.min(prev + step, 92);
        }
        return prev;
      });
    }, 350);

    try {
      const token = localStorage.getItem('access_token') || localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const cleanTitle = item.title.replace(/^\[.*?\]\s*/, '');
      const res = await axios.post(`${API_URL}/api/external-import`, {
        id: item.id,
        title: cleanTitle,
        author: item.author,
        target_book_id: targetBookId || undefined
      }, { headers });
      
      clearInterval(interval);
      setImportProgress(100);

      const newBook = res.data;
      if (newBook && newBook.status === 'manual_download' && newBook.external_url) {
        window.open(newBook.external_url, '_blank');
        setError('File cần mở tải trực tiếp trên trình duyệt. Đã mở tab liên kết tải cho bạn. Sau khi tải về, bạn có thể tải file lên hệ thống.');
      } else if (newBook && newBook.id && !targetBookId) {
        const downloadUrl = `${API_URL}/api/books/${newBook.id}/download`;
        window.location.href = downloadUrl;
      }
      
      setTimeout(() => {
        setImportingId(null);
        setImportProgress(0);
        if (!(newBook && newBook.status === 'manual_download')) {
          if (typeof window !== 'undefined') {
            try {
              sessionStorage.removeItem('cached_books');
            } catch (e) {}
            window.dispatchEvent(new CustomEvent('bookcase:books-updated', { detail: { bookId: newBook.id } }));
          }
          onImportSuccess();
          onClose();
        }
      }, 800);
    } catch (err: any) {
      clearInterval(interval);
      if (err.response?.status === 401) {
        setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      } else {
        setError(err.response?.data?.detail || 'Lỗi khi tải sách về máy chủ.');
      }
      setImportingId(null);
      setImportProgress(0);
    }
  };

  const handleModalClose = () => {
    setImportingId(null);
    setImportProgress(0);
    onClose();
  };

  const getSourceBadge = (id: string, title: string) => {
    if (id.startsWith('cloudily|')) {
      return { label: 'Server bút mực', icon: PenTool };
    }
    if (id.startsWith('/book_') || id.startsWith('zlib|')) {
      return { label: 'Server bút chì', icon: Pencil };
    }
    return { label: 'Server sách', icon: BookOpen };
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={handleModalClose}
        />
        
        <motion.div 
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          className="relative bg-[#FBF8F4] text-[#2A2320] rounded-[36px] max-w-2xl w-full border border-[#ECE2D5] shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
        >
          {/* Header */}
          <div className="p-6 border-b border-[#EFE8DE] flex justify-between items-center bg-[#FAF6F0]">
            <div>
              <h2 className="text-xl font-bold text-[#2A2320] flex items-center gap-2">
                <BookOpen className="text-[#5F65B9]" size={20} />
                Tìm & Tải Sách Online
              </h2>
              {targetBookId && (
                <p className="text-xs text-[#7A6F68] font-semibold mt-1">
                  Đang tìm kiếm file để gắn bù vào cuốn sách bị mất liên kết
                </p>
              )}
            </div>
            <button 
              onClick={handleModalClose}
              className="p-2.5 rounded-full transition-colors cursor-pointer border border-[#ECE2D5] bg-white hover:bg-[#EFE8DE] text-[#7A6F68] hover:text-[#2A2320]"
            >
              <X size={18} />
            </button>
          </div>

          {/* Search Bar & Source Tabs */}
          <div className="p-6 bg-[#FBF8F4] pb-3 space-y-3">
            <form onSubmit={handleSearch} className="flex gap-3">
              <input 
                type="text" 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nhập tên sách, tác giả..."
                className="flex-1 bg-[#FAF6F0] border border-[#E5DACD] rounded-full px-5 py-3 text-[#2A2320] placeholder-[#A0958C] focus:outline-none focus:border-[#5F65B9] text-xs font-medium"
                autoFocus
              />
              <button 
                type="submit"
                disabled={isSearching || !query.trim()}
                className="btn-gradient font-bold px-6 py-3 rounded-full flex items-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border-none text-white text-xs"
              >
                {isSearching ? (
                  <Loader2 size={16} className="animate-spin text-white" />
                ) : (
                  <Search size={16} className="text-white" />
                )}
                <span className="hidden sm:inline font-bold">Tìm kiếm</span>
              </button>
            </form>

            {/* Source Switcher */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              <button
                type="button"
                onClick={() => handleSourceChange('all')}
                className={`px-3.5 py-1.5 rounded-full font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 border shadow-sm ${
                  selectedSource === 'all'
                    ? 'bg-[#2A2320] text-white border-[#2A2320]'
                    : 'bg-[#FAF6F0] text-[#7A6F68] border-[#E5DACD] hover:bg-[#EFE8DE]'
                }`}
              >
                <Layers size={13} />
                <span>Tất cả nguồn</span>
              </button>

              <button
                type="button"
                onClick={() => handleSourceChange('zlib')}
                className={`px-3.5 py-1.5 rounded-full font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 border shadow-sm ${
                  selectedSource === 'zlib'
                    ? 'bg-[#2A2320] text-white border-[#2A2320]'
                    : 'bg-[#FAF6F0] text-[#7A6F68] border-[#E5DACD] hover:bg-[#EFE8DE]'
                }`}
              >
                <Pencil size={13} />
                <span>Server bút chì</span>
              </button>

              <button
                type="button"
                onClick={() => handleSourceChange('cloudily')}
                className={`px-3.5 py-1.5 rounded-full font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 border shadow-sm ${
                  selectedSource === 'cloudily'
                    ? 'bg-[#2A2320] text-white border-[#2A2320]'
                    : 'bg-[#FAF6F0] text-[#7A6F68] border-[#E5DACD] hover:bg-[#EFE8DE]'
                }`}
              >
                <PenTool size={13} />
                <span>Server bút mực</span>
              </button>
            </div>
          </div>

          {/* Results Area */}
          <div className="flex-1 overflow-y-auto p-6 pt-2">
            {error && (
              <div className="bg-[#FAF0F0] border border-red-200 text-red-600 p-3.5 rounded-2xl mb-3 text-xs text-center leading-relaxed font-semibold">
                {error}
              </div>
            )}

            {!isSearching && results.length === 0 && !error && query && (
              <div className="text-center text-[#A0958C] py-10 font-medium text-xs">
                Nhập từ khóa và bấm tìm kiếm
              </div>
            )}

            <div className="space-y-3">
              {results.map((item, idx) => {
                const badge = getSourceBadge(item.id, item.title);
                const BadgeIcon = badge.icon;
                const displayTitle = item.title.replace(/^\[.*?\]\s*/, '');

                return (
                  <div key={`${item.id}-${idx}`} className="bg-white border border-[#ECE2D5] rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between hover:border-[#5F65B9] transition-colors shadow-sm">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="border border-[#ECE2D5] bg-[#FAF6F0] text-[#7A6F68] text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                          <BadgeIcon size={11} className="text-[#5F65B9]" />
                          <span>{badge.label}</span>
                        </span>
                      </div>
                      <h3 className="text-[#2A2320] font-bold line-clamp-2 text-sm">{displayTitle}</h3>
                      <p className="text-[#7A6F68] text-xs mt-0.5 font-medium">{item.author || 'Không rõ tác giả'}</p>
                      <div className="flex gap-2 mt-2 text-[11px] text-[#A0958C] font-semibold">
                        {item.extension && <span className="bg-[#FAF6F0] border border-[#ECE2D5] px-2 py-0.5 rounded-md uppercase text-[#7A6F68]">{item.extension}</span>}
                        {item.size && <span className="bg-[#FAF6F0] border border-[#ECE2D5] px-2 py-0.5 rounded-md text-[#7A6F68]">{item.size}</span>}
                        {item.language && <span className="bg-[#FAF6F0] border border-[#ECE2D5] px-2 py-0.5 rounded-md text-[#7A6F68]">{item.language}</span>}
                      </div>
                    </div>
                    
                    {importingId === item.id ? (
                      <div className="w-full sm:w-60 flex flex-col gap-1.5 py-1">
                        <div className="flex justify-between items-center text-xs font-bold px-0.5">
                          <span className="flex items-center gap-1.5 text-[#2A2320]">
                            <Loader2 size={13} className="animate-spin text-[#5F65B9]" />
                            Đang xử lý & tải file...
                          </span>
                          <span className="text-[#2A2320] font-extrabold">{Math.round(importProgress)}%</span>
                        </div>
                        <div className="w-full bg-[#EFE8DE] rounded-full h-3 border border-[#E5DACD] overflow-hidden relative">
                          <motion.div 
                            className="btn-gradient h-full rounded-full transition-all duration-300 relative overflow-hidden"
                            style={{ width: `${importProgress}%` }}
                          >
                            <div className="absolute inset-0 bg-white/20 animate-pulse" />
                          </motion.div>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleImport(item)}
                        disabled={importingId !== null}
                        className="btn-gradient text-white w-full sm:w-auto px-5 py-2.5 rounded-full text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer border-none"
                      >
                        <Download size={14} className="text-white" />
                        <span>
                          {targetBookId ? 'Tải & Gắn Bù Vào Sách' : 'Tải về máy & Thêm vào web'}
                        </span>
                      </button>
                    )}

                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

