'use client';
import { useState, useEffect } from 'react';
import axios from 'axios';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/app/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Book as BookIcon, X, Trash2, Quote as QuoteIcon } from 'lucide-react';
import BookCoverImage from '@/components/BookCoverImage';
import QuoteGallery from '@/components/QuoteGallery';
import AddMyBookModal from '@/components/AddMyBookModal';
import QuoteCollectorModal from '@/components/QuoteCollectorModal';
import { motion, AnimatePresence } from 'framer-motion';

export default function MyBooksClient() {
  const [userBooks, setUserBooks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBook, setSelectedBook] = useState<any | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCollectorOpen, setIsCollectorOpen] = useState(false);
  const [quoteCount, setQuoteCount] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  
  const { user, token: authToken, isLoading: authLoading, logout } = useAuth();
  const router = useRouter();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const fetchMyBooks = async () => {
    try {
      setIsLoading(true);
      const token = authToken || localStorage.getItem('token') || localStorage.getItem('access_token');
      if (!token) {
        logout();
        return;
      }
      const res = await axios.get(`${API_URL}/api/users/me/books`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserBooks(res.data);
    } catch (err: any) {
      console.error(err);
      if (err.response?.status === 401) {
        logout();
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    } else if (user) {
      fetchMyBooks();
    }
  }, [user, authLoading, router]);

  const handleDelete = async (userBookId: string) => {
    if (!confirm("Bạn có chắc muốn xóa cuốn sách này khỏi thư viện cá nhân?")) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/api/users/me/books/${userBookId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedBook(null);
      fetchMyBooks();
    } catch (err) {
      console.error(err);
      alert("Lỗi khi xóa sách.");
    }
  };

  if (authLoading || !user) {
    return <div className="min-h-screen bg-[#D8C9BB] flex items-center justify-center font-bold text-[#7A6F68]">Đang tải...</div>;
  }

  return (
    <div className="min-h-screen bg-[#D8C9BB] text-[#2A2320] pt-[70px] pb-4 px-3 sm:p-5 md:p-6 lg:p-7 flex flex-col md:flex-row gap-4 sm:gap-5 font-sans selection:bg-[#E5DACD]">
      <Sidebar />

      <main className="flex-1 min-w-0 bg-[#FBF8F4] rounded-[36px] p-6 md:p-8 shadow-[0_16px_40px_rgba(120,100,85,0.12)] border border-[#EFE8DE] flex flex-col">
        <header className="pb-5 mb-6 border-b border-[#EFE8DE] flex justify-between items-center">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-[#2A2320] tracking-tight">Sách Cá Nhân</h1>
            <p className="text-xs text-[#7A6F68] font-medium mt-0.5">Không gian sưu tập sách và lưu giữ trích dẫn yêu thích của bạn</p>
          </div>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="btn-gradient text-white rounded-full py-2.5 px-4 text-xs font-bold shadow-md hover:opacity-95 transition-all flex items-center gap-1.5 cursor-pointer border-none"
          >
            <Plus size={16} className="text-white stroke-[3]" /> Thêm Sách
          </button>
        </header>

        <section className="flex-1">
          {isLoading ? (
            <div className="flex justify-center mt-20"><Loader2 className="animate-spin text-[#1B2A4A]" size={32} /></div>
          ) : userBooks.length === 0 ? (
            <div className="flex flex-col items-center justify-center bg-[#FAF6F0] border border-[#ECE2D5] rounded-3xl p-12 mt-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#EFE8DE] flex items-center justify-center text-[#57534E] mb-4">
                <BookIcon size={28} />
              </div>
              <h2 className="text-[#1C1917] text-base font-bold mb-1.5">Thư viện của bạn đang trống</h2>
              <p className="text-[#57534E] text-xs text-center max-w-md leading-relaxed font-medium">
                Hãy thêm những cuốn sách bạn yêu thích vào đây để tạo bộ sưu tập cá nhân và lưu giữ các trích dẫn (quotes) độc đáo bằng camera nhé.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 md:gap-8">
              {userBooks.map(ub => {
                const title = ub.custom_title || ub.book?.title || "Unknown Book";
                const author = ub.custom_author || ub.book?.author || "Unknown Author";
                const coverUrl = ub.custom_cover_url || ub.book?.cover_url;

                return (
                  <motion.div
                    key={ub.id}
                    layoutId={`userbook-${ub.id}`}
                    className="flex flex-col cursor-pointer group"
                    onClick={() => setSelectedBook(ub)}
                    whileHover={{ y: -5 }}
                  >
                    <div className="w-full aspect-[2/3] relative mb-3">
                      <div className="book-card-3d absolute inset-0">
                         <BookCoverImage 
                           coverUrl={coverUrl}
                           bookId={ub.book_id || ub.id}
                           title={title}
                           author={author}
                           className="w-full h-full object-cover block"
                         />
                         <div className="book-spine-crease" />
                         <div className="book-page-bevel" />
                         <div className="book-cover-sheen" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-[#1C1917] leading-tight line-clamp-2 mb-1 group-hover:text-[#1B2A4A] transition-colors">{title}</h3>
                      <p className="text-[11px] text-[#57534E] truncate font-medium">{author}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>

        <AnimatePresence>
          {selectedBook && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={() => setSelectedBook(null)}
              />
              <motion.div 
                layoutId={`userbook-${selectedBook.id}`}
                className="relative bg-[#FBF8F4] text-[#1C1917] border border-[#ECE2D5] rounded-[36px] p-6 md:p-8 max-w-4xl w-full shadow-2xl overflow-hidden z-10 max-h-[90vh] flex flex-col"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="flex gap-6 w-full relative">
                    <div className="w-24 md:w-32 aspect-[2/3] flex-shrink-0 relative">
                      <div className="book-card-3d absolute inset-0">
                        <BookCoverImage 
                          coverUrl={selectedBook.custom_cover_url || selectedBook.book?.cover_url}
                          bookId={selectedBook.book_id || selectedBook.id}
                          title={selectedBook.custom_title || selectedBook.book?.title}
                          author={selectedBook.custom_author || selectedBook.book?.author}
                          className="w-full h-full object-cover block shadow-lg"
                        />
                        <div className="book-spine-crease" />
                        <div className="book-page-bevel" />
                        <div className="book-cover-sheen" />
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <h2 className="text-xl md:text-2xl font-black text-[#1C1917] leading-tight mb-1.5 pr-10">
                          {selectedBook.custom_title || selectedBook.book?.title || "Unknown"}
                        </h2>
                        <p className="text-sm text-[#57534E] font-bold mb-4">
                          {selectedBook.custom_author || selectedBook.book?.author || "Unknown"}
                        </p>
                        
                        <button 
                          onClick={() => handleDelete(selectedBook.id)}
                          className="flex items-center gap-1.5 text-red-600 hover:text-red-700 text-xs font-bold bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-full transition-colors w-fit cursor-pointer"
                        >
                          <Trash2 size={14} /> Xóa khỏi thư viện
                        </button>
                      </div>

                      <div className="flex items-center gap-4 mt-6">
                         <div className="flex items-center gap-2">
                           <QuoteIcon size={18} className="text-[#1B2A4A]" />
                           <h3 className="text-base font-bold text-[#1C1917]">Trích dẫn</h3>
                           <span className="text-xs font-bold bg-[#FAF6F0] text-[#57534E] border border-[#ECE2D5] px-2.5 py-0.5 rounded-full">
                             {quoteCount}
                           </span>
                         </div>
                         <button 
                           onClick={() => setIsCollectorOpen(true)}
                           className="btn-gradient text-white font-bold py-1.5 px-4 rounded-full flex items-center gap-1.5 shadow-sm hover:opacity-95 transition-all cursor-pointer text-xs border-none"
                         >
                           <Plus size={14} className="stroke-[3]" />
                           <span>Thêm Trích Dẫn</span>
                         </button>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setSelectedBook(null)} className="absolute top-6 right-6 md:top-8 md:right-8 p-2 text-[#7A6F68] hover:text-[#2A2320] bg-[#FAF6F0] hover:bg-[#EFE8DE] rounded-full transition-colors flex-shrink-0 z-20 shadow-sm border border-[#ECE2D5] cursor-pointer">
                    <X size={18} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto w-full border-t border-[#EFE8DE] pt-4 pb-6">
                  <QuoteGallery 
                    userBookId={selectedBook.id} 
                    bookTitle={selectedBook.custom_title || selectedBook.book?.title || "Unknown Book"}
                    bookAuthor={selectedBook.custom_author || selectedBook.book?.author || "Unknown Author"}
                    coverUrl={selectedBook.custom_cover_url || selectedBook.book?.cover_url}
                    refreshTrigger={refreshTrigger}
                    onQuotesLoaded={setQuoteCount}
                  />
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        
        <AddMyBookModal 
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={fetchMyBooks}
        />

        {/* Quote Collector Modal */}
        {isCollectorOpen && selectedBook && (
          <QuoteCollectorModal 
            bookId={selectedBook.id} 
            onClose={() => setIsCollectorOpen(false)} 
            onSaveSuccess={() => setRefreshTrigger(prev => prev + 1)} 
          />
        )}
      </main>
    </div>
  );
}
