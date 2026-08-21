'use client';
import { useState, useEffect } from 'react';
import Bookshelf from '@/components/Bookshelf';
import Sidebar from '@/components/Sidebar';
import SearchOnlineModal from '@/components/SearchOnlineModal';
import UploadModal from '@/components/UploadModal';
import { Search } from 'lucide-react';
import { useAuth } from '@/app/contexts/AuthContext';
import { useRouter } from 'next/navigation';

import axios from 'axios';

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
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isLoadingBooks, setIsLoadingBooks] = useState(true);
  
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
        // We do NOT set page = 0 here synchronously because it can cause race conditions. We'll track skip directly.
      } else {
        setIsLoadingMore(true);
      }
      
      const currentSkip = isLoadMore ? (page + 1) * 30 : 0;
      
      // If it takes more than 5 seconds, it's likely a cold start
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
        // Removed strict 15000ms timeout so Render free tier can wake up (takes ~50s)
      });
      
      clearTimeout(coldStartTimer);
      setIsColdStart(false);

      if (res.data && Array.isArray(res.data)) {
        if (!isLoadMore) {
          setBooks(res.data);
          setPage(0);
          try {
            if (!searchQuery) sessionStorage.setItem('cached_books', JSON.stringify(res.data));
          } catch (e) {}
        } else {
          setBooks(prev => {
            // Lọc trùng lặp phòng trường hợp spam click
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

  // Refetch when search query or sort order changes (with debounce)
  useEffect(() => {
    if (user) {
      const delayTimer = setTimeout(() => {
        fetchBooks(false);
      }, 400); // 400ms debounce
      return () => clearTimeout(delayTimer);
    }
  }, [user, searchQuery, sortBy]);

  if (isLoading || !user) {
    return <div className="min-h-screen bg-[#1F1D20] flex items-center justify-center font-bold text-[#D7C9B2]">Đang tải...</div>;
  }

  return (
    <div className="flex bg-[#1F1D20] text-[#F5ECDC] min-h-screen font-sans selection:bg-orange-950/60 overflow-x-hidden">
      
      {/* Sidebar - Fixed Left */}
      <Sidebar />

      {/* Main Content Area - Shifted Right */}
      <div className="flex-1 ml-0 md:ml-64 pt-16 md:pt-0 flex flex-col min-h-screen w-full max-w-full">
        
        {/* Topbar */}
        <header className="sticky top-16 md:top-0 z-30 bg-[#1F1D20]/90 backdrop-blur-md px-4 py-4 md:px-10 md:py-6 flex flex-col gap-4 border-b border-[#4D4845]/30">
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-0">
            {/* Menu links on topbar */}
            <div className="flex items-center gap-6 md:gap-8 text-base md:text-sm font-bold text-[#D7C9B2] overflow-x-auto w-full md:w-auto no-scrollbar">
               <a href="#" className="text-[#F5ECDC] border-b-2 border-[#F5ECDC] pb-1 whitespace-nowrap">New Release</a>
               <a href="#" className="hover:text-[#F5ECDC] transition-colors pb-1 whitespace-nowrap">Featured</a>
            </div>

            {/* Actions */}
            <div className="flex items-center w-full md:w-auto gap-3">
              <button
                onClick={() => setIsSearchOnlineOpen(true)}
                className="flex-1 md:flex-none bg-[#F5ECDC] hover:bg-white !text-black border border-[#F5ECDC] rounded-xl py-3.5 md:py-2.5 px-5 text-sm font-black focus:outline-none focus:ring-2 focus:ring-[#F5ECDC]/50 shadow-md transition-all cursor-pointer whitespace-nowrap"
                style={{ color: '#000000' }}
              >
                <span style={{ color: '#000000' }} className="!text-black font-black">Tìm Sách Online</span>
              </button>
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="flex-1 md:flex-none bg-[#2A272A] hover:bg-[#3A373A] text-[#F5ECDC] border border-[#4D4845]/60 rounded-xl py-3.5 md:py-2.5 px-5 text-sm font-black focus:outline-none focus:ring-2 focus:ring-[#F5ECDC]/50 shadow-md transition-all cursor-pointer whitespace-nowrap"
              >
                <span className="font-black text-[#F5ECDC]">Tải Sách Lên</span>
              </button>
              <button
                onClick={() => setIsSearchExpanded(!isSearchExpanded)}
                className="p-3.5 md:p-2.5 bg-[#2A272A] hover:bg-[#3A373A] text-[#F5ECDC] border border-[#4D4845]/60 rounded-xl focus:outline-none shadow-md transition-all cursor-pointer"
              >
                <Search size={20} />
              </button>
            </div>
          </div>

          {/* Search & Sort Row */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            
            <div className="w-full md:w-auto flex justify-start">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full md:w-auto bg-[#2A272A] border border-[#4D4845]/60 rounded-xl py-3 md:py-2.5 px-5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#F5ECDC]/50 shadow-inner transition-all text-[#F5ECDC] cursor-pointer appearance-none pr-10"
                style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23F5ECDC%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem top 50%', backgroundSize: '0.65rem auto' }}
              >
                <option value="newest" className="bg-[#1F1D20] text-[#F5ECDC]">Sắp xếp: Mới nhất</option>
                <option value="author" className="bg-[#1F1D20] text-[#F5ECDC]">Phân loại: Theo Tác Giả</option>
                <option value="a-z" className="bg-[#1F1D20] text-[#F5ECDC]">Tên sách: A ➔ Z</option>
                <option value="z-a" className="bg-[#1F1D20] text-[#F5ECDC]">Tên sách: Z ➔ A</option>
              </select>
            </div>

            <div className="w-full md:w-1/2 flex justify-end h-11">
              {isSearchExpanded && (
                <div className="relative w-full md:max-w-md animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7B7369]" size={16} />
                  <input 
                    type="text" 
                    placeholder="Search your books"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#2A272A] border border-[#4D4845]/60 rounded-xl py-3 md:py-2.5 pl-12 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#F5ECDC]/50 shadow-inner transition-all text-[#F5ECDC] placeholder-[#7B7369]"
                    autoFocus
                  />
                </div>
              )}
            </div>
            
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 px-4 md:px-10 pt-4 pb-12">
          {isLoadingBooks && books.length === 0 ? (
            <div className="flex flex-col items-center pt-10">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-10 w-full animate-pulse">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="flex flex-col">
                    <div className="w-full aspect-[2/3] bg-[#2A272A] rounded-2xl mb-4 border border-[#4D4845]/30"></div>
                    <div className="h-4 bg-[#2A272A] rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-[#2A272A] rounded w-1/2"></div>
                  </div>
                ))}
              </div>
              {isColdStart && (
                <div className="mt-8 px-6 py-4 bg-orange-500/10 border border-orange-500/30 rounded-2xl flex flex-col items-center max-w-md text-center animate-fade-in shadow-lg">
                   <div className="animate-spin rounded-full h-8 w-8 border-4 border-orange-500 border-t-transparent mb-3"></div>
                   <h3 className="text-orange-400 font-bold mb-1">Máy chủ đang thức dậy...</h3>
                   <p className="text-[#D7C9B2] text-sm">Hệ thống đang khởi động lại do đã lâu không có ai truy cập. Quá trình này có thể mất tới 60 giây, vui lòng kiên nhẫn nhé!</p>
                </div>
              )}
            </div>
          ) : books.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center bg-[#2A272A] rounded-3xl shadow-sm border border-[#4D4845]/40">
              <p className="text-[#D7C9B2] font-medium mb-4">Bookshelf is currently empty.</p>
            </div>
          ) : (
            <>
              <Bookshelf books={books} refresh={() => fetchBooks(false)} sortBy={sortBy} />
              
              {hasMore && (
                <div className="mt-10 flex justify-center pb-8">
                  <button 
                    onClick={() => fetchBooks(true)}
                    disabled={isLoadingMore}
                    className="bg-[#2A272A] hover:bg-[#3A373A] border border-[#4D4845] text-[#F5ECDC] font-bold py-3 px-8 rounded-full shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isLoadingMore ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#F5ECDC] border-t-transparent"></div>
                        Đang tải...
                      </>
                    ) : (
                      'Tải Thêm Sách'
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </main>

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
    </div>
  );
}
