'use client';
import { useState, useEffect, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import Bookshelf from '@/components/Bookshelf';
import SearchOnlineModal from '@/components/SearchOnlineModal';
import UploadModal from '@/components/UploadModal';
import BookCoverImage from '@/components/BookCoverImage';
import { 
  Search, 
  Bell, 
  ArrowUpRight, 
  ArrowLeft, 
  ArrowRight, 
  MoreHorizontal, 
  Info, 
  Grid, 
  SlidersHorizontal,
  Loader2,
  Plus,
  BookOpen,
  Sparkles,
  Download,
  Smartphone,
  Star,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/app/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import KindleTransferModal from '@/components/KindleTransferModal';
import BookRatingModal from '@/components/BookRatingModal';

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
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'carousel' | 'grid'>('carousel');
  const [selectedBookDetail, setSelectedBookDetail] = useState<any | null>(null);
  const [kindleBook, setKindleBook] = useState<{ id: string; title: string } | null>(null);
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  
  // Pagination & cold start
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isColdStart, setIsColdStart] = useState(false);

  const carouselRef = useRef<HTMLDivElement>(null);
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const fetchBooks = async (isLoadMore = false) => {
    try {
      if (!isLoadMore) setIsLoadingBooks(true);
      const currentSkip = isLoadMore ? (page + 1) * 30 : 0;
      
      const coldTimer = setTimeout(() => {
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

      clearTimeout(coldTimer);
      setIsColdStart(false);

      if (res.data && Array.isArray(res.data)) {
        if (!isLoadMore) {
          setBooks(res.data);
          setPage(0);
          setActiveIndex(0);
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
      }, 350);
      return () => clearTimeout(delayTimer);
    }
  }, [user, searchQuery, sortBy]);

  const activeBook = books && books.length > 0 ? books[Math.min(activeIndex, books.length - 1)] : null;

  const handlePrev = () => {
    setActiveIndex(prev => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setActiveIndex(prev => Math.min(books.length - 1, prev + 1));
  };

  const handleDownload = (id: string) => {
    setDownloadingId(id);
    const url = `${API_URL}/api/books/${id}/download`;
    window.location.href = url;
    setTimeout(() => setDownloadingId(null), 1500);
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-[#EDE8E3] flex items-center justify-center font-bold text-[#66615E]">
        <div className="flex items-center gap-2">
          <Loader2 size={20} className="animate-spin text-[#DE5448]" />
          <span>Đang tải BookCase...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EDE8E3] flex text-[#1D1C1A] selection:bg-[#DE5448]/20 selection:text-[#1D1C1A]">
      {/* Slim Vertical Left Navigation Rail */}
      <Sidebar />

      {/* Main Screen Container with Tablet Frame Effect */}
      <div className="flex-1 md:ml-20 min-h-screen p-2.5 sm:p-4 md:p-6 lg:p-7 flex flex-col justify-between">
        <div className="w-full bg-[#FAF7F2] rounded-[24px] sm:rounded-[32px] border border-[#E5DFD7] p-4 sm:p-6 md:p-8 lg:p-10 shadow-[0_20px_50px_-15px_rgba(35,28,20,0.06)] min-h-[calc(100vh-3.5rem)] flex flex-col justify-between overflow-hidden">
          
          {/* 1. TOP HEADER BAR */}
          <header className="flex items-center justify-between gap-4 pb-6 border-b border-[#E5DFD7]/60">
            {/* Search Input Bar */}
            <div className="relative flex-1 max-w-xs sm:max-w-sm md:max-w-md">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9E9791]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search book name, author, edition ..."
                className="w-full bg-[#F3EFEA] hover:bg-[#EFEAE4] focus:bg-white text-xs sm:text-sm font-medium text-[#1D1C1A] placeholder-[#9E9791] pl-10 sm:pl-11 pr-4 py-2 sm:py-2.5 rounded-full border border-transparent focus:border-[#E5DFD7] outline-none transition-all shadow-inner"
              />
            </div>

            {/* Right Header Tools & User Profile */}
            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
              {/* Add & Online Search Buttons */}
              <button
                onClick={() => setIsSearchOnlineOpen(true)}
                className="hidden lg:flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold text-[#1D1C1A] bg-[#F3EFEA] hover:bg-[#EFEAE4] border border-[#E5DFD7] transition-colors cursor-pointer"
                title="Tìm sách từ các nguồn online"
              >
                <Sparkles size={13} className="text-[#DE5448]" />
                <span>Tìm Online</span>
              </button>

              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold text-white bg-[#1D1C1A] hover:bg-black transition-colors cursor-pointer shadow-sm"
                title="Tải sách từ máy lên"
              >
                <Plus size={14} />
                <span>Nạp sách</span>
              </button>

              {/* View Toggle (Carousel ⇄ Grid) */}
              <div className="bg-[#F3EFEA] p-1 rounded-full border border-[#E5DFD7] flex items-center">
                <button
                  onClick={() => setViewMode('carousel')}
                  className={`p-1.5 rounded-full transition-all ${viewMode === 'carousel' ? 'bg-white shadow-sm text-[#1D1C1A]' : 'text-[#9E9791] hover:text-[#1D1C1A]'}`}
                  title="Chế độ Showcase Trình diễn"
                >
                  <SlidersHorizontal size={14} />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-full transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-[#1D1C1A]' : 'text-[#9E9791] hover:text-[#1D1C1A]'}`}
                  title="Chế độ Thư viện lưới"
                >
                  <Grid size={14} />
                </button>
              </div>

              {/* User Avatar, Name & Bell */}
              <div className="flex items-center gap-2.5 pl-1 sm:pl-2 border-l border-[#E5DFD7]">
                <div className="w-8 h-8 rounded-full overflow-hidden border border-[#E5DFD7] bg-[#EFEAE4] flex-shrink-0">
                  <img 
                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username || 'user'}`} 
                    alt="User Avatar" 
                    className="w-full h-full object-cover" 
                  />
                </div>
                <span className="font-bold text-xs sm:text-sm text-[#1D1C1A] hidden md:inline truncate max-w-[120px]">
                  {user?.username || 'Alexander Mark'}
                </span>
                <button 
                  className="p-1.5 sm:p-2 text-[#66615E] hover:text-[#1D1C1A] hover:bg-[#F3EFEA] rounded-full transition-colors cursor-pointer"
                  title="Thông báo"
                >
                  <Bell size={17} />
                </button>
              </div>
            </div>
          </header>

          {/* 2. MAIN CONTENT AREA */}
          {isLoadingBooks && books.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-24">
              <Loader2 size={32} className="animate-spin text-[#DE5448] mb-3" />
              <p className="text-sm font-bold text-[#66615E]">Đang tải thư viện sách...</p>
            </div>
          ) : books.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-[#F3EFEA] flex items-center justify-center mb-4 text-[#9E9791]">
                <BookOpen size={28} />
              </div>
              <h3 className="text-xl font-bold text-[#1D1C1A] mb-1">Thư viện chưa có cuốn sách nào</h3>
              <p className="text-xs text-[#66615E] max-w-sm mb-5">
                Hãy tìm kiếm online hoặc nạp file EPUB/PDF để bắt đầu hành trình đọc sách của bạn.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsSearchOnlineOpen(true)}
                  className="px-5 py-2.5 bg-[#DE5448] text-white rounded-full text-xs font-bold shadow-md hover:bg-[#c9453a] transition-all"
                >
                  Tìm Sách Online
                </button>
                <button
                  onClick={() => setIsUploadModalOpen(true)}
                  className="px-5 py-2.5 bg-[#1D1C1A] text-white rounded-full text-xs font-bold shadow-md hover:bg-black transition-all"
                >
                  Nạp File Lên
                </button>
              </div>
            </div>
          ) : viewMode === 'grid' ? (
            /* FULL GRID LIBRARY VIEW */
            <div className="flex-1 py-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-[#1D1C1A]">Tất cả sách ({books.length})</h2>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-[#F3EFEA] border border-[#E5DFD7] text-xs font-bold rounded-xl px-3 py-1.5 text-[#1D1C1A] outline-none cursor-pointer"
                >
                  <option value="newest">Mới nhất</option>
                  <option value="author">Theo tác giả</option>
                  <option value="a-z">Tên sách: A - Z</option>
                  <option value="z-a">Tên sách: Z - A</option>
                </select>
              </div>
              <Bookshelf books={books} refresh={() => fetchBooks(false)} sortBy={sortBy} />
            </div>
          ) : (
            /* EDITORIAL SHOWCASE VIEW (CONCEPT MATCHING) */
            <div className="flex-1 flex flex-col justify-between py-4 sm:py-6">
              
              {/* SPOTLIGHT HERO SECTION */}
              <div className="flex flex-col md:flex-row items-start justify-between gap-6 md:gap-12 pt-2 md:pt-4">
                {/* Left Column: Heading, Subtitle & Start Reading CTA */}
                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="flex-1 max-w-xl"
                >
                  <h1 className="text-3xl sm:text-4xl lg:text-[46px] font-extrabold text-[#1D1C1A] tracking-tight leading-[1.1]">
                    Keep the story going..
                  </h1>
                  <p className="text-xs sm:text-sm text-[#66615E] leading-relaxed mt-3 max-w-md font-medium">
                    Don&apos;t let the story end just yet. Continue reading your last book and immerse yourself in the world of literature.
                  </p>
                  <button 
                    onClick={() => {
                      if (activeBook) {
                        router.push(`/reader?book_id=${activeBook.id}`);
                      }
                    }}
                    className="mt-5 bg-[#1D1C1A] hover:bg-black text-white text-xs sm:text-sm font-bold py-2.5 px-6 rounded-full flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
                  >
                    <span>Start reading</span>
                    <ArrowUpRight size={15} />
                  </button>
                </motion.div>

                {/* Right Column: Author Spotlight & Literary Quote & Arrow Buttons */}
                <motion.div 
                  key={activeBook?.id || 'default'}
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4 }}
                  className="flex flex-col items-start md:items-end w-full md:max-w-md text-left md:text-right"
                >
                  <div className="flex items-center gap-3 mb-2.5">
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-[#E5DFD7] bg-[#EFEAE4] flex items-center justify-center font-bold text-xs text-[#1D1C1A] shadow-inner flex-shrink-0">
                      {activeBook?.author ? activeBook.author.substring(0, 2).toUpperCase() : 'AU'}
                    </div>
                    <div className="text-left">
                      <h4 className="font-extrabold text-sm sm:text-base text-[#1D1C1A] leading-tight truncate max-w-[200px]">
                        {activeBook?.author || "George RR Martin"}
                      </h4>
                      <span className="text-[11px] text-[#9E9791] font-medium block">author</span>
                    </div>
                    <button 
                      onClick={() => activeBook && setSelectedBookDetail(activeBook)}
                      className="p-1.5 text-[#9E9791] hover:text-[#1D1C1A] hover:bg-[#F3EFEA] rounded-full transition-colors cursor-pointer"
                      title="Chi tiết sách"
                    >
                      <MoreHorizontal size={18} />
                    </button>
                  </div>

                  <p className="text-xs text-[#66615E] italic leading-relaxed text-left md:text-right font-normal line-clamp-3 md:line-clamp-4 max-w-md">
                    &quot;{activeBook?.summary 
                      ? (activeBook.summary.length > 200 ? activeBook.summary.substring(0, 200) + '...' : activeBook.summary) 
                      : `\"${activeBook?.title || 'Cuốn sách này'}\" mang đến một câu chuyện văn học lôi cuốn, mở ra góc nhìn sâu sắc và hành trình kỳ thú.`}&quot;
                  </p>

                  {/* Carousel Navigation Arrows */}
                  <div className="flex items-center gap-2 mt-4 self-end">
                    <button 
                      onClick={handlePrev} 
                      disabled={activeIndex === 0}
                      className="w-8 h-8 rounded-full border border-[#E5DFD7] hover:border-[#1D1C1A] hover:bg-[#F3EFEA] flex items-center justify-center text-[#1D1C1A] disabled:opacity-30 disabled:hover:border-[#E5DFD7] transition-all cursor-pointer"
                      title="Cuốn trước"
                    >
                      <ArrowLeft size={14} />
                    </button>
                    <button 
                      onClick={handleNext} 
                      disabled={activeIndex >= books.length - 1}
                      className="w-8 h-8 rounded-full border border-[#E5DFD7] hover:border-[#1D1C1A] hover:bg-[#F3EFEA] flex items-center justify-center text-[#1D1C1A] disabled:opacity-30 disabled:hover:border-[#E5DFD7] transition-all cursor-pointer"
                      title="Cuốn tiếp theo"
                    >
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </motion.div>
              </div>

              {/* 3. 3D BOOK SHOWCASE CAROUSEL (SIGNATURE VISUAL) */}
              <div className="py-6 sm:py-8 my-auto overflow-hidden">
                <div 
                  ref={carouselRef}
                  className="flex items-end gap-6 sm:gap-8 md:gap-10 overflow-x-auto no-scrollbar py-6 px-4 select-none scroll-smooth"
                >
                  {books.map((book, idx) => {
                    const isCurrent = idx === activeIndex;
                    return (
                      <motion.div
                        key={book.id}
                        layout
                        onClick={() => {
                          setActiveIndex(idx);
                          if (isCurrent) {
                            setSelectedBookDetail(book);
                          }
                        }}
                        animate={{
                          scale: isCurrent ? 1.08 : 0.94,
                          y: isCurrent ? -8 : 0,
                          opacity: isCurrent ? 1 : 0.82
                        }}
                        whileHover={{ scale: isCurrent ? 1.1 : 0.98, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 350, damping: 25 }}
                        className="flex-shrink-0 cursor-pointer flex flex-col w-36 sm:w-44 md:w-52 group"
                      >
                        {/* Book 3D Hardcover Cover */}
                        <div className="w-full aspect-[2/3] relative rounded-r-md rounded-l-[2px] overflow-hidden">
                          <BookCoverImage
                            coverUrl={book.cover_url}
                            bookId={book.id}
                            title={book.title}
                            author={book.author}
                            isActive={isCurrent}
                          />
                        </div>

                        {/* Title & Author / Edition below */}
                        <div className="mt-3.5 px-0.5">
                          <h3 
                            className={`text-xs sm:text-sm font-extrabold text-[#1D1C1A] truncate tracking-tight ${
                              isCurrent ? 'text-[#1D1C1A]' : 'text-[#66615E] group-hover:text-[#1D1C1A]'
                            }`}
                            title={book.title}
                          >
                            {book.title}
                          </h3>
                          <p className="text-[11px] text-[#9E9791] italic truncate mt-0.5">
                            {book.author ? `${book.author}` : 'BookCase Edition'}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* 4. BOTTOM ANNOUNCEMENT & COUNTER BAR */}
          <footer className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#E5DFD7]/60 text-xs text-[#66615E]">
            {/* Announcement / Tip */}
            <div className="flex items-center gap-2 text-center sm:text-left">
              <Info size={14} className="text-[#DE5448] flex-shrink-0" />
              <p className="line-clamp-1">
                Khám phá bộ sưu tập sách hay hôm nay! Đọc trực tuyến hoặc nạp nhanh vào Kindle mọi lúc mọi nơi.
              </p>
            </div>

            {/* Book Counter */}
            <div className="flex items-center gap-1.5 flex-shrink-0 font-sans">
              <span className="text-[#DE5448] font-black text-sm">
                {String(Math.min(activeIndex + 1, books.length)).padStart(2, '0')}
              </span>
              <span className="text-[#9E9791] font-semibold text-xs">
                / {books.length} books
              </span>
            </div>
          </footer>

        </div>
      </div>

      {/* Book Detail & Action Modal (Styled in Warm Ivory) */}
      <AnimatePresence>
        {selectedBookDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#FAF7F2] rounded-3xl max-w-lg w-full p-6 md:p-8 border border-[#E5DFD7] shadow-2xl relative overflow-hidden"
            >
              <button
                onClick={() => setSelectedBookDetail(null)}
                className="absolute top-5 right-5 p-2 rounded-full text-[#66615E] hover:text-[#1D1C1A] hover:bg-[#EFEAE4] transition-colors"
              >
                <X size={18} />
              </button>

              <div className="flex gap-5 items-start">
                <div className="w-24 sm:w-28 aspect-[2/3] flex-shrink-0 rounded-r-md rounded-l-[2px] overflow-hidden book-3d-shadow">
                  <BookCoverImage
                    coverUrl={selectedBookDetail.cover_url}
                    bookId={selectedBookDetail.id}
                    title={selectedBookDetail.title}
                    author={selectedBookDetail.author}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-extrabold text-lg sm:text-xl text-[#1D1C1A] leading-tight">
                    {selectedBookDetail.title}
                  </h3>
                  <p className="text-xs text-[#66615E] italic mt-1">{selectedBookDetail.author || 'Tác giả chưa rõ'}</p>
                  
                  <p className="text-xs text-[#66615E] mt-3 line-clamp-4 leading-relaxed">
                    {selectedBookDetail.summary || 'Chưa có thông tin tóm tắt cho cuốn sách này.'}
                  </p>
                </div>
              </div>

              {/* Action Buttons in Modal */}
              <div className="grid grid-cols-2 gap-2.5 mt-6 pt-5 border-t border-[#E5DFD7]">
                <button
                  onClick={() => {
                    router.push(`/reader?book_id=${selectedBookDetail.id}`);
                  }}
                  className="col-span-2 py-3 bg-[#1D1C1A] hover:bg-black text-white text-xs sm:text-sm font-bold rounded-xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-98 cursor-pointer"
                >
                  <BookOpen size={16} />
                  <span>Đọc Sách Ngay</span>
                </button>

                <button
                  onClick={() => handleDownload(selectedBookDetail.id)}
                  className="py-2.5 bg-[#F3EFEA] hover:bg-[#EFEAE4] text-[#1D1C1A] text-xs font-bold rounded-xl border border-[#E5DFD7] flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {downloadingId === selectedBookDetail.id ? (
                    <Loader2 size={14} className="animate-spin text-[#DE5448]" />
                  ) : (
                    <Download size={14} />
                  )}
                  <span>Tải File</span>
                </button>

                <button
                  onClick={() => {
                    setKindleBook({ id: selectedBookDetail.id, title: selectedBookDetail.title });
                    setSelectedBookDetail(null);
                  }}
                  className="py-2.5 bg-[#F3EFEA] hover:bg-[#EFEAE4] text-[#1D1C1A] text-xs font-bold rounded-xl border border-[#E5DFD7] flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Smartphone size={14} />
                  <span>Gửi Kindle</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Online Search Modal */}
      <SearchOnlineModal 
        isOpen={isSearchOnlineOpen} 
        onClose={() => setIsSearchOnlineOpen(false)} 
        onImportSuccess={() => fetchBooks(false)} 
      />

      {/* Upload Modal */}
      <UploadModal 
        isOpen={isUploadModalOpen} 
        onClose={() => setIsUploadModalOpen(false)} 
        onUploadSuccess={() => fetchBooks(false)} 
      />

      {/* Kindle Transfer Modal */}
      {kindleBook && (
        <KindleTransferModal
          isOpen={true}
          onClose={() => setKindleBook(null)}
          bookId={kindleBook.id}
          bookTitle={kindleBook.title}
        />
      )}

      {/* Rating Modal */}
      {isRatingModalOpen && selectedBookDetail && (
        <BookRatingModal
          isOpen={true}
          onClose={() => setIsRatingModalOpen(false)}
          bookId={selectedBookDetail.id}
          bookTitle={selectedBookDetail.title}
          onSuccess={() => fetchBooks(false)}
        />
      )}
    </div>
  );
}

