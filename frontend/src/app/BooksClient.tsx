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
  Send, 
  Eye, 
  Sparkles, 
  Layers, 
  Heart, 
  Compass, 
  Flame, 
  Feather, 
  GraduationCap, 
  BookMarked,
  X,
  Pencil,
  PenTool,
  ExternalLink,
  Download,
  Check,
  Loader2
} from 'lucide-react';
import { useAuth } from '@/app/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import axios from 'axios';

const CATEGORIES = [
  { id: 'all', label: 'Tất cả', icon: Layers },
  { id: 'fiction', label: 'Tiểu thuyết', icon: BookOpen },
  { id: 'bestseller', label: 'Bán chạy', icon: Flame },
  { id: 'classic', label: 'Kinh điển', icon: Feather },
  { id: 'selfhelp', label: 'Kỹ năng', icon: GraduationCap },
  { id: 'romance', label: 'Tình cảm', icon: Heart },
  { id: 'scifi', label: 'Khoa học', icon: Compass },
  { id: 'audiobook', label: 'Tuyển chọn', icon: BookMarked },
];

interface AssistantMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  onlineResults?: any[];
  localResults?: any[];
}

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
  
  // Trợ Lý Tìm Sách Online (Chat Assistant) states
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [assistantSource, setAssistantSource] = useState<'all' | 'zlib' | 'cloudily'>('all');
  const [isSearchingAssistant, setIsSearchingAssistant] = useState(false);
  const [importingBookId, setImportingBookId] = useState<string | null>(null);
  const [importedBookIds, setImportedBookIds] = useState<string[]>([]);
  const [chatMessages, setChatMessages] = useState<AssistantMessage[]>([
    { 
      id: 'welcome',
      sender: 'bot', 
      text: 'Xin chào! Tôi là Trợ Lý Tìm Sách Online. Bạn đang cần tìm cuốn sách, tác giả hoặc chủ đề nào? Hãy nhập tên sách, tôi sẽ tìm và hỗ trợ bạn tải thẳng vào tủ sách!' 
    }
  ]);
  const [chatInput, setChatInput] = useState('');

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

  // Assistant Search logic
  const handleAssistantSearch = async (queryText: string) => {
    const cleanQuery = queryText.trim();
    if (!cleanQuery) return;

    const userMsgId = 'u_' + Date.now();
    const botMsgId = 'b_' + (Date.now() + 1);

    setChatMessages(prev => [
      ...prev,
      { id: userMsgId, sender: 'user', text: cleanQuery }
    ]);
    setChatInput('');
    setIsSearchingAssistant(true);

    try {
      const res = await axios.get(`${API_URL}/api/books/search-online`, {
        params: {
          query: cleanQuery,
          source: assistantSource
        }
      });

      const onlineResults = Array.isArray(res.data) ? res.data : [];

      // Local matches check
      const localMatches = books.filter(b => 
        b.title.toLowerCase().includes(cleanQuery.toLowerCase()) || 
        (b.author && b.author.toLowerCase().includes(cleanQuery.toLowerCase()))
      ).slice(0, 2);

      if (onlineResults.length > 0) {
        setChatMessages(prev => [
          ...prev,
          {
            id: botMsgId,
            sender: 'bot',
            text: `Tôi đã tìm thấy ${onlineResults.length} bản sách trực tuyến cho "${cleanQuery}". Bạn có thể bấm "Tải về tủ" để thêm ngay vào kệ sách:`,
            onlineResults: onlineResults.slice(0, 6),
            localResults: localMatches.length > 0 ? localMatches : undefined
          }
        ]);
      } else {
        setChatMessages(prev => [
          ...prev,
          {
            id: botMsgId,
            sender: 'bot',
            text: `Không tìm thấy sách phù hợp với "${cleanQuery}" trên ${
              assistantSource === 'all' ? 'các server hiện tại' : 
              assistantSource === 'zlib' ? 'Server bút chì' : 'Server bút mực'
            }. Bạn thử đổi từ khóa ngắn gọn hơn (tên tác phẩm hoặc họ tên tác giả) nhé!`,
            localResults: localMatches.length > 0 ? localMatches : undefined
          }
        ]);
      }
    } catch (err: any) {
      setChatMessages(prev => [
        ...prev,
        {
          id: botMsgId,
          sender: 'bot',
          text: err.response?.data?.detail || 'Máy chủ tìm kiếm trực tuyến đang bận hoặc phản hồi chậm. Bạn vui lòng thử lại sau giây lát!'
        }
      ]);
    } finally {
      setIsSearchingAssistant(false);
    }
  };

  // 1-Click Import from Assistant
  const handleAssistantImport = async (item: any) => {
    setImportingBookId(item.id);
    try {
      const token = localStorage.getItem('access_token') || localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const cleanTitle = item.title.replace(/^\[.*?\]\s*/, '');
      const res = await axios.post(`${API_URL}/api/external-import`, {
        id: item.id,
        title: cleanTitle,
        author: item.author,
      }, { headers });

      const newBook = res.data;
      if (newBook && newBook.status === 'manual_download' && newBook.external_url) {
        window.open(newBook.external_url, '_blank');
        alert('File sách cần tải trực tiếp trên trình duyệt. Đã mở tab liên kết tải cho bạn.');
      } else {
        setImportedBookIds(prev => [...prev, item.id]);
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.removeItem('cached_books');
          } catch (e) {}
          window.dispatchEvent(new CustomEvent('bookcase:books-updated', { detail: { bookId: newBook?.id } }));
        }
        fetchBooks(false);
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Lỗi khi tải sách về máy chủ. Vui lòng thử lại.');
    } finally {
      setImportingBookId(null);
    }
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
      <div className="h-screen bg-[#D8C9BB] flex items-center justify-center font-bold text-[#1C1917]">
        Đang tải BookCase...
      </div>
    );
  }

  return (
    <div className="h-screen max-h-screen overflow-hidden bg-[#D8C9BB] p-3 sm:p-4 md:p-5 flex justify-center gap-4 lg:gap-5 font-sans selection:bg-[#1B2A4A]/20 selection:text-[#1C1917] relative">
      
      {/* 1. LEFT COLUMN: FLOATING PILL DOCK */}
      <Sidebar />

      {/* 2. CENTER COLUMN: MAIN BOARD CONTAINER (LOCKED OUTER FRAME) */}
      <main className="flex-1 max-w-5xl h-full bg-[#FBF8F4] rounded-[36px] p-4 sm:p-6 md:p-7 shadow-[0_16px_40px_rgba(120,100,85,0.12)] border border-[#EFE8DE] flex flex-col overflow-hidden min-w-0">
        
        {/* TOP SEARCH & ACTION BAR (PINNED) */}
        <header className="flex-shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3.5 pb-2">
          {/* Pill Search Input */}
          <div className="w-full sm:flex-1 bg-[#EFE8DE] rounded-full px-4 py-2 flex items-center gap-2.5 border border-[#E0D5C7] shadow-inner transition-all focus-within:border-[#1B2A4A]">
            <Search size={18} className="text-[#57534E] flex-shrink-0" />
            <input 
              type="text" 
              placeholder="Tìm kiếm sách, tác giả trong thư viện..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-sm font-semibold text-[#1C1917] placeholder-[#57534E] focus:outline-none"
            />
          </div>

          {/* Action Buttons: Tìm Online (Opens Assistant) & Upload Pill */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={() => setIsChatOpen(prev => !prev)}
              className={`px-5 py-2.5 rounded-full font-black text-xs sm:text-sm tracking-wide shadow-md active:scale-95 cursor-pointer whitespace-nowrap flex items-center gap-2 transition-all ${
                isChatOpen 
                  ? 'bg-[#131E33] !text-white ring-2 ring-[#1B2A4A]/40' 
                  : 'btn-gradient !text-white'
              }`}
              title="Mở Trợ lý Tìm Sách Online"
            >
              <Sparkles size={15} className="!text-white stroke-white" />
              <span className="!text-white">Tìm Online</span>
            </button>

            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="w-10 h-10 rounded-full bg-[#EFE8DE] hover:bg-[#E5DACD] border border-[#E0D5C7] flex items-center justify-center text-[#1C1917] transition-all cursor-pointer shadow-sm hover:scale-105"
              title="Tải sách từ máy lên"
            >
              <Upload size={16} />
            </button>
          </div>
        </header>

        {/* CATEGORIES / BOOK FORMAT ROW (PINNED) */}
        <div className="flex-shrink-0 flex items-center gap-2.5 overflow-x-auto no-scrollbar py-1">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const active = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex flex-col items-center gap-1.5 px-3.5 py-2 rounded-2xl transition-all flex-shrink-0 cursor-pointer ${
                  active 
                    ? 'bg-[#1B2A4A] !text-white shadow-md border border-[#1B2A4A] scale-105' 
                    : 'bg-[#EFE8DE] text-[#1C1917] border border-[#E0D5C7] hover:bg-[#E5DACD] opacity-90 hover:opacity-100'
                }`}
              >
                <div 
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-xs transition-colors ${
                    active ? 'bg-white/20 text-white' : 'bg-[#E5DACD] text-[#1C1917]'
                  }`}
                >
                  <Icon size={16} className={active ? '!text-white stroke-white' : ''} />
                </div>
                <span className={`text-[11px] font-bold ${active ? '!text-white font-black' : 'text-[#1C1917]'}`}>
                  {cat.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* "POPULAR" SECTION HEADER (PINNED) */}
        <div className="flex-shrink-0 flex items-center justify-between pt-2 pb-2">
          <h2 className="text-xl md:text-2xl font-black text-[#1C1917] tracking-tight">
            Sách Nổi Bật
          </h2>
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-[#EFE8DE] border border-[#E0D5C7] rounded-full text-xs font-bold px-3.5 py-1.5 text-[#1C1917] cursor-pointer focus:outline-none shadow-sm"
            >
              <option value="newest">Mới nhất</option>
              <option value="author">Theo tác giả</option>
              <option value="a-z">A ➔ Z</option>
              <option value="z-a">Z ➔ A</option>
            </select>
          </div>
        </div>

        {/* SCROLLABLE INNER CONTAINER (ONLY THIS SCROLLS!) */}
        <div className="flex-1 overflow-y-auto no-scrollbar pr-1 pb-4 space-y-6">
          {/* BOOKSHELF DISPLAY */}
          <section className="min-h-[300px]">
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
              <div className="flex flex-col items-center justify-center py-16 text-center text-[#57534E]">
                <BookOpen size={40} className="text-[#C8BAA9] mb-3" />
                <p className="font-bold text-base text-[#1C1917]">Không tìm thấy cuốn sách nào</p>
                <p className="text-xs text-[#57534E] mt-1">
                  Hãy thử bấm &ldquo;Tìm Online&rdquo; ở góc trên để nhờ Trợ lý tìm kiếm từ kho sách trực tuyến!
                </p>
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
                  className="px-6 py-2.5 bg-[#EFE8DE] hover:bg-[#E2D7C8] border border-[#E0D5C7] rounded-full text-xs font-bold text-[#1C1917] shadow-sm transition-all cursor-pointer"
                >
                  {isLoadingMore ? 'Đang tải thêm...' : 'Xem thêm sách'}
                </button>
              </div>
            )}
          </section>

          {/* PROMO BESTSELLERS BANNER & CURATED MINI LISTS */}
          <section className="pt-6 border-t border-[#EAE2D5] grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left Promo Card */}
            <div className="lg:col-span-7 bg-[#EFE8DE] rounded-3xl p-6 flex items-center justify-between gap-4 border border-[#E0D5C7] shadow-sm">
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#1B2A4A] bg-[#EBF0F7] border border-[#D5E1F0] px-2.5 py-0.5 rounded-full">
                  Tuyển chọn 2026
                </span>
                <h3 className="text-base sm:text-lg font-black text-[#1C1917] leading-tight">
                  Top 50 Tác Phẩm Đọc Nhiều Nhất
                </h3>
                <p className="text-xs text-[#57534E] leading-relaxed max-w-sm">
                  Tổng hợp những cuốn sách được cộng đồng bạn đọc đánh giá cao và tải về nhiều nhất trên BookCase.
                </p>
                <div className="pt-1">
                  <button 
                    onClick={() => setIsChatOpen(true)}
                    className="bg-[#1B2A4A] hover:bg-[#131E33] !text-white px-4 py-2 rounded-full text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <Eye size={13} className="!text-white stroke-white" />
                    <span className="!text-white">Tìm qua Trợ lý ngay</span>
                  </button>
                </div>
              </div>

              {/* Decorative Book Stack graphic in Navy & Charcoal */}
              <div className="hidden sm:flex flex-col items-center gap-1 opacity-85 flex-shrink-0">
                <div className="w-20 h-5 bg-[#1B2A4A] rounded-md shadow-xs border-r-4 border-white/40" />
                <div className="w-24 h-5 bg-[#2B2B2E] rounded-md shadow-xs border-r-4 border-white/40" />
                <div className="w-22 h-5 bg-[#16243E] rounded-md shadow-xs border-r-4 border-white/40" />
                <div className="w-26 h-5 bg-[#3D3D42] rounded-md shadow-xs border-r-4 border-white/40" />
                <div className="w-28 h-5 bg-[#1B2A4A] rounded-md shadow-xs border-r-4 border-white/40" />
              </div>
            </div>

            {/* Right Mini Curated Cards */}
            <div className="lg:col-span-5 flex flex-col justify-between gap-2.5">
              <div 
                onClick={() => { setSelectedCategory('classic'); }}
                className="bg-[#FFFFFF] hover:bg-[#FAF6F0] p-3 rounded-2xl border border-[#ECE2D5] flex items-center gap-3 cursor-pointer transition-all shadow-2xs hover:scale-[1.01]"
              >
                <div className="w-9 h-9 rounded-xl bg-[#EBF0F7] text-[#1B2A4A] flex items-center justify-center flex-shrink-0 font-bold">
                  <Feather size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-black text-[#1C1917] truncate">Top 50 Sách Kinh Điển</h4>
                  <p className="text-[11px] text-[#57534E] truncate">Những áng văn trường tồn với thời gian</p>
                </div>
                <ChevronRight size={16} className="text-[#A89F95]" />
              </div>

              <div 
                onClick={() => { setSelectedCategory('selfhelp'); }}
                className="bg-[#FFFFFF] hover:bg-[#FAF6F0] p-3 rounded-2xl border border-[#ECE2D5] flex items-center gap-3 cursor-pointer transition-all shadow-2xs hover:scale-[1.01]"
              >
                <div className="w-9 h-9 rounded-xl bg-[#EFE8DE] text-[#1C1917] flex items-center justify-center flex-shrink-0 font-bold">
                  <GraduationCap size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-black text-[#1C1917] truncate">Top Sách Phát Triển Bản Thân</h4>
                  <p className="text-[11px] text-[#57534E] truncate">Tư duy, năng suất và bài học cuộc sống</p>
                </div>
                <ChevronRight size={16} className="text-[#A89F95]" />
              </div>

              <div 
                onClick={() => { setSelectedCategory('scifi'); }}
                className="bg-[#FFFFFF] hover:bg-[#FAF6F0] p-3 rounded-2xl border border-[#ECE2D5] flex items-center gap-3 cursor-pointer transition-all shadow-2xs hover:scale-[1.01]"
              >
                <div className="w-9 h-9 rounded-xl bg-[#EBF0F7] text-[#1B2A4A] flex items-center justify-center flex-shrink-0 font-bold">
                  <Compass size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-black text-[#1C1917] truncate">Top Khoa Học & Viễn Tưởng</h4>
                  <p className="text-[11px] text-[#57534E] truncate">Khám phá tương lai và vũ trụ</p>
                </div>
                <ChevronRight size={16} className="text-[#A89F95]" />
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* 3. TRỢ LÝ TÌM SÁCH ONLINE DRAWER (CHỈ HIỆN KHI BẤM "TÌM ONLINE") */}
      {isChatOpen && (
        <div 
          onClick={() => setIsChatOpen(false)} 
          className="fixed inset-0 bg-black/25 backdrop-blur-[2px] z-40 xl:hidden transition-opacity"
        />
      )}

      <aside className={`
        fixed top-0 right-0 h-full w-full sm:w-[420px] md:w-[460px] p-3 sm:p-4 z-50
        transition-transform duration-300 ease-in-out
        ${isChatOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'}
      `}>
        <div className="bg-[#FAF6F0] h-full rounded-[32px] p-4 sm:p-5 shadow-[0_20px_60px_rgba(120,100,85,0.22)] border border-[#ECE2D5] flex flex-col gap-3 overflow-hidden">
          
          {/* Assistant Header */}
          <div className="flex items-center justify-between pb-2 border-b border-[#EBE2D5] flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-[#1B2A4A] flex items-center justify-center text-white shadow-xs">
                <Sparkles size={16} className="!text-white stroke-white" />
              </div>
              <div>
                <h3 className="font-black text-sm sm:text-base text-[#1C1917] flex items-center gap-1.5">
                  Trợ Lý Tìm Sách Online
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </h3>
                <p className="text-[10px] text-[#57534E] font-medium">Tìm và tải sách trực tiếp vào kệ</p>
              </div>
            </div>
            
            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => setIsSearchOnlineOpen(true)}
                className="p-2 rounded-full bg-[#EFE8DE] hover:bg-[#E5DACD] text-[#57534E] hover:text-[#1C1917] transition-colors cursor-pointer"
                title="Mở giao diện tìm kiếm dạng bảng"
              >
                <ExternalLink size={15} />
              </button>
              <button 
                onClick={() => setIsChatOpen(false)}
                className="w-8 h-8 rounded-full bg-[#EFE8DE] hover:bg-[#E5DACD] text-[#57534E] hover:text-[#1C1917] flex items-center justify-center transition-colors cursor-pointer font-bold text-sm"
                title="Đóng trợ lý"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Source Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 flex-shrink-0 text-xs">
            <button
              type="button"
              onClick={() => setAssistantSource('all')}
              className={`px-3 py-1.5 rounded-full font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 border shadow-2xs ${
                assistantSource === 'all'
                  ? 'bg-[#1B2A4A] !text-white border-[#1B2A4A]'
                  : 'bg-[#EFE8DE] text-[#57534E] border-[#E0D5C7] hover:bg-[#E5DACD]'
              }`}
            >
              <Layers size={12} className={assistantSource === 'all' ? '!text-white stroke-white' : ''} />
              <span className={assistantSource === 'all' ? '!text-white' : ''}>Tất cả nguồn</span>
            </button>

            <button
              type="button"
              onClick={() => setAssistantSource('zlib')}
              className={`px-3 py-1.5 rounded-full font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 border shadow-2xs ${
                assistantSource === 'zlib'
                  ? 'bg-[#1B2A4A] !text-white border-[#1B2A4A]'
                  : 'bg-[#EFE8DE] text-[#57534E] border-[#E0D5C7] hover:bg-[#E5DACD]'
              }`}
            >
              <Pencil size={12} className={assistantSource === 'zlib' ? '!text-white stroke-white' : ''} />
              <span className={assistantSource === 'zlib' ? '!text-white' : ''}>Server bút chì</span>
            </button>

            <button
              type="button"
              onClick={() => setAssistantSource('cloudily')}
              className={`px-3 py-1.5 rounded-full font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 border shadow-2xs ${
                assistantSource === 'cloudily'
                  ? 'bg-[#1B2A4A] !text-white border-[#1B2A4A]'
                  : 'bg-[#EFE8DE] text-[#57534E] border-[#E0D5C7] hover:bg-[#E5DACD]'
              }`}
            >
              <PenTool size={12} className={assistantSource === 'cloudily' ? '!text-white stroke-white' : ''} />
              <span className={assistantSource === 'cloudily' ? '!text-white' : ''}>Server bút mực</span>
            </button>
          </div>

          {/* Quick Suggestions Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 flex-shrink-0">
            {['Higashino Keigo', 'Kinh điển', 'Haruki Murakami', 'Trinh thám', 'Tâm lý học'].map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => handleAssistantSearch(tag)}
                className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#EFE8DE] text-[#57534E] hover:text-[#1C1917] hover:bg-[#E2D7C8] border border-[#E0D5C7] whitespace-nowrap transition-all cursor-pointer"
              >
                {tag}
              </button>
            ))}
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto no-scrollbar space-y-3.5 pr-1 text-xs">
            {chatMessages.map((msg) => (
              <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                <div 
                  className={`max-w-[92%] p-3.5 rounded-2xl leading-relaxed ${
                    msg.sender === 'user' 
                      ? 'bg-[#1B2A4A] !text-white rounded-br-xs shadow-xs font-medium' 
                      : 'bg-[#FFFFFF] text-[#1C1917] rounded-bl-xs shadow-xs border border-[#ECE2D5]'
                  }`}
                >
                  <p className={msg.sender === 'user' ? '!text-white' : 'text-[#1C1917]'}>{msg.text}</p>

                  {/* Online Search Results inside Message */}
                  {msg.onlineResults && msg.onlineResults.length > 0 && (
                    <div className="mt-3 space-y-2 border-t border-[#ECE2D5] pt-2.5">
                      {msg.onlineResults.map((item: any) => {
                        const isImported = importedBookIds.includes(item.id);
                        const isImporting = importingBookId === item.id;
                        const isPencil = item.id.startsWith('/book_') || item.id.startsWith('zlib|');

                        return (
                          <div 
                            key={item.id}
                            className="bg-[#FAF6F0] p-2.5 rounded-xl border border-[#ECE2D5] flex items-center justify-between gap-2.5 hover:border-[#D5C7B8] transition-all"
                          >
                            <div className="min-w-0 flex-1">
                              <h5 className="font-black text-[11px] text-[#1C1917] truncate" title={item.title}>
                                {item.title.replace(/^\[.*?\]\s*/, '')}
                              </h5>
                              <p className="text-[10px] text-[#57534E] truncate mt-0.5">
                                {item.author || 'Tác giả chưa rõ'}
                              </p>
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold ${
                                  isPencil ? 'bg-[#EBF0F7] text-[#1B2A4A]' : 'bg-[#F2ECE4] text-[#57534E]'
                                }`}>
                                  {isPencil ? 'Bút chì' : 'Bút mực'}
                                </span>
                                {(item.extension || item.ext) && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold bg-[#EFE8DE] text-[#57534E] uppercase">
                                    {item.extension || item.ext}
                                  </span>
                                )}
                                {(item.filesize || item.size) && (
                                  <span className="text-[9px] text-[#8C827A]">
                                    {item.filesize || item.size}
                                  </span>
                                )}
                              </div>
                            </div>

                            <button
                              onClick={() => handleAssistantImport(item)}
                              disabled={isImported || isImporting}
                              className={`px-3 py-1.5 rounded-full text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer flex-shrink-0 ${
                                isImported
                                  ? 'bg-emerald-600 !text-white cursor-default'
                                  : isImporting
                                  ? 'bg-[#1B2A4A] !text-white opacity-80 cursor-wait'
                                  : 'bg-[#1B2A4A] hover:bg-[#131E33] !text-white shadow-2xs active:scale-95'
                              }`}
                            >
                              {isImporting ? (
                                <>
                                  <Loader2 size={11} className="animate-spin !text-white" />
                                  <span className="!text-white">Đang tải...</span>
                                </>
                              ) : isImported ? (
                                <>
                                  <Check size={11} className="!text-white" />
                                  <span className="!text-white">Đã thêm</span>
                                </>
                              ) : (
                                <>
                                  <Download size={11} className="!text-white stroke-white" />
                                  <span className="!text-white">Tải về tủ</span>
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Local library matches */}
                  {msg.localResults && msg.localResults.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-[#ECE2D5]">
                      <p className="text-[10px] font-bold text-[#57534E] mb-1.5">Sách sẵn có trong thư viện của bạn:</p>
                      <div className="space-y-1.5">
                        {msg.localResults.map((lb: any) => (
                          <div key={lb.id} className="bg-[#FAF6F0] p-2 rounded-lg border border-[#ECE2D5] flex items-center justify-between">
                            <div className="min-w-0 flex-1 pr-2">
                              <p className="font-black text-[11px] text-[#1C1917] truncate">{lb.title}</p>
                              <p className="text-[10px] text-[#57534E] truncate">{lb.author}</p>
                            </div>
                            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                              Đã có sẵn
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isSearchingAssistant && (
              <div className="flex items-center gap-2 p-3 bg-white rounded-2xl border border-[#ECE2D5] w-fit shadow-xs animate-pulse">
                <Loader2 size={14} className="animate-spin text-[#1B2A4A]" />
                <span className="text-xs font-bold text-[#57534E]">
                  Đang tìm kiếm trên {assistantSource === 'all' ? 'kho sách trực tuyến' : assistantSource === 'zlib' ? 'Server bút chì' : 'Server bút mực'}...
                </span>
              </div>
            )}
          </div>

          {/* Chat Input Bar */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleAssistantSearch(chatInput);
            }} 
            className="bg-[#EFE8DE] rounded-full p-1.5 pl-4 flex items-center gap-2 border border-[#E0D5C7] shadow-inner flex-shrink-0"
          >
            <input 
              type="text" 
              placeholder="Nhập tên sách hoặc tác giả cần tìm..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="flex-1 bg-transparent text-xs font-semibold text-[#1C1917] placeholder-[#57534E] focus:outline-none"
            />
            <button 
              type="submit"
              disabled={!chatInput.trim() || isSearchingAssistant}
              className="w-8 h-8 rounded-full bg-[#1B2A4A] hover:bg-[#131E33] !text-white flex items-center justify-center shadow-sm disabled:opacity-40 transition-transform active:scale-95 cursor-pointer flex-shrink-0"
              title="Gửi tìm kiếm"
            >
              <Send size={13} className="ml-0.5 !text-white stroke-white" />
            </button>
          </form>

        </div>
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
