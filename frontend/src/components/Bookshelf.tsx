'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Trash2 } from 'lucide-react';
import axios from 'axios';
import { useRouter } from 'next/navigation';

interface Book {
  id: string;
  title: string;
  author: string;
  genre: string;
  summary: string;
  cover_url: string;
  created_at?: string;
}

export default function Bookshelf({ books, refresh }: { books: Book[], refresh: () => void }) {
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const router = useRouter();

  if (books.length === 0) return null;

  // Sách mới nhất làm Hero
  const heroBook = [...books].sort((a, b) => {
    if (a.created_at && b.created_at) {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    return 0;
  })[0];
  // Vẫn hiển thị đầy đủ sách đó bên dưới
  const gridBooks = books;

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const handleDownload = (id: string, title: string) => {
    const url = `${API_URL}/api/books/${id}/download`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.pdf`; // Hoặc xử lý linh hoạt phần mở rộng
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="w-full pb-10">
      
      {/* Recently Added (Hero Section) */}
      <div className="mb-12">
        <h2 className="text-lg font-bold text-black mb-4">Recently Added</h2>
        <motion.div 
          layoutId={`book-container-${heroBook.id}`}
          className="relative bg-gradient-to-r from-[#9d8373] to-[#80695b] rounded-[2rem] p-6 md:pr-12 flex flex-row items-center md:items-center gap-4 md:gap-6 cursor-pointer shadow-lg w-full md:w-3/4 lg:w-2/3"
          onClick={() => setSelectedBook(heroBook)}
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          {/* Cover */}
          <motion.div layoutId={`book-cover-${heroBook.id}`} className="w-24 md:w-28 flex-shrink-0 -mt-8 md:-mt-10 mb-0 md:mb-2 shadow-2xl">
            {heroBook.cover_url ? (
              <img 
                src={heroBook.cover_url} 
                alt={heroBook.title}
                className="w-full aspect-[2/3] object-cover rounded-xl shadow-xl border border-white/20"
              />
            ) : (
              <div className="w-full aspect-[2/3] bg-slate-800 rounded-xl shadow-xl flex items-center justify-center p-2 text-center border border-white/20">
                 <span className="font-bold text-gray-400 text-xs">{heroBook.title}</span>
              </div>
            )}
          </motion.div>
          
          {/* Info */}
          <div className="text-white flex-1 min-w-0 py-2">
            <h3 className="text-xl md:text-2xl font-bold mb-1 truncate">{heroBook.title}</h3>
            <p className="text-white/80 text-xs md:text-sm mb-3 md:mb-4 truncate">{heroBook.author || "Unknown Author"}</p>
            
            <p className="text-white/80 text-[10px] md:text-xs mt-2">
              Added: {heroBook.created_at ? new Date(heroBook.created_at).toLocaleDateString() : 'Just added'}
            </p>
          </div>
        </motion.div>
      </div>

      {/* New Release (Grid) */}
      {gridBooks.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-black mb-6">New Release</h2>
          <motion.div layout className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-10">
            {gridBooks.map(book => (
              <motion.div
                key={book.id}
                layoutId={`book-container-${book.id}`}
                className="flex flex-col cursor-pointer group"
                onClick={() => setSelectedBook(book)}
                whileHover={{ y: -5 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                {/* Ảnh bìa */}
                <motion.div layoutId={`book-cover-${book.id}`} className="w-full aspect-[2/3] relative z-10 mb-4">
                   {book.cover_url ? (
                     <img 
                        src={book.cover_url} 
                        className="w-full h-full object-cover rounded-2xl shadow-md group-hover:shadow-xl transition-shadow duration-300" 
                        alt={book.title} 
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = 'https://placehold.co/400x600/e2e8f0/64748b?text=No+Cover';
                        }}
                      />
                   ) : (
                     <div className="w-full h-full bg-slate-200 rounded-2xl shadow-md flex items-center justify-center p-4 text-center">
                        <span className="font-bold text-gray-500">{book.title}</span>
                     </div>
                   )}
                </motion.div>
                
                {/* Thông tin Text */}
                <div className="px-1 mt-1">
                  <h3 className="text-base md:text-sm font-bold text-black leading-tight line-clamp-2 mb-1">{book.title}</h3>
                  <p className="text-sm md:text-xs text-gray-500 truncate mb-2">{book.author || "Unknown Author"}</p>
                  
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}

      {/* Modal chi tiết sách */}
      <AnimatePresence>
        {selectedBook && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-black/40 backdrop-blur-sm"
               onClick={() => setSelectedBook(null)}
             />
             
             <motion.div 
               layoutId={`book-container-${selectedBook.id}`}
               className="relative bg-white rounded-3xl max-w-3xl w-full flex flex-col md:flex-row overflow-hidden shadow-2xl z-10 max-h-[90vh]"
             >
                <button 
                  onClick={() => setSelectedBook(null)}
                  className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full text-gray-500 hover:text-black md:hidden z-20"
                >
                  <X size={20} />
                </button>

                <div className="md:w-5/12 p-8 flex justify-center items-center bg-[#f8f7f4]">
                  <motion.div layoutId={`book-cover-${selectedBook.id}`} className="w-full max-w-[200px] aspect-[2/3]">
                    {selectedBook.cover_url ? (
                      <img 
                        src={selectedBook.cover_url} 
                        className="w-full h-full object-cover rounded-2xl shadow-xl"
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-200 rounded-2xl shadow-xl flex items-center justify-center p-4">
                         <span className="font-bold text-gray-500 text-xl text-center">{selectedBook.title}</span>
                      </div>
                    )}
                  </motion.div>
                </div>
                
                <div className="md:w-7/12 p-8 flex flex-col overflow-y-auto">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-2xl font-bold mb-1 text-black">{selectedBook.title}</h2>
                      <p className="text-gray-500 text-sm mb-1">{selectedBook.author || "Unknown Author"}</p>
                    </div>
                    <div className="hidden md:flex gap-2">
                      <button 
                        onClick={() => setSelectedBook(null)}
                        className="p-2 text-gray-400 hover:text-black transition-colors bg-gray-50 rounded-full"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex-grow mt-6">
                    <h3 className="text-sm font-bold mb-2 text-black border-b border-gray-100 pb-2">Summary</h3>
                    <p className="text-gray-600 leading-relaxed text-sm whitespace-pre-wrap">
                      {selectedBook.summary || "No summary available for this book."}
                    </p>
                  </div>

                  <div className="mt-8 pt-4">
                    <button 
                      onClick={() => handleDownload(selectedBook.id, selectedBook.title)}
                      className="btn-primary w-full shadow-md"
                    >
                      <Download size={18} />
                      <span>Download File</span>
                    </button>
                  </div>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
