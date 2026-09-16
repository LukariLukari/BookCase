'use client';
import { useState, useEffect } from 'react';
import Bookshelf from '@/components/Bookshelf';
import Sidebar from '@/components/Sidebar';
import SearchOnlineModal from '@/components/SearchOnlineModal';
import UploadModal from '@/components/UploadModal';
import { 
  Search, 
  Upload, 
  BookOpen, 
  ChevronRight, 
  ChevronLeft, 
  Send, 
  Paperclip, 
  MoreHorizontal, 
  Eye, 
  Sparkles, 
  Layers, 
  Heart, 
  Compass, 
  Flame, 
  Feather, 
  GraduationCap, 
  BookMarked 
} from 'lucide-react';
import { useAuth } from '@/app/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import axios from 'axios';

const CATEGORIES = [
  { id: 'all', label: 'Tất cả', icon: Layers, color: '#3A7BD5' },
  { id: 'fiction', label: 'Tiểu thuyết', icon: BookOpen, color: '#E56B6F' },
  { id: 'bestseller', label: 'Bán chạy', icon: Flame, color: '#F2994A' },
  { id: 'classic', label: 'Kinh điển', icon: Feather, color: '#27AE60' },
  { id: 'selfhelp', label: 'Kỹ năng', icon: GraduationCap, color: '#8E44AD' },
  { id: 'romance', label: 'Tình cảm', icon: Heart, color: '#EB5757' },
  { id: 'scifi', label: 'Khoa học', icon: Compass, color: '#56CCF2' },
  { id: 'audiobook', label: 'Tuyển chọn', icon: BookMarked, color: '#F2C94C' },
];

