'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Loader2, Share2, Check, Smartphone, Star, Sparkles, Award } from 'lucide-react';
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

const RIBBON_COLORS = [
  '#1B2A4A', // Navy
  '#2B2B2E', // Charcoal
  '#16243E', // Deep Navy
  '#3D3D42', // Soft Charcoal
];

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
      console.error('Lỗi tải tóm tắt đánh giá:', e);
    } finally {
      setIsLoadingRatingSummary(false);
    }
  };

  const handleDownload = async (bookId: string, bookTitle: string) => {
    try {
      setDownloadingId(bookId);
      const res = await axios.get(`${API_URL}/api/books/${bookId}/download-check`);
      if (res.data && res.data.external_url) {
        window.open(res.data.external_url, '_blank');
        setDownloadingId(null);
        return;
      }
      const downloadUrl = `${API_URL}/api/books/${bookId}/download`;
      window.location.href = downloadUrl;
      setTimeout(() => setDownloadingId(null), 2500);
    } catch (err) {
      console.error('Lỗi tải sách:', err);
      const downloadUrl = `${API_URL}/api/books/${bookId}/download`;
      window.location.href = downloadUrl;
      setTimeout(() => setDownloadingId(null), 2500);
    }
  };

  const copyShareLink = (e: React.MouseEvent, bookId: string) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/share/book/${bookId}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedId(bookId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getRibbonColor = (id: string) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % RIBBON_COLORS.length;
    return RIBBON_COLORS[index];
  };

  const renderBookItem = (book: Book, index: number) => {
    const ratingInfo = ratingsMap[book.id];
    const ribbonColor = getRibbonColor(book.id);

    return (
      <motion.div
        key={book.id}
        layoutId={`book-container-${book.id}`}
        className="flex flex-col cursor-pointer group pb-1 sm:pb-4"
        onClick={() => setSelectedBook(book)}
        whileHover={{ y: -6 }}
        transition={{ type: "spring", stiffness: 300, damping: 22 }}
      >
        {/* 3D BOOK COVER CONTAINER */}
        <div className="w-full aspect-[2/3] relative mb-1.5 sm:mb-3">
          <div className="book-card-3d absolute inset-0">
            <BookCoverImage 
              coverUrl={book.cover_url}
              bookId={book.id}
              title={book.title}
              author={book.author}
              className="w-full h-full object-cover block"
            />

            {/* Subtle Spine Crease & Hinge */}
            <div className="book-spine-crease" />

            {/* Right Page Block Bevel */}
            <div className="book-page-bevel" />

            {/* Premium Matte Cover Sheen */}
            <div className="book-cover-sheen" />

            {/* Rating badge */}
            {ratingInfo && ratingInfo.count > 0 && (
              <div className="absolute top-2 right-2 sm:top-2.5 sm:right-2.5 bg-[#FAF6F0]/95 backdrop-blur-md text-[#1C1917] border border-[#E5DACD] px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-extrabold flex items-center gap-1 shadow-sm z-20">
                <Star size={10} className="fill-[#1B2A4A] text-[#1B2A4A]" />
                <span>{ratingInfo.average_rating.toFixed(1)}</span>
              </div>
            )}
          </div>
        </div>

        {/* BOOK INFO */}
        <div className="flex flex-col flex-1 px-0.5 sm:px-1">
          <h3 
            className="text-xs sm:text-sm md:text-[14px] font-extrabold text-[#1C1917] leading-tight line-clamp-1 sm:line-clamp-2 mb-0.5 group-hover:text-[#1B2A4A] transition-colors" 
            title={book.title}
          >
            {book.title}
          </h3>
          <p 
            className="text-[11px] sm:text-xs font-semibold text-[#57534E] truncate mb-1 sm:mb-2.5" 
            title={book.author || "Unknown Author"}
          >
            {book.author || "Unknown Author"}
          </p>

          {/* QUICK ACTION BUTTONS */}
          <div className="flex items-center gap-1 sm:gap-2 mt-auto" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                if (book.has_file === false) return;
                handleDownload(book.id, book.title);
              }}
              disabled={downloadingId === book.id || book.has_file === false}
              className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl transition-all flex-shrink-0 cursor-pointer shadow-sm active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
                book.has_file === false
                  ? 'bg-[#EFE8DE] text-[#8C827A] border border-[#E0D5C7]'
                  : 'bg-[#EFE8DE] hover:bg-[#E5DACD] text-[#1C1917] border border-[#E0D5C7]'
              }`}
              title={book.has_file === false ? "Sách đang được cập nhật file" : "Tải Sách Xuống"}
            >
              {downloadingId === book.id ? (
                <Loader2 size={13} className="animate-spin text-[#1C1917]" />
              ) : (
                <Download size={13} className="stroke-[2.5]" />
              )}
            </button>

            <button 
              onClick={(e) => {
                e.stopPropagation();
                setKindleBook({ id: book.id, title: book.title });
              }}
              className="p-1.5 sm:p-2 text-[#57534E] hover:text-[#1C1917] bg-[#EFE8DE] hover:bg-[#E5DACD] rounded-lg sm:rounded-xl border border-[#E0D5C7] transition-all flex-shrink-0 cursor-pointer shadow-sm"
              title="Gửi sang Kindle (Wi-Fi)"
            >
              <Smartphone size={13} />
            </button>

            <button 
              onClick={(e) => copyShareLink(e, book.id)} 
              className="p-1.5 sm:p-2 text-[#57534E] hover:text-[#1C1917] bg-[#EFE8DE] hover:bg-[#E5DACD] rounded-lg sm:rounded-xl border border-[#E0D5C7] transition-all flex-shrink-0 cursor-pointer shadow-sm"
              title="Chia sẻ sách"
            >
              {copiedId === book.id ? <Check size={13} className="text-[#1B2A4A] stroke-[3]" /> : <Share2 size={13} />}
            </button>
          </div>
        </div>
      </motion.div>
    );
  };

  // Group by Author if requested
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
        <div className="space-y-6 sm:space-y-10">
          {Object.entries(groupedBooks).map(([author, authorBooks]) => (
            <div key={author} className="space-y-3 sm:space-y-4">
              <div className="flex items-center gap-2 sm:gap-3 border-b border-[#EAE2D5] pb-1.5">
                <h2 className="text-sm sm:text-lg font-black text-[#2A2320]">{author}</h2>
                <span className="text-[10px] sm:text-xs font-bold text-[#8B7070] bg-[#EFE8DE] px-2 py-0.5 rounded-full">
                  {authorBooks.length} cuốn
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-3.5 sm:gap-x-5 gap-y-5 sm:gap-y-7 pt-2 sm:pt-3">
                {authorBooks.map((book, idx) => renderBookItem(book, idx))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-3.5 sm:gap-x-5 gap-y-5 sm:gap-y-7 pt-2 sm:pt-3">
          {books.map((book, idx) => renderBookItem(book, idx))}
        </div>
      )}

      {/* BOOK DETAIL MODAL */}
      <AnimatePresence>
        {selectedBook && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-black/50 backdrop-blur-sm"
               onClick={() => setSelectedBook(null)}
             />
             
             <motion.div 
               layoutId={`book-container-${selectedBook.id}`}
               className="relative bg-[#FBF8F4] text-[#2A2320] rounded-[36px] max-w-2xl w-full p-6 md:p-8 shadow-2xl overflow-hidden z-10 border border-[#ECE2D5] flex flex-col md:flex-row gap-6 max-h-[90vh]"
             >
                {/* Left: Book Cover Preview */}
                <div className="w-full md:w-1/3 flex flex-col items-center flex-shrink-0">
                  <div className="w-40 sm:w-48 aspect-[2/3] relative mb-4">
                    <div className="book-card-3d absolute inset-0">
                      <BookCoverImage 
                        coverUrl={selectedBook.cover_url}
                        bookId={selectedBook.id}
                        title={selectedBook.title}
                        author={selectedBook.author}
                        className="w-full h-full object-cover block"
                      />
                      <div className="book-spine-crease" />
                      <div className="book-page-bevel" />
                      <div className="book-cover-sheen" />
                    </div>
                  </div>

                  {/* Rating Summary Pill */}
                  {ratingSummary && (
                    <div className="w-full bg-[#EFE8DE] p-3 rounded-2xl text-center mb-3 border border-[#E0D5C7]">
                      <div className="flex items-center justify-center gap-1 mb-0.5">
                        <Star size={14} className="fill-[#F2C94C] text-[#F2C94C]" />
                        <span className="font-extrabold text-base text-[#2A2320]">
                          {ratingSummary.average_rating ? ratingSummary.average_rating.toFixed(1) : '5.0'}
                        </span>
                        <span className="text-xs text-[#7A6F68]">/ 5</span>
                      </div>
                      <p className="text-[11px] text-[#7A6F68] font-bold">
                        {ratingSummary.total_reviews} lượt đánh giá
                      </p>
                    </div>
                  )}

                  {/* Rate Button */}
                  <button
                    onClick={() => setIsRatingModalOpen(true)}
                    className="w-full py-2.5 px-3 bg-[#EFE8DE] hover:bg-[#E5DACD] text-[#1C1917] font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 border border-[#E0D5C7]"
                  >
                    <Sparkles size={14} className="text-[#1B2A4A]" />
                    <span>Đánh Giá Sách</span>
                  </button>
                </div>

                {/* Right: Book Details */}
                <div className="w-full md:w-2/3 flex flex-col justify-between overflow-y-auto pr-1">
                  <div>
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#1B2A4A] bg-[#EBF0F7] border border-[#D5E1F0] px-2.5 py-0.5 rounded-full">
                          {selectedBook.genre || "Tủ sách"}
                        </span>
                        <h2 className="text-xl md:text-2xl font-black text-[#1C1917] leading-tight mt-1.5">
                          {selectedBook.title}
                        </h2>
                        <p className="text-sm text-[#57534E] font-bold mt-1">
                          {selectedBook.author || "Unknown Author"}
                        </p>
                      </div>
                      <button 
                        onClick={() => setSelectedBook(null)}
                        className="p-2 text-[#57534E] hover:text-[#1C1917] bg-[#EFE8DE] hover:bg-[#E5DACD] rounded-full transition-colors flex-shrink-0 cursor-pointer border border-[#E0D5C7]"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex-grow mt-5 space-y-4">
                    {/* Summary */}
                    <div>
                      <h3 className="text-xs font-black uppercase text-[#57534E] tracking-wider mb-1.5">Tóm tắt nội dung</h3>
                      <p className="text-[#1C1917] leading-relaxed text-xs md:text-sm whitespace-pre-wrap bg-[#FAF6F0] p-3.5 rounded-2xl border border-[#ECE2D5]">
                        {selectedBook.summary || "Chưa có tóm tắt cho cuốn sách này."}
                      </p>
                    </div>

                    {/* Reviews */}
                    {ratingSummary && ratingSummary.reviews && ratingSummary.reviews.length > 0 && (
                      <div className="pt-1">
                        <h3 className="text-xs font-black uppercase tracking-wider text-[#57534E] mb-2 flex items-center gap-1.5">
                          <Award size={13} className="text-[#1B2A4A]" /> Cảm nhận độc giả ({ratingSummary.reviews.length})
                        </h3>
                        <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                          {ratingSummary.reviews.map((rev: any) => (
                            <div key={rev.id} className="bg-[#FAF6F0] border border-[#ECE2D5] rounded-xl p-2.5 text-xs">
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-bold text-[#1C1917]">{rev.username || 'Độc giả'}</span>
                                <div className="flex items-center gap-0.5">
                                  {[...Array(rev.rating)].map((_, i) => (
                                    <Star key={i} size={10} className="fill-[#1B2A4A] text-[#1B2A4A]" />
                                  ))}
                                </div>
                              </div>
                              {rev.review_text && (
                                <p className="text-[#57534E] line-clamp-2">{rev.review_text}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer Actions */}
                  <div className="mt-6 pt-4 border-t border-[#EAE2D5] flex flex-col sm:flex-row gap-3">
                    <button 
                      onClick={() => {
                        if (selectedBook.has_file === false) return;
                        handleDownload(selectedBook.id, selectedBook.title);
                      }}
                      disabled={downloadingId === selectedBook.id || selectedBook.has_file === false}
                      className={`btn-gradient flex-1 py-3 px-4 rounded-2xl font-black text-sm flex justify-center items-center gap-2 cursor-pointer ${
                        selectedBook.has_file === false ? '!bg-[#EFE8DE] !text-[#8C827A] !shadow-none opacity-60 cursor-not-allowed' : ''
                      }`}
                      title={selectedBook.has_file === false ? "Sách đang được cập nhật file" : "Tải Sách Xuống"}
                    >
                      {downloadingId === selectedBook.id ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                      <span>{downloadingId === selectedBook.id ? 'Đang tải...' : selectedBook.has_file === false ? 'Chưa Có File Tải' : 'Tải Sách Xuống'}</span>
                    </button>

                    <button 
                      onClick={() => setKindleBook({ id: selectedBook.id, title: selectedBook.title })}
                      className="bg-[#EFE8DE] hover:bg-[#E5DACD] text-[#1C1917] border border-[#E0D5C7] flex-1 py-3 px-4 rounded-2xl font-bold text-sm flex justify-center items-center gap-2 transition-all cursor-pointer"
                    >
                      <Smartphone size={16} />
                      <span>Gửi Sang Kindle</span>
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
