'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Download, Loader2, BookOpen, Globe, Pencil, PenTool } from 'lucide-react';
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
}

export default function SearchOnlineModal({ isOpen, onClose, onImportSuccess }: SearchOnlineModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ExternalSearchItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setError(null);
    setResults([]);

    try {
      let url = `${API_URL}/api/external-search?q=${encodeURIComponent(query)}&source=zlib`;
      const res = await axios.get(url);
      setResults(res.data);
      if (res.data.length === 0) {
        setError('Không tìm thấy sách nào.');
      }
    } catch (err: any) {
      if (err.response && err.response.status === 504) {
        setError(err.response.data.detail || 'Không thể kết nối đến máy chủ tìm kiếm sách (Có thể bị chặn).');
      } else {
        setError('Đã xảy ra lỗi khi tìm kiếm.');
      }
    } finally {
      setIsSearching(false);
    }
  };

  const filteredResults = results;

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
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const res = await axios.post(`${API_URL}/api/external-import`, {
        id: item.id,
        title: item.title,
        author: item.author
      }, { headers });
      
      clearInterval(interval);
      setImportProgress(100);

      const newBook = res.data;
      if (newBook && newBook.status === 'manual_download' && newBook.external_url) {
        window.open(newBook.external_url, '_blank');
        setError('Hệ thống máy chủ bị Cloudflare chặn. Đã mở link tải trực tiếp trên trình duyệt của bạn. Vui lòng tự tải sách về máy và dùng nút "Upload" để thêm vào thư viện.');
      } else if (newBook && newBook.id) {
        const downloadUrl = `${API_URL}/api/books/${newBook.id}/download`;
        // Kích hoạt download trực tiếp cho cả Mobile Safari (iOS) và Android/Desktop
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
      setError(err.response?.data?.detail || 'Lỗi khi tải sách về máy chủ.');
      setImportingId(null);
      setImportProgress(0);
    }
  };

  const handleModalClose = () => {
    setImportingId(null);
    setImportProgress(0);
    onClose();
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
          onClick={handleModalClose}
        />
        
        <motion.div 
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          className="relative bg-[#1F1D20] rounded-3xl max-w-2xl w-full border border-[#4D4845]/50 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="p-6 border-b border-[#4D4845]/50 flex justify-between items-center bg-[#2A272A]">
            <h2 className="text-xl font-bold text-[#F5ECDC] flex items-center gap-2">
              <BookOpen className="text-[#F5ECDC]" size={22} />
              Tìm & Tải Sách Online
            </h2>
            <button 
              onClick={handleModalClose}
              className="p-2 bg-[#1F1D20] hover:bg-[#F5ECDC] hover:text-black text-[#F5ECDC] rounded-full transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Search Bar */}
          <div className="p-6 bg-[#1F1D20] pb-3">
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
          </div>

          {/* Results Area */}
          <div className="flex-1 overflow-y-auto p-6 pt-3">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl mb-4 text-sm text-center">
                {error}
              </div>
            )}

            {!isSearching && results.length === 0 && !error && query && (
              <div className="text-center text-[#D7C9B2] py-10 opacity-60">
                Nhập từ khóa và bấm tìm kiếm
              </div>
            )}

            {!isSearching && results.length > 0 && filteredResults.length === 0 && (
              <div className="text-center text-[#D7C9B2] py-10 opacity-60">
                Không có kết quả từ nguồn đã chọn.
              </div>
            )}

            <div className="space-y-3">
              {filteredResults.map((item, idx) => {
                return (
                  <div key={idx} className="bg-[#2A272A] border border-[#4D4845]/50 rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between hover:border-[#F5ECDC]/60 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="bg-[#1F1D20] text-[#F5ECDC] border border-[#4D4845] text-[10px] font-extrabold px-2.5 py-0.5 rounded-md flex items-center gap-1.5">
                          <Pencil size={12} className="text-[#F5ECDC]" /> Nguồn bút chì
                        </span>
                      </div>
                      <h3 className="text-[#F5ECDC] font-bold line-clamp-2">{item.title}</h3>
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
                        <span className="font-black" style={{ color: importingId !== null ? '#8A817C' : '#000000' }}>Tải về máy & Thêm vào web</span>
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
