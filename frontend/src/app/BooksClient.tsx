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
  Send, 
  Sparkles, 
  X,
  ExternalLink,
  Download,
  Check,
  Loader2
} from 'lucide-react';
import { useAuth } from '@/app/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import axios from 'axios';



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
      // Connect directly to the existing external-search endpoint linked with Telegram Bot & sources
      const res = await axios.get(`${API_URL}/api/external-search`, {
        params: {
          q: cleanQuery,
          source: 'all'
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
            text: `Tôi đã tìm thấy ${onlineResults.length} bản sách trực tuyến từ các máy chủ liên kết cho "${cleanQuery}". Bạn có thể bấm "Tải về tủ" để thêm ngay vào kệ sách:`,
            onlineResults: onlineResults.slice(0, 8),
            localResults: localMatches.length > 0 ? localMatches : undefined
          }
        ]);
      } else {
        setChatMessages(prev => [
          ...prev,
          {
            id: botMsgId,
            sender: 'bot',
            text: `Không tìm thấy sách phù hợp với "${cleanQuery}". Bạn thử đổi từ khóa tìm kiếm (tên tiếng Anh, tên tác phẩm đầy đủ hoặc họ tên tác giả) nhé!`,
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

  // Books list
  const filteredBooks = books;

  if (isLoading || !user) {
    return (
      <div className="fixed top-0 inset-x-0 w-full h-[100dvh] bg-[#D8C9BB] flex items-center justify-center font-bold text-[#1C1917] touch-none overscroll-none">
        Đang tải BookCase...
      </div>
    );
  }

  return (
    <div className="fixed top-0 inset-x-0 w-full h-[100dvh] max-h-[100dvh] overflow-hidden overscroll-none touch-none bg-[#D8C9BB] pt-[60px] pb-1 px-1.5 sm:pt-[76px] sm:pb-3 sm:px-3 md:relative md:top-auto md:h-screen md:p-5 md:touch-auto flex flex-col md:flex-row gap-2 sm:gap-3 md:gap-4 lg:gap-5 font-sans selection:bg-[#1B2A4A]/20 selection:text-[#1C1917]">
      
      {/* 1. LEFT COLUMN: FLOATING PILL DOCK */}
      <Sidebar />

      {/* 2. CENTER COLUMN: MAIN BOARD CONTAINER */}
      <main className="flex-1 w-full bg-[#FBF8F4] rounded-[24px] sm:rounded-[28px] md:rounded-[36px] p-2.5 sm:p-5 md:p-7 shadow-[0_16px_40px_rgba(120,100,85,0.12)] border border-[#EFE8DE] flex flex-col overflow-hidden min-w-0 transition-all duration-300">
        
        {/* TOP SEARCH & ACTION BAR (PINNED) */}
        <header className="flex-shrink-0 flex items-center justify-between gap-2 pb-1 touch-none">
          {/* Pill Search Input */}
          <div className="flex-1 bg-[#EFE8DE] rounded-full px-3 py-1.5 flex items-center gap-2 border border-[#E0D5C7] shadow-inner transition-all focus-within:border-[#1B2A4A]">
            <Search size={15} className="text-[#57534E] flex-shrink-0" />
            <input 
              type="text" 
              placeholder="Tìm kiếm sách, tác giả..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-xs font-semibold text-[#1C1917] placeholder-[#57534E] focus:outline-none touch-auto"
            />
          </div>

          {/* Action Buttons: Tìm Online (Opens Assistant) & Upload Pill */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => setIsChatOpen(prev => !prev)}
              className={`px-3 py-1.5 rounded-full font-black text-xs tracking-wide shadow-sm active:scale-95 cursor-pointer whitespace-nowrap flex items-center gap-1.5 transition-all ${
                isChatOpen 
                  ? 'bg-[#131E33] !text-white ring-2 ring-[#1B2A4A]/40' 
                  : 'btn-gradient !text-white'
              }`}
              title="Mở Trợ lý Tìm Sách Online"
            >
              <Sparkles size={13} className="!text-white stroke-white" />
              <span className="!text-white text-xs">Tìm Online</span>
            </button>

            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="w-8 h-8 rounded-full bg-[#EFE8DE] hover:bg-[#E5DACD] border border-[#E0D5C7] flex items-center justify-center text-[#1C1917] transition-all cursor-pointer shadow-sm hover:scale-105"
              title="Tải sách từ máy lên"
            >
              <Upload size={14} />
            </button>
          </div>
        </header>



        {/* "POPULAR" SECTION HEADER (PINNED) */}
        <div className="flex-shrink-0 flex items-center justify-between pt-0.5 pb-1 touch-none">
          <h2 className="text-sm sm:text-xl md:text-2xl font-black text-[#1C1917] tracking-tight">
            Sách Nổi Bật
          </h2>
          <div className="flex items-center gap-1.5">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-[#EFE8DE] border border-[#E0D5C7] rounded-full text-[11px] sm:text-xs font-bold px-2.5 py-1 text-[#1C1917] cursor-pointer focus:outline-none shadow-sm touch-auto"
            >
              <option value="newest">Mới nhất</option>
              <option value="author">Theo tác giả</option>
              <option value="a-z">A ➔ Z</option>
              <option value="z-a">Z ➔ A</option>
            </select>
          </div>
        </div>

        {/* SCROLLABLE INNER CONTAINER (ONLY THIS SCROLLS!) */}
        <div 
          className="flex-1 overflow-y-auto no-scrollbar pr-0.5 pt-1 pb-3 space-y-3 overscroll-contain touch-pan-y"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {/* BOOKSHELF DISPLAY */}
          <section className="min-h-[300px] pt-1">
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

        </div>
      </main>

      {/* 3. TRỢ LÝ TÌM SÁCH ONLINE DRAWER (SCALES UI) */}
      <aside className={`
        relative flex-shrink-0 z-40
        transition-all duration-300 ease-in-out overflow-hidden
        md:h-full
        ${isChatOpen 
          ? 'h-[55vh] md:h-full w-full md:w-[420px] lg:w-[460px] opacity-100' 
          : 'h-0 md:h-full md:w-0 opacity-0'}
      `}>
        <div className="w-full h-full bg-[#FAF6F0] rounded-[28px] md:rounded-[32px] p-4 sm:p-5 shadow-[0_-10px_40px_rgba(120,100,85,0.12)] md:shadow-[0_20px_60px_rgba(120,100,85,0.22)] border border-[#ECE2D5] flex flex-col gap-3 overflow-hidden">
          
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



          {/* Messages Area */}
          <div 
            className="flex-1 overflow-y-auto no-scrollbar space-y-3.5 pr-1 text-xs overscroll-contain touch-pan-y"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
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
                        const isCloudily = item.id.startsWith('cloudily|');
                        const sourceLabel = isPencil ? 'Bút chì' : isCloudily ? 'Bút mực' : 'Thư viện mở';

                        // 1. Clean title
                        const cleanTitle = (item.title || '')
                          .replace(/^\[.*?\]\s*/, '')
                          .replace(/\*\*/g, '')
                          .replace(/__/g, '')
                          .trim();

                        // 2. Clean author and hide Cloudily Bot / Z-Library Bot
                        let rawAuthor = (item.author || '')
                          .replace(/\*\*/g, '')
                          .replace(/^__+|__+$/g, '')
                          .trim();

                        if (
                          !rawAuthor || 
                          /cloudily/i.test(rawAuthor) || 
                          /z-?library/i.test(rawAuthor) || 
                          /^bot$/i.test(rawAuthor)
                        ) {
                          rawAuthor = '';
                        }

                        // 3. Move file size to the same line as Year / Author separated by |
                        const fileSize = item.filesize || item.size || '';
                        let subline = '';
                        if (rawAuthor && fileSize) {
                          subline = `${rawAuthor} | ${fileSize}`;
                        } else if (rawAuthor) {
                          subline = rawAuthor;
                        } else if (fileSize) {
                          subline = fileSize;
                        }

                        // 4. Format book language
                        const getBookLanguage = (it: any) => {
                          const l = (it.language || '').toLowerCase().trim();
                          if (l.includes('viet') || it.id?.startsWith('cloudily|')) return 'Tiếng Việt';
                          if (l.includes('eng') || l === 'en') return 'Tiếng Anh';
                          if (l.includes('fre') || l === 'fr') return 'Tiếng Pháp';
                          if (l.includes('ger') || l === 'de') return 'Tiếng Đức';
                          if (l.includes('chi') || l === 'zh') return 'Tiếng Trung';
                          if (l.includes('jap') || l === 'ja') return 'Tiếng Nhật';
                          if (l.includes('rus') || l === 'ru') return 'Tiếng Nga';
                          if (l.includes('kor') || l === 'ko') return 'Tiếng Hàn';
                          if (l.includes('spa') || l === 'es') return 'Tiếng TBN';
                          if (it.language && it.language !== 'Đa ngôn ngữ' && it.language !== 'Toàn cầu / Miễn phí') {
                            return it.language;
                          }
                          if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(it.title || '')) {
                            return 'Tiếng Việt';
                          }
                          return 'Tiếng Anh';
                        };
                        const bookLang = getBookLanguage(item);

                        return (
                          <div 
                            key={item.id}
                            className="bg-[#FAF6F0] p-2.5 rounded-xl border border-[#ECE2D5] flex items-center justify-between gap-2.5 hover:border-[#D5C7B8] transition-all"
                          >
                            <div className="min-w-0 flex-1">
                              <h5 className="font-black text-[11px] text-[#1C1917] truncate" title={cleanTitle}>
                                {cleanTitle}
                              </h5>
                              {subline && (
                                <p className="text-[10px] font-semibold text-[#57534E] truncate mt-0.5">
                                  {subline}
                                </p>
                              )}
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold ${
                                  isPencil ? 'bg-[#EBF0F7] text-[#1B2A4A]' : isCloudily ? 'bg-[#F2ECE4] text-[#57534E]' : 'bg-[#E8F5E9] text-emerald-800'
                                }`}>
                                  {sourceLabel}
                                </span>
                                {(item.extension || item.ext) && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold bg-[#EFE8DE] text-[#57534E] uppercase">
                                    {item.extension || item.ext}
                                  </span>
                                )}
                                {bookLang && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold bg-[#FAF0E6] text-[#785434] border border-[#E8D8C8]">
                                    {bookLang}
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
                                  <span className="!text-white">Tải về</span>
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
            className="bg-[#EFE8DE] rounded-full p-1.5 pl-4 flex items-center gap-2 border border-[#E0D5C7] shadow-inner flex-shrink-0 touch-auto"
          >
            <input 
              type="text" 
              placeholder="Nhập tên sách hoặc tác giả cần tìm..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="flex-1 bg-transparent text-xs font-semibold text-[#1C1917] placeholder-[#57534E] focus:outline-none touch-auto"
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
