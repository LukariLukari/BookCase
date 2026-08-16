'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Download, Loader2, BookOpen } from 'lucide-react';
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
  const [error, setError] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setError(null);
    setResults([]);

    try {
      const res = await axios.get(`${API_URL}/api/external-search?q=${encodeURIComponent(query)}`);
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

  const handleImport = async (item: ExternalSearchItem) => {
    setImportingId(item.id);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const res = await axios.post(`${API_URL}/api/external-import`, {
        id: item.id,
        title: item.title,
        author: item.author
      }, { headers });
      
      onImportSuccess();
      onClose(); // Đóng modal và để app tự refresh
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Lỗi khi tải sách về máy chủ.');
    } finally {
      setImportingId(null);
    }
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
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          className="relative bg-[#1F1D20] rounded-3xl max-w-2xl w-full border border-[#4D4845]/50 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="p-6 border-b border-[#4D4845]/50 flex justify-between items-center bg-[#2A272A]">
            <h2 className="text-xl font-bold text-[#F5ECDC] flex items-center gap-2">
              <BookOpen className="text-orange-500" />
              Tìm & Tải Sách Online
            </h2>
            <button 
              onClick={onClose}
              className="p-2 bg-[#1F1D20] hover:bg-orange-500 hover:text-white text-[#D7C9B2] rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Search Bar */}
          <div className="p-6 bg-[#1F1D20]">
            <form onSubmit={handleSearch} className="flex gap-3">
              <input 
                type="text" 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nhập tên sách, tác giả..."
                className="flex-1 bg-[#2A272A] border border-[#4D4845] rounded-xl px-4 py-3 text-[#F5ECDC] focus:outline-none focus:border-orange-500"
                autoFocus
              />
              <button 
                type="submit"
                disabled={isSearching || !query.trim()}
                className="bg-orange-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2 transition-colors"
              >
                {isSearching ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
                <span className="hidden sm:inline">Tìm kiếm</span>
              </button>
            </form>
          </div>

          {/* Results Area */}
          <div className="flex-1 overflow-y-auto p-6 pt-0">
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

            <div className="space-y-3">
              {results.map((item, idx) => (
                <div key={idx} className="bg-[#2A272A] border border-[#4D4845]/50 rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between hover:border-orange-500/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[#F5ECDC] font-bold line-clamp-2">{item.title}</h3>
                    <p className="text-[#D7C9B2] text-sm mt-1">{item.author || 'Không rõ tác giả'}</p>
                    <div className="flex gap-2 mt-2 text-xs text-[#8A817C] font-semibold">
                      <span className="bg-[#1F1D20] px-2 py-1 rounded-md uppercase">{item.extension}</span>
                      {item.size && <span className="bg-[#1F1D20] px-2 py-1 rounded-md">{item.size}</span>}
                      {item.language && <span className="bg-[#1F1D20] px-2 py-1 rounded-md">{item.language}</span>}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleImport(item)}
                    disabled={importingId !== null}
                    className="w-full sm:w-auto bg-[#4D4845] hover:bg-green-600 text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    {importingId === item.id ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Đang lấy...
                      </>
                    ) : (
                      <>
                        <Download size={16} />
                        Thêm vào thư viện
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
