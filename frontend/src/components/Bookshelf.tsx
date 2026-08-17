'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Trash2, Loader2, Share2, Check } from 'lucide-react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import BookCoverImage from '@/components/BookCoverImage';

interface Book {
  id: string;
  title: string;
  author: string;
  genre: string;
  summary: string;
  cover_url: string;
  created_at?: string;
}

export default function Bookshelf({ books, refresh, sortBy = 'newest' }: { books: Book[], refresh: () => void, sortBy?: string }) {
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const router = useRouter();

  if (books.length === 0) return null;

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const handleDownload = (id: string, title: string) => {
    setDownloadingId(id);
    const url = `${API_URL}/api/books/${id}/download`;
    window.location.href = url;
    setTimeout(() => setDownloadingId(null), 1500);
  };

  const copyShareLink = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const url = `${window.location.origin}/share/book/${id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Render Book Card
  const renderBookCard = (book: Book) => (
    <motion.div
      key={book.id}
      layoutId={`book-container-${book.id}`}
      className="flex flex-col cursor-pointer group"
      onClick={() => setSelectedBook(book)}
      whileHover={{ y: -5 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <motion.div layoutId={`book-cover-${book.id}`} className="w-full aspect-[2/3] relative z-10 mb-4">
        <BookCoverImage 
          coverUrl={book.cover_url}
          bookId={book.id}
          title={book.title}
          author={book.author}
          className="w-full h-full object-cover rounded-2xl shadow-md group-hover:shadow-xl transition-shadow duration-300"
        />
      </motion.div>
      <div className="px-1 mt-1 flex justify-between items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-base md:text-sm font-bold text-[#F5ECDC] leading-tight line-clamp-2 mb-1 group-hover:text-[#D7C9B2] transition-colors">{book.title}</h3>
          <p className="text-sm md:text-xs text-[#D7C9B2] truncate mb-2">{book.author || "Unknown Author"}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              handleDownload(book.id, book.title);
            }}
            disabled={downloadingId === book.id}
            className="p-1.5 md:p-2 text-black bg-[#F5ECDC] hover:bg-white rounded-full border border-[#F5ECDC] transition-all flex-shrink-0 cursor-pointer shadow-md active:scale-95 disabled:opacity-50"
            title="Tải Sách Xuống"
          >
            {downloadingId === book.id ? (
              <Loader2 size={16} className="animate-spin text-black" />
            ) : (
              <Download size={16} className="text-black stroke-[2.5]" />
            )}
          </button>


          <button 
            onClick={(e) => copyShareLink(e, book.id)} 
            className="p-1.5 md:p-2 text-[#D7C9B2] bg-[#2A272A] hover:bg-green-600 hover:text-white rounded-full border border-[#4D4845]/50 transition-colors flex-shrink-0 cursor-pointer shadow-sm"
            title="Chia sẻ sách"
          >
            {copiedId === book.id ? <Check size={16} className="text-green-400" /> : <Share2 size={16} />}
          </button>
        </div>
      </div>

    </motion.div>
  );

  // Handle Grouping by Author
  let groupedBooks: Record<string, Book[]> = {};
  if (sortBy === 'author') {
    books.forEach(book => {
      const author = book.author?.trim() || "Tác giả khác / Chưa rõ";
      if (!groupedBooks[author]) groupedBooks[author] = [];
      groupedBooks[author].push(book);
    });
    // Sort keys alphabetically (with unknown authors last)
    groupedBooks = Object.keys(groupedBooks).sort((a, b) => {
      if (a.includes("Chưa rõ")) return 1;
      if (b.includes("Chưa rõ")) return -1;
      return a.localeCompare(b);
    }).reduce((acc, key) => {
      acc[key] = groupedBooks[key];
      return acc;
    }, {} as Record<string, Book[]>);
  }

  return (
    <div className="w-full pb-10">
      
      {/* Grid Rendering */}
      {sortBy === 'author' ? (
        <div className="space-y-12">
          {Object.entries(groupedBooks).map(([author, authorBooks]) => (
            <div key={author} className="space-y-6">
              {/* Clean Author Header (Unboxed with Name, Count, and Bottom Line) */}
              <div className="flex items-end justify-between pb-3 border-b border-[#4D4845]/50">
                <h2 className="text-xl sm:text-2xl font-black text-[#D7C9B2] tracking-tight">
                  {author}
                </h2>

                <span className="text-xs sm:text-sm font-semibold text-[#D7C9B2]">
                  {authorBooks.length} cuốn sách
                </span>
              </div>

              {/* Book Cards Grid for this Author */}
              <motion.div layout className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-10 pt-2">
                {authorBooks.map(renderBookCard)}
              </motion.div>
            </div>
          ))}
        </div>
      ) : (
        books.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-[#F5ECDC] mb-6">{sortBy === 'newest' ? 'Tất cả sách' : 'Danh sách sách'}</h2>
            <motion.div layout className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-10">
              {books.map(renderBookCard)}
            </motion.div>
          </div>
        )
      )}

      {/* Modal chi tiết sách */}
      <AnimatePresence>
        {selectedBook && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-black/70 backdrop-blur-sm"
               onClick={() => setSelectedBook(null)}
             />
             
             <motion.div 
               layoutId={`book-container-${selectedBook.id}`}
               className="relative bg-[#1F1D20] text-[#F5ECDC] rounded-3xl max-w-3xl w-full flex flex-col md:flex-row overflow-hidden shadow-2xl z-10 max-h-[90vh] border border-[#4D4845]/50"
             >
                <button 
                  onClick={() => setSelectedBook(null)}
                  className="absolute top-4 right-4 p-2 bg-[#2A272A] rounded-full text-[#D7C9B2] hover:text-[#F5ECDC] md:hidden z-20 border border-[#4D4845]/40"
                >
                  <X size={20} />
                </button>

                <div className="md:w-5/12 p-8 flex justify-center items-center bg-[#2A272A] border-b md:border-b-0 md:border-r border-[#4D4845]/40">
                  <motion.div layoutId={`book-cover-${selectedBook.id}`} className="w-full max-w-[200px] aspect-[2/3]">
                    <BookCoverImage 
                      coverUrl={selectedBook.cover_url}
                      bookId={selectedBook.id}
                      title={selectedBook.title}
                      author={selectedBook.author}
                      className="w-full h-full object-cover rounded-2xl shadow-xl"
                    />
                  </motion.div>
                </div>
                
                <div className="md:w-7/12 p-8 flex flex-col overflow-y-auto bg-[#1F1D20]">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-2xl font-bold mb-1 text-[#F5ECDC]">{selectedBook.title}</h2>
                      <p className="text-[#D7C9B2] text-sm mb-1">{selectedBook.author || "Unknown Author"}</p>
                    </div>
                    <div className="hidden md:flex gap-2">
                      <button 
                        onClick={() => setSelectedBook(null)}
                        className="p-2 text-[#D7C9B2] hover:text-[#F5ECDC] transition-colors bg-[#2A272A] rounded-full border border-[#4D4845]/40"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex-grow mt-6">
                    <h3 className="text-sm font-bold mb-2 text-[#F5ECDC] border-b border-[#4D4845]/40 pb-2">Summary</h3>
                    <p className="text-[#D7C9B2] leading-relaxed text-sm whitespace-pre-wrap">
                      {selectedBook.summary || "No summary available for this book."}
                    </p>
                  </div>

                  <div className="mt-8 pt-4 border-t border-[#4D4845]/40">
                    <button 
                      onClick={() => handleDownload(selectedBook.id, selectedBook.title)}
                      disabled={downloadingId === selectedBook.id}
                      className="btn-primary w-full shadow-md disabled:opacity-70 flex justify-center items-center gap-2"
                    >
                      {downloadingId === selectedBook.id ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                      <span>{downloadingId === selectedBook.id ? 'Downloading...' : 'Download File'}</span>
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