export default function BooksClient({ initialBooks }: { initialBooks: any[] }) {
  const [books, setBooks] = useState<any[]>(() => {
    if (initialBooks && initialBooks.length > 0) return initialBooks;
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem('cached_books');
        if (cached) return JSON.parse(cached);
      } catch (e) {}
    }
    return [];
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [isSearchOnlineOpen, setIsSearchOnlineOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isLoadingBooks, setIsLoadingBooks] = useState(true);
  
  // Chat drawer state
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'bot'; text: string; book?: any }>>([
    { sender: 'bot', text: 'Chào bạn! Bạn đang tìm cuốn sách hoặc tác giả nào hôm nay?' },
    { sender: 'user', text: 'Gợi ý cho tôi vài cuốn sách văn học kinh điển hay nhất nhé?' },
    { sender: 'bot', text: 'Dưới đây là một số tác phẩm kinh điển được bạn đọc yêu thích nhất trong thư viện BookCase:' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Pagination & Cold Start States
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isColdStart, setIsColdStart] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const fetchBooks = async (isLoadMore = false) => {
    try {
      if (!isLoadMore) {
        setIsLoadingBooks(true);
      } else {
        setIsLoadingMore(true);
      }
      
      const currentSkip = isLoadMore ? (page + 1) * 30 : 0;
      
      const coldStartTimer = setTimeout(() => {
        if (!isLoadMore) setIsColdStart(true);
      }, 5000);

      const res = await axios.get(`${API_URL}/api/books`, { 
        params: {
          skip: currentSkip,
          limit: 30,
          search: searchQuery,
          sort_by: sortBy
        }
      });
      
      clearTimeout(coldStartTimer);
      setIsColdStart(false);

      if (res.data && Array.isArray(res.data)) {
        if (!isLoadMore) {
          setBooks(res.data);
          setPage(0);
          try {
            sessionStorage.removeItem('cached_books');
            if (!searchQuery) sessionStorage.setItem('cached_books', JSON.stringify(res.data));
          } catch (e) {}
        } else {
          setBooks(prev => {
            const existingIds = new Set(prev.map((b: any) => b.id));
            const newBooks = res.data.filter((b: any) => !existingIds.has(b.id));
            return [...prev, ...newBooks];
          });
          setPage(prev => prev + 1);
        }
        setHasMore(res.data.length === 30);
      }
    } catch (err) {
      console.error('Lỗi fetch sách:', err);
      setIsColdStart(false);
    } finally {
      setIsLoadingBooks(false);
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user) {
      const delayTimer = setTimeout(() => {
        fetchBooks(false);
      }, 400);
      return () => clearTimeout(delayTimer);
    }
  }, [user, searchQuery, sortBy]);

  // Auto-refresh when any book file is added, imported, or updated
  useEffect(() => {
    const handleBooksUpdated = () => {
      try {
        sessionStorage.removeItem('cached_books');
      } catch (e) {}
      fetchBooks(false);
    };

    const handleFocus = () => {
      fetchBooks(false);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('bookcase:books-updated', handleBooksUpdated);
      window.addEventListener('focus', handleFocus);
      return () => {
        window.removeEventListener('bookcase:books-updated', handleBooksUpdated);
        window.removeEventListener('focus', handleFocus);
      };
    }
  }, []);

  const handleSendChat = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim()) return;

    const userText = chatInput.trim();
    setChatMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setChatInput('');

    // Fast local AI search matching
    setTimeout(() => {
      const matched = books.find(b => 
        b.title.toLowerCase().includes(userText.toLowerCase()) || 
        (b.author && b.author.toLowerCase().includes(userText.toLowerCase()))
      );
      if (matched) {
        setChatMessages(prev => [
          ...prev, 
          { 
            sender: 'bot', 
            text: `Tôi đã tìm thấy cuốn "${matched.title}" của tác giả ${matched.author || 'chưa rõ'}:`,
            book: matched
          }
        ]);
      } else {
        setChatMessages(prev => [
          ...prev, 
          { 
            sender: 'bot', 
            text: `Bạn có thể bấm vào "Tìm Sách Online" ở thanh trên để tìm thêm tác phẩm này từ các máy chủ trực tuyến nhé!` 
          }
        ]);
      }
    }, 600);
  };

  // Filter books by category
  const filteredBooks = books.filter(b => {
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'fiction') return (b.genre && /tiểu thuyết|fiction|văn học/i.test(b.genre));
    if (selectedCategory === 'classic') return (b.genre && /kinh điển|classic/i.test(b.genre));
    if (selectedCategory === 'selfhelp') return (b.genre && /kỹ năng|self-help|phát triển/i.test(b.genre));
    if (selectedCategory === 'romance') return (b.genre && /tình cảm|romance/i.test(b.genre));
    if (selectedCategory === 'scifi') return (b.genre && /khoa học|sci-fi|viễn tưởng/i.test(b.genre));
    return true;
  });

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-[#D8C9BB] flex items-center justify-center font-bold text-[#2A2320]">
        Đang tải BookCase...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#D8C9BB] p-3 sm:p-5 md:p-6 lg:p-7 flex justify-center gap-5 font-sans selection:bg-[#5F65B9]/20">
      
      {/* 1. LEFT COLUMN: FLOATING PILL DOCK */}
      <Sidebar />

      {/* 2. CENTER COLUMN: MAIN BOARD CONTAINER */}
      <main className="flex-1 max-w-5xl bg-[#FBF8F4] rounded-[36px] p-5 sm:p-7 md:p-8 shadow-[0_16px_40px_rgba(120,100,85,0.12)] border border-[#EFE8DE] flex flex-col gap-6 overflow-hidden min-w-0">
        
        {/* TOP SEARCH & ACTION BAR */}
        <header className="flex flex-col sm:flex-row items-center justify-between gap-3.5">
          {/* Pill Search Input */}
          <div className="w-full sm:flex-1 bg-[#EFE8DE] rounded-full px-4 py-2 flex items-center gap-2.5 border border-[#E0D5C7] shadow-inner transition-all focus-within:border-[#5F65B9]">
            <Search size={18} className="text-[#8B7070] flex-shrink-0" />
            <input 
              type="text" 
              placeholder="Tìm kiếm sách, tác giả..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-sm font-medium text-[#2A2320] placeholder-[#8B7070] focus:outline-none"
            />
          </div>

          {/* Action Buttons: Gradient Search & Upload Pill */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={() => setIsSearchOnlineOpen(true)}
              className="btn-gradient px-6 py-2.5 rounded-full font-black text-xs sm:text-sm tracking-wide shadow-md active:scale-95 cursor-pointer whitespace-nowrap"
            >
              Tìm Online
            </button>

            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="w-10 h-10 rounded-full bg-[#EFE8DE] hover:bg-[#E2D7C8] border border-[#E0D5C7] flex items-center justify-center text-[#2A2320] transition-all cursor-pointer shadow-sm hover:scale-105"
              title="Tải sách từ máy lên"
            >
              <Upload size={16} />
            </button>

            {/* Mobile Chat Toggle Button */}
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className="xl:hidden w-10 h-10 rounded-full bg-[#7E79BF] text-white flex items-center justify-center shadow-sm cursor-pointer"
              title="Mở Trợ lý Chat"
            >
              <Sparkles size={16} />
            </button>
          </div>
        </header>

        {/* CATEGORIES / BOOK FORMAT ROW */}
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const active = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex flex-col items-center gap-1.5 px-3.5 py-2 rounded-2xl transition-all flex-shrink-0 cursor-pointer ${
                  active 
                    ? 'bg-[#EFE8DE] shadow-sm border border-[#DFCFC0] scale-105' 
                    : 'hover:bg-[#F2ECE2] opacity-75 hover:opacity-100'
                }`}
              >
                <div 
                  className="w-8 h-8 rounded-xl flex items-center justify-center shadow-xs"
                  style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                >
                  <Icon size={16} />
                </div>
                <span className={`text-[11px] font-bold ${active ? 'text-[#2A2320]' : 'text-[#7A6F68]'}`}>
                  {cat.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* "POPULAR" SECTION HEADER */}
        <div className="flex items-center justify-between pt-1">
          <h2 className="text-xl md:text-2xl font-black text-[#2A2320] tracking-tight">
            Sách Nổi Bật
          </h2>
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-[#EFE8DE] border border-[#E0D5C7] rounded-full text-xs font-bold px-3.5 py-1.5 text-[#2A2320] cursor-pointer focus:outline-none shadow-sm"
            >
              <option value="newest">Mới nhất</option>
              <option value="author">Theo tác giả</option>
              <option value="a-z">A ➔ Z</option>
              <option value="z-a">Z ➔ A</option>
            </select>
          </div>
        </div>

        {/* BOOKSHELF DISPLAY */}
        <section className="flex-1 min-h-[300px]">
          {isLoadingBooks && books.length === 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5 animate-pulse pt-2">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <div className="aspect-[2/3] bg-[#EFE8DE] rounded-2xl" />
                  <div className="h-4 bg-[#EFE8DE] rounded-md w-3/4" />
                  <div className="h-3 bg-[#EFE8DE] rounded-md w-1/2" />
                </div>
              ))}
            </div>
          ) : filteredBooks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-[#7A6F68]">
              <BookOpen size={40} className="text-[#C8BAA9] mb-3" />
              <p className="font-bold text-base text-[#2A2320]">Không tìm thấy cuốn sách nào</p>
              <p className="text-xs text-[#7A6F68] mt-1">Hãy thử đổi từ khóa hoặc tìm kiếm trực tuyến từ kho thư viện mở</p>
            </div>
          ) : (
            <Bookshelf 
              books={filteredBooks} 
              refresh={() => fetchBooks(false)} 
              sortBy={sortBy} 
            />
          )}

          {/* Load More Button */}
          {hasMore && !searchQuery && filteredBooks.length > 0 && (
            <div className="flex justify-center pt-8 pb-4">
              <button
                onClick={() => fetchBooks(true)}
                disabled={isLoadingMore}
                className="px-6 py-2.5 bg-[#EFE8DE] hover:bg-[#E2D7C8] border border-[#E0D5C7] rounded-full text-xs font-bold text-[#2A2320] shadow-sm transition-all cursor-pointer"
              >
                {isLoadingMore ? 'Đang tải thêm...' : 'Xem thêm sách'}
              </button>
            </div>
          )}
        </section>

        {/* PROMO BESTSELLERS BANNER & CURATED MINI LISTS */}
        <section className="mt-4 pt-6 border-t border-[#EAE2D5] grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Promo Card */}
          <div className="lg:col-span-7 bg-[#EFE8DE] rounded-3xl p-6 flex items-center justify-between gap-4 border border-[#E0D5C7] shadow-sm">
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#E56B6F] bg-[#FAF0F0] px-2.5 py-0.5 rounded-full">
                Tuyển chọn 2026
              </span>
              <h3 className="text-base sm:text-lg font-black text-[#2A2320] leading-tight">
                Top 50 Tác Phẩm Đọc Nhiều Nhất
              </h3>
              <p className="text-xs text-[#7A6F68] leading-relaxed max-w-sm">
                Tổng hợp những cuốn sách được cộng đồng bạn đọc đánh giá cao và tải về nhiều nhất trên BookCase.
              </p>
              <div className="pt-1">
                <button 
                  onClick={() => setIsSearchOnlineOpen(true)}
                  className="bg-[#E56B6F] hover:bg-[#D6595D] text-white px-4 py-2 rounded-full text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Eye size={13} />
                  <span>Khám phá ngay</span>
                </button>
              </div>
            </div>

            {/* Decorative Book Stack graphic */}
            <div className="hidden sm:flex flex-col items-center gap-1 opacity-85 flex-shrink-0">
              <div className="w-20 h-5 bg-[#EB5757] rounded-md shadow-xs border-r-4 border-white/40" />
              <div className="w-24 h-5 bg-[#3A7BD5] rounded-md shadow-xs border-r-4 border-white/40" />
              <div className="w-22 h-5 bg-[#27AE60] rounded-md shadow-xs border-r-4 border-white/40" />
              <div className="w-26 h-5 bg-[#F2C94C] rounded-md shadow-xs border-r-4 border-white/40" />
              <div className="w-28 h-5 bg-[#9B51E0] rounded-md shadow-xs border-r-4 border-white/40" />
            </div>
          </div>

          {/* Right Mini Curated Cards */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-2.5">
            <div 
              onClick={() => { setSelectedCategory('classic'); }}
              className="bg-[#FFFFFF] hover:bg-[#FAF6F0] p-3 rounded-2xl border border-[#ECE2D5] flex items-center gap-3 cursor-pointer transition-all shadow-2xs hover:scale-[1.01]"
            >
              <div className="w-9 h-9 rounded-xl bg-[#27AE60]/15 text-[#27AE60] flex items-center justify-center flex-shrink-0">
                <Feather size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-black text-[#2A2320] truncate">Top 50 Sách Kinh Điển</h4>
                <p className="text-[11px] text-[#7A6F68] truncate">Những áng văn trường tồn với thời gian</p>
              </div>
              <ChevronRight size={16} className="text-[#C8BAA9]" />
            </div>

            <div 
              onClick={() => { setSelectedCategory('selfhelp'); }}
              className="bg-[#FFFFFF] hover:bg-[#FAF6F0] p-3 rounded-2xl border border-[#ECE2D5] flex items-center gap-3 cursor-pointer transition-all shadow-2xs hover:scale-[1.01]"
            >
              <div className="w-9 h-9 rounded-xl bg-[#8E44AD]/15 text-[#8E44AD] flex items-center justify-center flex-shrink-0">
                <GraduationCap size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-black text-[#2A2320] truncate">Top Sách Phát Triển Bản Thân</h4>
                <p className="text-[11px] text-[#7A6F68] truncate">Tư duy, năng suất và bài học cuộc sống</p>
              </div>
              <ChevronRight size={16} className="text-[#C8BAA9]" />
            </div>

            <div 
              onClick={() => { setSelectedCategory('scifi'); }}
              className="bg-[#FFFFFF] hover:bg-[#FAF6F0] p-3 rounded-2xl border border-[#ECE2D5] flex items-center gap-3 cursor-pointer transition-all shadow-2xs hover:scale-[1.01]"
            >
              <div className="w-9 h-9 rounded-xl bg-[#56CCF2]/20 text-[#2F80ED] flex items-center justify-center flex-shrink-0">
                <Compass size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-black text-[#2A2320] truncate">Top Khoa Học & Viễn Tưởng</h4>
                <p className="text-[11px] text-[#7A6F68] truncate">Khám phá tương lai và vũ trụ</p>
              </div>
              <ChevronRight size={16} className="text-[#C8BAA9]" />
            </div>
          </div>
        </section>
      </main>

      {/* 3. RIGHT COLUMN: CHAT / ASSISTANT DRAWER */}
      <aside className={`
        fixed xl:static top-0 right-0 h-full xl:h-[calc(100vh-48px)] w-80 lg:w-84 
        bg-[#FAF6F0] rounded-l-[36px] xl:rounded-[36px] p-5 
        shadow-[0_16px_40px_rgba(120,100,85,0.14)] border border-[#ECE2D5] 
        flex flex-col gap-4 z-50 transition-transform duration-300
        ${isChatOpen ? 'translate-x-0' : 'translate-x-full xl:translate-x-0'}
      `}>
        {/* Chat Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[#EBE2D5]">
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-base text-[#2A2320]">Trợ Lý BookCase</h3>
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setIsChatOpen(false)}
              className="xl:hidden p-1.5 text-[#7A6F68] hover:text-[#2A2320] rounded-lg"
            >
              ✕
            </button>
            <div className="p-1.5 text-[#7A6F68]">
              <MoreHorizontal size={18} />
            </div>
          </div>
        </div>

        {/* Support Pill Banner */}
        <div className="bg-[#EFE8DE] p-3 rounded-2xl flex items-center justify-between border border-[#E0D5C7] text-xs">
          <div>
            <p className="font-bold text-[#2A2320]">Tư vấn sách thông minh</p>
            <p className="text-[11px] text-[#7A6F68]">Hỏi về bất kỳ cuốn sách nào</p>
          </div>
          <ChevronRight size={16} className="text-[#8B7070]" />
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
          {chatMessages.map((msg, idx) => (
            <div key={idx} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
              <div 
                className={`max-w-[85%] p-3.5 rounded-2xl leading-relaxed ${
                  msg.sender === 'user' 
                    ? 'bg-[#7E79BF] text-white rounded-br-xs shadow-xs' 
                    : 'bg-[#FFFFFF] text-[#2A2320] rounded-bl-xs shadow-xs border border-[#ECE2D5]'
                }`}
              >
                {msg.text}

                {/* Embedded Book Card in Chat */}
                {msg.book && (
                  <div className="mt-2.5 pt-2 border-t border-[#ECE2D5] flex items-center gap-2.5">
                    {msg.book.cover_url && (
                      <img 
                        src={msg.book.cover_url} 
                        alt={msg.book.title} 
                        className="w-9 h-13 object-cover rounded-md shadow-xs flex-shrink-0"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-extrabold text-[11px] text-[#2A2320] truncate">{msg.book.title}</p>
                      <p className="text-[10px] text-[#7A6F68] truncate">{msg.book.author}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Chat Input Box */}
        <form onSubmit={handleSendChat} className="bg-[#EFE8DE] rounded-full p-1.5 pl-4 flex items-center gap-2 border border-[#E0D5C7] shadow-inner">
          <input 
            type="text" 
            placeholder="Hỏi trợ lý về sách..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            className="flex-1 bg-transparent text-xs font-medium text-[#2A2320] placeholder-[#8B7070] focus:outline-none"
          />
          <button 
            type="submit"
            disabled={!chatInput.trim()}
            className="w-8 h-8 rounded-full bg-[#E56B6F] hover:bg-[#D6595D] text-white flex items-center justify-center shadow-sm disabled:opacity-40 transition-transform active:scale-95 cursor-pointer flex-shrink-0"
          >
            <Send size={13} className="ml-0.5" />
          </button>
        </form>
      </aside>

      {/* MODALS */}
      <SearchOnlineModal 
        isOpen={isSearchOnlineOpen} 
        onClose={() => setIsSearchOnlineOpen(false)} 
        onImportSuccess={() => fetchBooks(false)} 
      />

      <UploadModal 
        isOpen={isUploadModalOpen} 
        onClose={() => setIsUploadModalOpen(false)} 
        onUploadSuccess={() => fetchBooks(false)} 
      />

    </div>
  );
}
