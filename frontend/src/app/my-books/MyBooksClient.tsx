'use client';
import { useState, useEffect } from 'react';
import axios from 'axios';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/app/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Book as BookIcon, X, Trash2 } from 'lucide-react';
import BookCoverImage from '@/components/BookCoverImage';
import QuoteGallery from '@/components/QuoteGallery';
import AddMyBookModal from '@/components/AddMyBookModal';
import { motion, AnimatePresence } from 'framer-motion';

export default function MyBooksClient() {
  const [userBooks, setUserBooks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBook, setSelectedBook] = useState<any | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const fetchMyBooks = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/api/users/me/books`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserBooks(res.data);
    } catch (err) {
      console.error(err);
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
    return <div className="min-h-screen bg-[#1F1D20] flex items-center justify-center font-bold text-[#D7C9B2]">Đang tải...</div>;
  }

  return (
    <div className="flex bg-[#1F1D20] text-[#F5ECDC] min-h-screen font-sans overflow-x-hidden">
      <Sidebar />

      <div className="flex-1 ml-0 md:ml-64 pt-16 md:pt-0 flex flex-col min-h-screen w-full">
        
        <header className="sticky top-16 md:top-0 z-30 bg-[#1F1D20]/90 backdrop-blur-md px-4 py-4 md:px-10 md:py-6 border-b border-[#4D4845]/30 flex justify-between items-center">
          <h1 className="text-xl md:text-2xl font-black text-[#F5ECDC]">Sách Cá Nhân</h1>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-[#2A272A] hover:bg-[#3A373A] text-[#F5ECDC] border border-[#4D4845]/60 rounded-xl py-2 px-4 text-sm font-bold shadow-md transition-colors flex items-center gap-2"
          >
            <Plus size={16} /> Thêm Sách
          </button>
        </header>

        <main className="flex-1 px-4 md:px-10 pt-8 pb-12">
          {isLoading ? (
            <div className="flex justify-center mt-20"><Loader2 className="animate-spin text-[#D7C9B2]" size={32} /></div>
          ) : userBooks.length === 0 ? (
            <div className="flex flex-col items-center justify-center bg-[#2A272A] border border-[#4D4845]/40 rounded-3xl p-12 mt-10">
              <BookIcon size={48} className="text-[#4D4845] mb-4" />
              <h2 className="text-[#F5ECDC] text-lg font-bold mb-2">Thư viện của bạn đang trống</h2>
              <p className="text-[#D7C9B2] text-sm text-center max-w-md">Hãy thêm những cuốn sách bạn yêu thích vào đây để tạo bộ sưu tập cá nhân và lưu giữ các trích dẫn (quotes) độc đáo bằng camera nhé.</p>
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
                       <BookCoverImage 
                         coverUrl={coverUrl}
                         bookId={ub.book_id || ub.id}
                         title={title}
                         author={author}
                         className="w-full h-full object-cover rounded-2xl shadow-md group-hover:shadow-xl transition-shadow"
                       />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#F5ECDC] leading-tight line-clamp-2 mb-1 group-hover:text-[#D7C9B2]">{title}</h3>
                      <p className="text-xs text-[#D7C9B2] truncate">{author}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </main>

        <AnimatePresence>
          {selectedBook && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={() => setSelectedBook(null)}
              />
              <motion.div 
                layoutId={`userbook-${selectedBook.id}`}
                className="relative bg-[#1F1D20] border border-[#4D4845]/40 rounded-3xl p-6 md:p-8 max-w-4xl w-full shadow-2xl overflow-hidden z-10 max-h-[90vh] flex flex-col"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="flex gap-6">
                    <div className="w-24 md:w-32 aspect-[2/3] flex-shrink-0">
                      <BookCoverImage 
                        coverUrl={selectedBook.custom_cover_url || selectedBook.book?.cover_url}
                        bookId={selectedBook.book_id || selectedBook.id}
                        title={selectedBook.custom_title || selectedBook.book?.title}
                        author={selectedBook.custom_author || selectedBook.book?.author}
                        className="w-full h-full object-cover rounded-xl shadow-lg"
                      />
                    </div>
                    <div>
                      <h2 className="text-2xl md:text-3xl font-black text-[#F5ECDC] leading-tight mb-2">
                        {selectedBook.custom_title || selectedBook.book?.title || "Unknown"}
                      </h2>
                      <p className="text-base text-[#D7C9B2] font-semibold mb-4">
                        {selectedBook.custom_author || selectedBook.book?.author || "Unknown"}
                      </p>
                      
                      <button 
                        onClick={() => handleDelete(selectedBook.id)}
                        className="flex items-center gap-2 text-red-400 hover:text-red-300 text-sm font-medium bg-red-400/10 hover:bg-red-400/20 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} /> Xóa khỏi thư viện
                      </button>
                    </div>
                  </div>
                  <button onClick={() => setSelectedBook(null)} className="p-2 text-[#D7C9B2] hover:text-[#F5ECDC] bg-[#2A272A] rounded-full transition-colors flex-shrink-0">
                    <X size={20} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto w-full border-t border-[#4D4845]/40 pt-2 pb-6">
                  <QuoteGallery userBookId={selectedBook.id} />
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
      </div>
    </div>
  );
}
