'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Loader2, Share2, Check, Smartphone, Star, Sparkles, Award, Quote, BookOpen } from 'lucide-react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import BookCoverImage from '@/components/BookCoverImage';
import KindleTransferModal from '@/components/KindleTransferModal';
import BookRatingModal from '@/components/BookRatingModal';

interface Book {
  id: string;
  title: string;
  author: string;
  genre: string;
  summary: string;
  cover_url: string;
  has_file?: boolean;
  created_at?: string;
}

export default function Bookshelf({ books, refresh, sortBy = 'newest' }: { books: Book[], refresh: () => void, sortBy?: string }) {
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [kindleBook, setKindleBook] = useState<{ id: string; title: string } | null>(null);
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [ratingsMap, setRatingsMap] = useState<Record<string, { average_rating: number; count: number }>>({});
  const [ratingSummary, setRatingSummary] = useState<any>(null);
  const [isLoadingRatingSummary, setIsLoadingRatingSummary] = useState(false);

  const router = useRouter();

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const fetchRatings = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/books/ratings/batch`);
      if (res.data) setRatingsMap(res.data);
    } catch (e) {
      console.error('Lỗi tải batch ratings:', e);
    }
  };

  useEffect(() => {
    fetchRatings();
  }, [books]);

  useEffect(() => {
    if (selectedBook) {
      fetchRatingSummary(selectedBook.id);
    } else {
      setRatingSummary(null);
    }
  }, [selectedBook]);

  const fetchRatingSummary = async (bookId: string) => {
    try {
      setIsLoadingRatingSummary(true);
      const res = await axios.get(`${API_URL}/api/books/${bookId}/rating-summary`);
      setRatingSummary(res.data);
    } catch (e) {
      console.error('Lỗi tải rating summary:', e);
    } finally {
      setIsLoadingRatingSummary(false);
    }
  };

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
  const renderBookCard = (book: Book) => {
    const ratingInfo = ratingsMap[book.id];
    return (
      <motion.div
        key={book.id}
        layoutId={`book-container-${book.id}`}
        className="flex flex-col cursor-pointer group h-full select-none"
        onClick={() => setSelectedBook(book)}
        whileHover={{ y: -6 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <motion.div layoutId={`book-cover-${book.id}`} className="w-full aspect-[2/3] relative z-10 mb-3">
          <BookCoverImage 
            coverUrl={book.cover_url}
            bookId={book.id}
            title={book.title}
            author={book.author}
          />
          {ratingInfo && ratingInfo.count > 0 && (
            <div className="absolute top-2 right-2 bg-black/75 backdrop-blur-md text-white px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 shadow-md z-20">
              <Star size={10} className="fill-[#DE5448] text-[#DE5448]" />
              <span>{ratingInfo.average_rating.toFixed(1)}</span>
            </div>
          )}
        </motion.div>
        <div className="flex flex-col flex-1">
          <div className="w-full mb-2 flex-1">
            <h3 className="text-xs sm:text-sm font-extrabold text-[#1D1C1A] leading-tight line-clamp-2 mb-1 group-hover:text-[#DE5448] transition-colors" title={book.title}>
              {book.title}
            </h3>
            <p className="text-[11px] text-[#66615E] italic truncate" title={book.author || "Tác giả chưa rõ"}>
              {book.author || "BookCase Edition"}
            </p>
          </div>
          
          <div className="flex items-center gap-1.5 mt-auto pt-2 border-t border-[#E5DFD7]/60" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                if (book.has_file === false) return;
                handleDownload(book.id, book.title);
              }}
              disabled={downloadingId === book.id || book.has_file === false}
              className="p-1.5 rounded-full bg-[#F3EFEA] hover:bg-[#1D1C1A] text-[#1D1C1A] hover:text-white border border-[#E5DFD7] transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-40"
              title={book.has_file === false ? "Sách đang được cập nhật file dữ liệu" : "Tải Sách Xuống"}
            >
              {downloadingId === book.id ? (
                <Loader2 size={13} className="animate-spin text-[#DE5448]" />
              ) : (
                <Download size={13} />
              )}
            </button>

            <button 
              onClick={(e) => {
                e.stopPropagation();
                setKindleBook({ id: book.id, title: book.title });
              }}
              className="p-1.5 text-[#66615E] hover:text-[#1D1C1A] bg-[#F3EFEA] hover:bg-[#EFEAE4] rounded-full border border-[#E5DFD7] transition-colors cursor-pointer shadow-sm"
              title="Gửi sang Kindle (Wi-Fi)"
            >
              <Smartphone size={13} />
            </button>

            <button 
              onClick={(e) => copyShareLink(e, book.id)} 
              className="p-1.5 text-[#66615E] hover:text-[#1D1C1A] bg-[#F3EFEA] hover:bg-[#EFEAE4] rounded-full border border-[#E5DFD7] transition-colors cursor-pointer shadow-sm"
              title="Chia sẻ sách"
            >
              {copiedId === book.id ? <Check size={13} className="text-[#DE5448]" /> : <Share2 size={13} />}
            </button>
          </div>
        </div>
      </motion.div>
    );
  };

  // Handle Grouping by Author
  let groupedBooks: Record<string, Book[]> = {};
  if (sortBy === 'author') {
    books.forEach(book => {
      const author = book.author?.trim() || "Tác giả khác / Chưa rõ";
      if (!groupedBooks[author]) groupedBooks[author] = [];
      groupedBooks[author].push(book);
    });
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
    <div>
      {sortBy === 'author' ? (
        <div className="space-y-12">
          {Object.entries(groupedBooks).map(([author, authorBooks]) => (
            <div key={author} className="space-y-4">
              <div className="flex items-center gap-3 border-b border-[#E5DFD7] pb-2">
                <h2 className="text-base sm:text-lg font-extrabold text-[#1D1C1A]">{author}</h2>
                <span className="text-xs bg-[#F3EFEA] text-[#66615E] border border-[#E5DFD7] px-2.5 py-0.5 rounded-full font-bold">
                  {authorBooks.length} cuốn
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5 sm:gap-6">
                {authorBooks.map(renderBookCard)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5 sm:gap-6">
          {books.map(renderBookCard)}
        </div>
      )}

      {/* Book Detail Modal */}
      <AnimatePresence>
        {selectedBook && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
             <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 20 }}
               className="relative bg-[#FAF7F2] border border-[#E5DFD7] rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl overflow-hidden z-10 max-h-[90vh] flex flex-col md:flex-row gap-6 md:gap-8 text-[#1D1C1A]"
             >
                <div className="w-full md:w-1/3 flex-shrink-0 flex flex-col items-center">
                  <motion.div layoutId={`book-cover-${selectedBook.id}`} className="w-40 md:w-full aspect-[2/3] relative mb-4">
                    <BookCoverImage 
                      coverUrl={selectedBook.cover_url}
                      bookId={selectedBook.id}
                      title={selectedBook.title}
                      author={selectedBook.author}
                    />
                  </motion.div>

                  {/* Rating Badge under cover */}
                  {ratingSummary && (
                    <div className="w-full bg-[#F3EFEA] border border-[#E5DFD7] rounded-xl p-3 text-center mb-3">
                      <div className="flex items-center justify-center gap-1.5 text-[#1D1C1A] mb-1">
                        <Star size={16} className="fill-[#DE5448] text-[#DE5448]" />
                        <span className="text-lg font-black text-[#1D1C1A]">
                          {ratingSummary.average_rating ? ratingSummary.average_rating.toFixed(1) : '5.0'}
                        </span>
                        <span className="text-xs text-[#9E9791]">/ 5</span>
                      </div>
                      <p className="text-[11px] text-[#66615E] font-medium">
                        {ratingSummary.total_reviews} lượt độc giả đánh giá
                      </p>
                    </div>
                  )}

                  {/* Rate & Add Insight Button */}
                  <button
                    onClick={() => setIsRatingModalOpen(true)}
                    className="w-full py-2.5 px-3 bg-[#1D1C1A] hover:bg-black text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95"
                  >
                    <Sparkles size={13} className="text-[#DE5448]" />
                    <span>Đánh Giá & Insight</span>
                  </button>
                </div>

                <div className="w-full md:w-2/3 flex flex-col justify-between overflow-y-auto">
                  <div>
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-[#9E9791]">{selectedBook.genre || "Literature"}</span>
                        <h2 className="text-xl sm:text-2xl font-black text-[#1D1C1A] leading-tight mt-1">{selectedBook.title}</h2>
                        <p className="text-sm text-[#66615E] italic mt-1">{selectedBook.author || "Tác giả chưa rõ"}</p>
                      </div>
                      <button 
                        onClick={() => setSelectedBook(null)}
                        className="p-2 text-[#66615E] hover:text-[#1D1C1A] bg-[#F3EFEA] hover:bg-[#EFEAE4] rounded-full transition-colors flex-shrink-0 cursor-pointer"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex-grow mt-5 space-y-4">
                    <div>
                      <h3 className="text-xs font-bold uppercase text-[#9E9791] tracking-wider mb-1.5">Tóm tắt nội dung</h3>
                      <p className="text-[#66615E] leading-relaxed text-xs sm:text-sm whitespace-pre-wrap">
                        {selectedBook.summary || "Chưa có tóm tắt cho cuốn sách này."}
                      </p>
                    </div>

                    {ratingSummary && ratingSummary.reviews && ratingSummary.reviews.length > 0 && (
                      <div className="pt-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[#1D1C1A] mb-2.5 flex items-center gap-1.5">
                          <Award size={14} className="text-[#DE5448]" /> Độc Giả Chia Sẻ ({ratingSummary.reviews.length})
                        </h3>
                        <div className="space-y-2.5 max-h-36 overflow-y-auto pr-1">
                          {ratingSummary.reviews.map((rev: any) => (
                            <div key={rev.id} className="bg-[#F3EFEA] border border-[#E5DFD7] rounded-xl p-2.5">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-bold text-[#1D1C1A]">{rev.username || 'Độc giả'}</span>
                                <div className="flex items-center gap-0.5 text-[#DE5448]">
                                  {[...Array(rev.rating)].map((_, i) => (
                                    <Star key={i} size={10} className="fill-[#DE5448]" />
                                  ))}
                                </div>
                              </div>
                              {rev.key_takeaway && (
                                <p className="text-xs text-[#1D1C1A] font-medium italic border-l-2 border-[#DE5448] pl-2 my-1">
                                  &ldquo;{rev.key_takeaway}&rdquo;
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 pt-4 border-t border-[#E5DFD7] flex flex-col sm:flex-row gap-2.5">
                    <button
                      onClick={() => {
                        router.push(`/reader?book_id=${selectedBook.id}`);
                      }}
                      className="py-2.5 px-4 bg-[#1D1C1A] hover:bg-black text-white text-xs sm:text-sm font-bold rounded-xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer flex-1"
                    >
                      <BookOpen size={16} />
                      <span>Đọc Sách</span>
                    </button>

                    <button 
                      onClick={() => {
                        if (selectedBook.has_file === false) return;
                        handleDownload(selectedBook.id, selectedBook.title);
                      }}
                      disabled={downloadingId === selectedBook.id || selectedBook.has_file === false}
                      className="py-2.5 px-4 bg-[#F3EFEA] hover:bg-[#EFEAE4] text-[#1D1C1A] text-xs font-bold rounded-xl border border-[#E5DFD7] flex items-center justify-center gap-2 transition-all cursor-pointer flex-1"
                    >
                      {downloadingId === selectedBook.id ? <Loader2 size={16} className="animate-spin text-[#DE5448]" /> : <Download size={16} />}
                      <span>Tải Về Máy</span>
                    </button>

                    <button 
                      onClick={() => setKindleBook({ id: selectedBook.id, title: selectedBook.title })}
                      className="py-2.5 px-3 bg-[#F3EFEA] hover:bg-[#EFEAE4] text-[#1D1C1A] text-xs font-bold rounded-xl border border-[#E5DFD7] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Smartphone size={16} />
                      <span>Kindle</span>
                    </button>
                  </div>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Book Rating Modal */}
      {isRatingModalOpen && selectedBook && (
        <BookRatingModal
          isOpen={isRatingModalOpen}
          onClose={() => setIsRatingModalOpen(false)}
          bookId={selectedBook.id}
          bookTitle={selectedBook.title}
          bookAuthor={selectedBook.author}
          coverUrl={selectedBook.cover_url}
          onSuccess={() => {
            fetchRatings();
            fetchRatingSummary(selectedBook.id);
          }}
        />
      )}

      {/* Kindle Transfer Modal */}
      <KindleTransferModal 
        isOpen={!!kindleBook}
        onClose={() => setKindleBook(null)}
        bookId={kindleBook?.id || null}
        bookTitle={kindleBook?.title}
      />
    </div>
  );
}
