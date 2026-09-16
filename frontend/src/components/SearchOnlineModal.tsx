'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Download, Loader2, BookOpen, Globe, Library, Sparkles } from 'lucide-react';
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
  const [selectedSource, setSelectedSource] = useState<'all' | 'cloudily' | 'zlib' | 'openlibrary'>('all');
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
        setError('Không tìm thấy sách nào từ nguồn này. Hãy thử chọn nguồn khác như "Tất cả" hoặc "Open Library".');
      }
    } catch (err: any) {
      if (err.response && err.response.status === 504) {
        setError(err.response.data.detail || 'Không thể kết nối đến máy chủ tìm kiếm sách (Có thể bị chặn).');
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

  const handleSourceChange = (src: 'all' | 'cloudily' | 'zlib' | 'openlibrary') => {
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
      } else if (newBook && newBook.id) {
        const downloadUrl = `${API_URL}/api/books/${newBook.id}/download`;
        window.location.href = downloadUrl;
      }
      
      setTimeout(() => {
        setImportingId(null);
        setImportProgress(0);
        if (!(newBook && newBook.status === 'manual_download')) {
          onImportSuccess();
          onClose();
        }
      }, 800);
    } catch (err: any) {
      clearInterval(interval);
      if (err.response?.status === 401) {
        setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng xuất ở menu bên trái và đăng nhập lại.');
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
      return { label: 'Cloudily (Tiếng Việt)', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
    }
    if (id.startsWith('/book_') || id.startsWith('zlib|')) {
      return { label: 'Z-Library Bot', color: 'bg-sky-500/20 text-sky-300 border-sky-500/40' };
    }
    if (id.startsWith('openlibrary|') || id.startsWith('ia|') || title.includes('[Open Library]')) {
      return { label: 'Open Library (Toàn cầu)', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' };
    }
    return { label: 'Online Bot', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={handleModalClose}
        />
        
        <motion.div 
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          className="relative bg-[#1F1D20] rounded-3xl max-w-2xl w-full border border-[#4D4845]/50 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
        >
          {/* Header */}
          <div className="p-6 border-b border-[#4D4845]/50 flex justify-between items-center bg-[#2A272A]">
            <div>
              <h2 className="text-xl font-bold text-[#F5ECDC] flex items-center gap-2">
                <BookOpen className="text-[#F5ECDC]" size={22} />
                Tìm & Tải Sách Online
              </h2>
              {targetBookId && (
                <p className="text-xs text-amber-300 font-semibold mt-1">
                  🎯 Đang tìm kiếm file để gắn bù vào cuốn sách bị mất liên kết
                </p>
              )}
            </div>
            <button 
              onClick={handleModalClose}
              className="p-2 bg-[#1F1D20] hover:bg-[#F5ECDC] hover:text-black text-[#F5ECDC] rounded-full transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Search Bar & Source Tabs */}
          <div className="p-6 bg-[#1F1D20] pb-3 space-y-3">
            <form onSubmit={handleSearch} className="flex gap-3">
              <input 
                type="text" 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nhập tên sách, tác giả..."
                className="flex-1 bg-[#2A272A] border border-[#4D4845] rounded-xl px-4 py-3 text-[#F5ECDC] focus:outline-none focus:border-[#F5ECDC]"
                autoFocus
              />
              <button 
                type="submit"
                disabled={isSearching || !query.trim()}
                className="font-black px-6 py-3 rounded-xl disabled:bg-[#3A373A] border disabled:border-[#4D4845]/50 flex items-center gap-2 transition-all shadow-md cursor-pointer disabled:cursor-not-allowed"
                style={{ 
                  backgroundColor: isSearching || !query.trim() ? '#3A373A' : '#F5ECDC',
                  color: isSearching || !query.trim() ? '#8A817C' : '#000000' 
                }}
              >
                {isSearching ? <Loader2 size={20} className="animate-spin" style={{ color: isSearching || !query.trim() ? '#8A817C' : '#000000' }} /> : <Search size={20} style={{ color: isSearching || !query.trim() ? '#8A817C' : '#000000' }} />}
                <span className="hidden sm:inline font-black" style={{ color: isSearching || !query.trim() ? '#8A817C' : '#000000' }}>Tìm kiếm</span>
              </button>
            </form>

            {/* Source Switcher */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <button
                type="button"
                onClick={() => handleSourceChange('all')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 border ${
                  selectedSource === 'all'
                    ? 'bg-[#F5ECDC] text-black border-[#F5ECDC]'
                    : 'bg-[#2A272A] text-[#D7C9B2] border-[#4D4845]/60 hover:border-[#D7C9B2]'
                }`}
              >
                <Sparkles size={13} />
                <span>Tất cả nguồn</span>
              </button>

              <button
                type="button"
                onClick={() => handleSourceChange('cloudily')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 border ${
                  selectedSource === 'cloudily'
                    ? 'bg-emerald-500 text-white border-emerald-500'
                    : 'bg-[#2A272A] text-[#D7C9B2] border-[#4D4845]/60 hover:border-[#D7C9B2]'
                }`}
              >
                <span>Cloudily (Sách TV)</span>
              </button>

              <button
                type="button"
                onClick={() => handleSourceChange('zlib')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 border ${
                  selectedSource === 'zlib'
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'bg-[#2A272A] text-[#D7C9B2] border-[#4D4845]/60 hover:border-[#D7C9B2]'
                }`}
              >
                <span>Z-Library</span>
              </button>

              <button
                type="button"
                onClick={() => handleSourceChange('openlibrary')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 border ${
                  selectedSource === 'openlibrary'
                    ? 'bg-purple-500 text-white border-purple-500'
                    : 'bg-[#2A272A] text-[#D7C9B2] border-[#4D4845]/60 hover:border-[#D7C9B2]'
                }`}
              >
                <Library size={13} />
                <span>Open Library (Toàn cầu)</span>
              </button>
            </div>
          </div>

          {/* Results Area */}
          <div className="flex-1 overflow-y-auto p-6 pt-2">
            {error && (
              <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 p-3.5 rounded-xl mb-3 text-xs md:text-sm text-center leading-relaxed">
                {error}
              </div>
            )}

            {!isSearching && results.length === 0 && !error && query && (
              <div className="text-center text-[#D7C9B2] py-10 opacity-60">
                Nhập từ khóa và bấm tìm kiếm
              </div>
            )}

            <div className="space-y-3">
              {results.map((item, idx) => {
                const badge = getSourceBadge(item.id, item.title);
                const displayTitle = item.title.replace(/^\[.*?\]\s*/, '');

                return (
                  <div key={`${item.id}-${idx}`} className="bg-[#2A272A] border border-[#4D4845]/50 rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between hover:border-[#F5ECDC]/60 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`border text-[10px] font-extrabold px-2.5 py-0.5 rounded-md flex items-center gap-1.5 ${badge.color}`}>
                          {badge.label}
                        </span>
                      </div>
                      <h3 className="text-[#F5ECDC] font-bold line-clamp-2">{displayTitle}</h3>
                      <p className="text-[#D7C9B2] text-sm mt-1">{item.author || 'Không rõ tác giả'}</p>
                      <div className="flex gap-2 mt-2 text-xs text-[#8A817C] font-semibold">
                        {item.extension && <span className="bg-[#1F1D20] px-2 py-1 rounded-md uppercase text-[#F5ECDC]">{item.extension}</span>}
                        {item.size && <span className="bg-[#1F1D20] px-2 py-1 rounded-md text-[#F5ECDC]">{item.size}</span>}
                        {item.language && <span className="bg-[#1F1D20] px-2 py-1 rounded-md text-[#F5ECDC]">{item.language}</span>}
                      </div>
                    </div>
                    
                    {importingId === item.id ? (
                      <div className="w-full sm:w-60 flex flex-col gap-1.5 py-1">
                        <div className="flex justify-between items-center text-xs font-bold px-0.5">
                          <span className="flex items-center gap-1.5 text-[#F5ECDC]">
                            <Loader2 size={13} className="animate-spin text-[#F5ECDC]" />
                            Đang xử lý & tải file...
                          </span>
                          <span className="text-[#F5ECDC] font-extrabold">{Math.round(importProgress)}%</span>
                        </div>
                        <div className="w-full bg-[#1F1D20] rounded-full h-3 shadow-inner overflow-hidden relative">
                          <motion.div 
                            className="bg-gradient-to-r from-[#D7C9B2] via-[#E6D9C5] to-[#F5ECDC] h-full rounded-full transition-all duration-300 relative overflow-hidden"
                            style={{ width: `${importProgress}%` }}
                          >
                            <div className="absolute inset-0 bg-white/30 animate-pulse" />
                          </motion.div>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleImport(item)}
                        disabled={importingId !== null}
                        className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer border border-[#4D4845]/50"
                        style={{ 
                          backgroundColor: importingId !== null ? '#3A373A' : '#F5ECDC',
                          color: importingId !== null ? '#8A817C' : '#000000' 
                        }}
                      >
                        <Download size={16} className="stroke-[2.5]" style={{ color: importingId !== null ? '#8A817C' : '#000000' }} />
                        <span className="font-black" style={{ color: importingId !== null ? '#8A817C' : '#000000' }}>
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
