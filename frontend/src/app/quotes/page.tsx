'use client';
import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/app/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { 
  Quote as QuoteIcon, Search, Download, Copy, Check, 
  Trash2, Loader2, ArrowUpDown, Share2, FileDown, BookMarked
} from 'lucide-react';
import ShareQuoteModal from '@/components/ShareQuoteModal';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';

interface GlobalQuote {
  id: string;
  user_book_id: string;
  image_url: string;
  text_content?: string;
  page_number?: number | null;
  created_at: string;
  book_title?: string;
  book_author?: string;
  book_cover_url?: string | null;
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<GlobalQuote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBookFilter, setSelectedBookFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  
  const [sharingQuote, setSharingQuote] = useState<GlobalQuote | null>(null);
  const [copiedQuoteId, setCopiedQuoteId] = useState<string | null>(null);

  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const fetchAllQuotes = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/api/users/me/quotes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setQuotes(res.data);
    } catch (err) {
      console.error("Fetch all quotes error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    } else if (user) {
      fetchAllQuotes();
    }
  }, [user, authLoading, router]);

  const handleDeleteQuote = async (quoteId: string) => {
    if (!confirm("Bạn có chắc muốn xóa trích dẫn này?")) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/api/users/me/quotes/${quoteId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setQuotes(prev => prev.filter(q => q.id !== quoteId));
    } catch (err) {
      console.error(err);
      alert("Lỗi khi xóa trích dẫn.");
    }
  };

  const handleCopyText = async (quote: GlobalQuote) => {
    const text = `"${quote.text_content || ''}"\n— ${quote.book_title || 'Sách'} (${quote.book_author || ''})${quote.page_number ? `, Trang ${quote.page_number}` : ''}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedQuoteId(quote.id);
      setTimeout(() => setCopiedQuoteId(null), 2000);
    } catch {
      // fallback
    }
  };

  // Unique list of books for filtering
  const bookList = useMemo(() => {
    const map = new Map<string, string>();
    quotes.forEach(q => {
      if (q.user_book_id && q.book_title) {
        map.set(q.user_book_id, q.book_title);
      }
    });
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [quotes]);

  // Filtered & Sorted Quotes
  const filteredQuotes = useMemo(() => {
    return quotes
      .filter(q => {
        if (selectedBookFilter !== 'all' && q.user_book_id !== selectedBookFilter) {
          return false;
        }
        if (!searchQuery.trim()) return true;
        const qLower = searchQuery.toLowerCase();
        const textMatch = q.text_content?.toLowerCase().includes(qLower);
        const titleMatch = q.book_title?.toLowerCase().includes(qLower);
        const authorMatch = q.book_author?.toLowerCase().includes(qLower);
        const pageMatch = q.page_number?.toString().includes(qLower);
        return textMatch || titleMatch || authorMatch || pageMatch;
      })
      .sort((a, b) => {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
      });
  }, [quotes, searchQuery, selectedBookFilter, sortOrder]);

  // Export to Markdown
  const handleExportMarkdown = () => {
    if (filteredQuotes.length === 0) return;

    let md = `# Trích Dẫn Sách (BookCase Highlights)\n`;
    md += `*Xuất ngày: ${new Date().toLocaleDateString('vi-VN')} - Tổng cộng: ${filteredQuotes.length} trích dẫn*\n\n---\n\n`;

    filteredQuotes.forEach((q, idx) => {
      md += `### ${idx + 1}. ${q.book_title || 'Sách Chưa Đặt Tên'}\n`;
      md += `> "${q.text_content || ''}"\n\n`;
      md += `- **Tác giả:** ${q.book_author || 'Ẩn danh'}\n`;
      if (q.page_number) md += `- **Vị trí:** Trang ${q.page_number}\n`;
      md += `- **Ngày lưu:** ${new Date(q.created_at).toLocaleDateString('vi-VN')}\n\n`;
      md += `---\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `BookCase_Highlights_${Date.now()}.md`;
    link.click();
    URL.revokeObjectURL(url);

    try {
      confetti({ particleCount: 40, spread: 50, origin: { y: 0.7 } });
    } catch {}
  };

  if (authLoading || !user) {
    return <div className="min-h-screen bg-[#1F1D20] flex items-center justify-center font-bold text-[#D7C9B2]">Đang tải...</div>;
  }

  return (
    <div className="flex bg-[#1F1D20] text-[#F5ECDC] min-h-screen font-sans overflow-x-hidden">
      <Sidebar />

      <div className="flex-1 ml-0 md:ml-64 pt-16 md:pt-0 flex flex-col min-h-screen w-full">
        
        {/* Header */}
        <header className="sticky top-16 md:top-0 z-30 bg-[#1F1D20]/95 backdrop-blur-md px-4 py-4 md:px-10 md:py-6 border-b border-[#4D4845]/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="p-2 bg-[#2A272A] rounded-xl text-[#F5ECDC] border border-[#4D4845]/50">
                <QuoteIcon size={18} />
              </div>
              <h1 className="text-xl md:text-2xl font-black text-[#F5ECDC]">Kho Trích Dẫn Toàn Cục</h1>
            </div>
            <p className="text-xs text-[#D7C9B2]">Tìm kiếm, lưu giữ và xuất ảnh trích dẫn từ mọi cuốn sách của bạn</p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button 
              onClick={handleExportMarkdown}
              disabled={filteredQuotes.length === 0}
              className="flex-1 sm:flex-none bg-[#2A272A] hover:bg-[#3A373A] text-[#F5ECDC] border border-[#4D4845]/70 rounded-xl py-2 px-3.5 text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-30"
              title="Xuất danh sách ra file Markdown cho Notion / Obsidian"
            >
              <FileDown size={14} />
              <span>Xuất Markdown</span>
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 px-4 md:px-10 pt-6 pb-16">
          
          {/* Controls Bar */}
          <div className="bg-[#2A272A]/70 border border-[#4D4845]/50 rounded-2xl p-4 mb-8 space-y-4">
            
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A817C]" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm nội dung trích dẫn, tên sách, tác giả, số trang..."
                className="w-full bg-[#1F1D20] border border-[#4D4845]/60 focus:border-[#F5ECDC]/60 rounded-xl py-2.5 pl-10 pr-4 text-sm text-[#F5ECDC] placeholder-[#7B7369] focus:outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-[#8A817C] hover:text-[#F5ECDC] bg-[#2A272A] px-2 py-0.5 rounded-md"
                >
                  Xóa
                </button>
              )}
            </div>

            {/* Filter by Book Chips & Sort */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#4D4845]/30">
              
              {/* Book Filter Chips */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
                <span className="text-xs text-[#8A817C] font-semibold flex-shrink-0">
                  Sách:
                </span>
                
                <button
                  onClick={() => setSelectedBookFilter('all')}
                  className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all flex-shrink-0 cursor-pointer ${
                    selectedBookFilter === 'all'
                      ? 'bg-[#F5ECDC] shadow-sm'
                      : 'bg-[#1F1D20] text-[#D7C9B2] border border-[#4D4845]/50 hover:bg-[#3A373A]'
                  }`}
                  style={selectedBookFilter === 'all' ? { color: '#1F1D20' } : undefined}
                >
                  Tất cả ({quotes.length})
                </button>

                {bookList.map(b => (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBookFilter(b.id)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all flex-shrink-0 cursor-pointer max-w-[200px] truncate ${
                      selectedBookFilter === b.id
                        ? 'bg-[#F5ECDC] shadow-sm'
                        : 'bg-[#1F1D20] text-[#D7C9B2] border border-[#4D4845]/50 hover:bg-[#3A373A]'
                    }`}
                    style={selectedBookFilter === b.id ? { color: '#1F1D20' } : undefined}
                  >
                    {b.title}
                  </button>
                ))}
              </div>

              {/* Sort Order */}
              <button
                onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
                className="flex items-center gap-1.5 text-xs text-[#D7C9B2] hover:text-[#F5ECDC] bg-[#1F1D20] px-3 py-1.5 rounded-lg border border-[#4D4845]/60 transition-colors flex-shrink-0 cursor-pointer"
              >
                <ArrowUpDown size={13} />
                <span>{sortOrder === 'newest' ? 'Mới nhất trước' : 'Cũ nhất trước'}</span>
              </button>

            </div>
          </div>

          {/* Quotes Grid / Empty State */}
          {isLoading ? (
            <div className="flex justify-center mt-20"><Loader2 className="animate-spin text-[#D7C9B2]" size={32} /></div>
          ) : filteredQuotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center bg-[#2A272A] border border-[#4D4845]/40 rounded-3xl p-12 mt-4 text-center">
              <QuoteIcon size={44} className="text-[#4D4845] mb-4" />
              <h2 className="text-[#F5ECDC] text-lg font-bold mb-2">
                {searchQuery || selectedBookFilter !== 'all' ? 'Không tìm thấy trích dẫn phù hợp' : 'Chưa có trích dẫn nào được lưu'}
              </h2>
              <p className="text-[#D7C9B2] text-sm max-w-md mb-5">
                {searchQuery || selectedBookFilter !== 'all'
                  ? 'Hãy thử tìm bằng từ khóa khác hoặc chuyển bộ lọc sang "Tất cả".'
                  : 'Hãy vào trang "Sách Cá Nhân", mở cuốn sách yêu thích và quét/lưu các trích dẫn tâm đắc nhé!'}
              </p>
              {!searchQuery && selectedBookFilter === 'all' && (
                <button
                  onClick={() => router.push('/my-books')}
                  className="bg-[#F5ECDC] hover:bg-white font-bold text-xs py-2.5 px-5 rounded-xl shadow-md transition-colors cursor-pointer"
                  style={{ color: '#1F1D20' }}
                >
                  Đến Thư Viện Sách Cá Nhân
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredQuotes.map(quote => {
                const hasText = quote.text_content && quote.text_content.trim().length > 0;
                const hasImage = quote.image_url && quote.image_url.trim().length > 0;

                return (
                  <motion.div
                    key={quote.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative bg-[#2A272A] border border-[#4D4845]/60 hover:border-[#F5ECDC]/40 rounded-2xl p-5 shadow-lg flex flex-col justify-between group transition-all"
                  >
                    {/* Top Book Reference Tag */}
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#4D4845]/40 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <BookMarked size={14} className="text-[#D7C9B2] flex-shrink-0" />
                        <span className="text-xs font-bold text-[#F5ECDC] truncate" title={quote.book_title}>
                          {quote.book_title || "Sách"}
                        </span>
                      </div>

                      {/* Quick Card Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {hasText && (
                          <button
                            onClick={() => setSharingQuote(quote)}
                            className="p-1.5 text-[#D7C9B2] hover:text-[#F5ECDC] hover:bg-[#3A373A] bg-[#1F1D20] border border-[#4D4845]/60 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-bold shadow-sm"
                            title="Tạo ảnh Story/Square"
                          >
                            <Share2 size={12} />
                            <span>Xuất ảnh</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleCopyText(quote)}
                          className="p-1.5 text-[#8A817C] hover:text-[#F5ECDC] hover:bg-[#3A373A] rounded-lg transition-colors cursor-pointer"
                          title="Sao chép trích dẫn"
                        >
                          {copiedQuoteId === quote.id ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        </button>
                        <button
                          onClick={() => handleDeleteQuote(quote.id)}
                          className="p-1.5 text-[#8A817C] hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer opacity-70 group-hover:opacity-100"
                          title="Xóa trích dẫn"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Central Quote Content */}
                    <div className="flex-1 py-1">
                      {hasText ? (
                        <div className="relative">
                          <span className="text-3xl font-serif text-[#F5ECDC]/25 leading-none block -mb-2 select-none">“</span>
                          <p className="text-[#F5ECDC] text-sm font-medium leading-relaxed italic whitespace-pre-wrap font-serif pl-1">
                            {quote.text_content}
                          </p>
                          <span className="text-3xl font-serif text-[#F5ECDC]/25 leading-none text-right block -mt-2 select-none">”</span>
                        </div>
                      ) : (
                        <div className="py-2 text-xs text-[#8A817C] font-semibold italic">Trích dẫn bằng ảnh chụp</div>
                      )}

                      {/* Attached Photo Thumbnail */}
                      {hasImage && (
                        <div className="mt-3 relative w-full h-32 rounded-xl overflow-hidden bg-black/40 border border-[#4D4845]/50">
                          <img src={quote.image_url} alt="Attached page" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>

                    {/* Bottom Metadata: Author + Page Number + Date */}
                    <div className="mt-4 pt-3 border-t border-[#4D4845]/30 flex items-center justify-between text-[11px] text-[#7B7369]">
                      <div className="truncate pr-2">
                        <span className="text-[#D7C9B2] font-semibold">{quote.book_author}</span>
                      </div>
                      
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {quote.page_number && (
                          <span className="text-xs font-bold bg-[#1F1D20] text-[#D7C9B2] border border-[#4D4845]/60 px-2 py-0.5 rounded-md">
                            Trang {quote.page_number}
                          </span>
                        )}
                        <span>{new Date(quote.created_at).toLocaleDateString('vi-VN')}</span>
                      </div>
                    </div>

                  </motion.div>
                );
              })}
            </div>
          )}

        </main>

        {/* Share / Export Quote Modal */}
        {sharingQuote && sharingQuote.text_content && (
          <ShareQuoteModal
            quoteText={sharingQuote.text_content}
            bookTitle={sharingQuote.book_title}
            bookAuthor={sharingQuote.book_author}
            pageNumber={sharingQuote.page_number}
            coverUrl={sharingQuote.book_cover_url}
            onClose={() => setSharingQuote(null)}
          />
        )}

      </div>
    </div>
  );
}
