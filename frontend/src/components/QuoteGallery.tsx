'use client';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2, X, Trash2, Quote as QuoteIcon, Image as ImageIcon, Share2, Hash } from 'lucide-react';
import ShareQuoteModal from './ShareQuoteModal';

interface Quote {
  id: string;
  image_url?: string;
  text_content?: string;
  page_number?: number | null;
  created_at: string;
}

interface QuoteGalleryProps {
  userBookId: string;
  bookTitle?: string;
  bookAuthor?: string;
  coverUrl?: string | null;
  refreshTrigger?: number;
  onQuotesLoaded?: (count: number) => void;
}

export default function QuoteGallery({ 
  userBookId, 
  bookTitle = "Sách", 
  bookAuthor = "Tác giả", 
  coverUrl,
  refreshTrigger = 0, 
  onQuotesLoaded 
}: QuoteGalleryProps) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [sharingQuote, setSharingQuote] = useState<Quote | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const fetchQuotes = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token') || localStorage.getItem('access_token');
      const res = await axios.get(`${API_URL}/api/users/me/books/${userBookId}/quotes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setQuotes(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteQuote = async (quoteId: string) => {
    if (!confirm("Bạn có chắc muốn xóa trích dẫn này?")) return;
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('access_token');
      await axios.delete(`${API_URL}/api/users/me/quotes/${quoteId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setQuotes(prev => prev.filter(q => q.id !== quoteId));
    } catch (err) {
      console.error("Lỗi xóa quote:", err);
      alert("Lỗi khi xóa trích dẫn.");
    }
  };

  useEffect(() => {
    fetchQuotes();
  }, [userBookId, refreshTrigger]);

  useEffect(() => {
    if (onQuotesLoaded) {
      onQuotesLoaded(quotes.length);
    }
  }, [quotes, onQuotesLoaded]);

  return (
    <div className="w-full">
      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-[#D7C9B2]" size={32} /></div>
      ) : quotes.length === 0 ? (
        <div className="bg-[#2A272A] rounded-2xl border border-[#4D4845]/50 p-10 text-center flex flex-col items-center">
          <QuoteIcon size={44} className="text-[#4D4845] mb-4" />
          <p className="text-[#F5ECDC] font-bold text-base mb-1">Chưa có trích dẫn nào cho cuốn sách này.</p>
          <p className="text-sm text-[#8A817C] max-w-md">Bấm vào nút "Thêm Trích Dẫn" để quét chữ hoặc lưu lại trang sách kỷ niệm nhé!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quotes.map(quote => {
            const hasText = quote.text_content && quote.text_content.trim().length > 0;
            const hasImage = quote.image_url && quote.image_url.trim().length > 0;

            return (
              <div 
                key={quote.id} 
                className="relative bg-[#2A272A] border border-[#4D4845]/60 hover:border-[#F5ECDC]/40 rounded-2xl p-5 shadow-lg flex flex-col justify-between group transition-all"
              >
                {/* Action Buttons Top Right */}
                <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
                  {hasText && (
                    <button
                      onClick={() => setSharingQuote(quote)}
                      className="p-1.5 text-[#D7C9B2] hover:text-[#F5ECDC] hover:bg-[#3A373A] bg-[#1F1D20] border border-[#4D4845]/60 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-bold shadow-sm"
                      title="Xuất ảnh trích dẫn"
                    >
                      <Share2 size={12} />
                      <span>Xuất ảnh</span>
                    </button>
                  )}
                  
                  <button
                    onClick={() => handleDeleteQuote(quote.id)}
                    className="p-1.5 text-[#7B7369] hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer opacity-80 group-hover:opacity-100"
                    title="Xóa trích dẫn này"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* Quote Content */}
                <div>
                  {hasText ? (
                    <div className="relative pt-2 pb-3 px-2">
                      <span className="text-4xl font-serif text-[#F5ECDC]/25 leading-none block -mb-3 select-none">“</span>
                      <p className="text-[#F5ECDC] text-base md:text-sm font-medium leading-relaxed italic whitespace-pre-wrap pl-2 pr-4 font-serif">
                        {quote.text_content}
                      </p>
                      <span className="text-4xl font-serif text-[#F5ECDC]/25 leading-none text-right block -mt-2 select-none">”</span>
                    </div>
                  ) : (
                    <div className="py-2 text-xs text-[#8A817C] font-semibold italic">Trích dẫn bằng ảnh chụp</div>
                  )}

                  {/* Reference Image Thumbnail */}
                  {hasImage && (
                    <div 
                      onClick={() => setSelectedImage(quote.image_url!)}
                      className="mt-3 relative w-full rounded-xl overflow-hidden bg-black/60 border border-[#4D4845]/50 cursor-pointer group/img flex items-center justify-center p-1.5"
                    >
                      <img 
                        src={quote.image_url} 
                        alt="Reference snippet" 
                        className="w-full h-auto max-h-56 object-contain rounded-lg group-hover/img:scale-[1.02] transition-transform duration-300" 
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white text-xs font-bold rounded-xl backdrop-blur-[2px]">
                        <ImageIcon size={16} />
                        <span>Xem ảnh đoạn sách</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Metadata */}
                <div className="mt-4 pt-3 border-t border-[#4D4845]/30 flex justify-between items-center text-[11px] text-[#7B7369]">
                  <div className="flex items-center gap-2">
                    <span>{new Date(quote.created_at).toLocaleDateString('vi-VN')}</span>
                    {hasImage && <span className="flex items-center gap-1 text-[#D7C9B2] font-semibold"><ImageIcon size={12} /> Ảnh</span>}
                  </div>
                  
                  {quote.page_number && (
                    <span className="flex items-center gap-1 text-xs font-bold bg-[#1F1D20] text-amber-300/90 border border-amber-400/20 px-2 py-0.5 rounded-md">
                      <Hash size={11} /> Trang {quote.page_number}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Image Viewer Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedImage(null)}>
          <button className="absolute top-6 right-6 p-2 text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10 cursor-pointer" onClick={() => setSelectedImage(null)}>
             <X size={24} />
          </button>
          <img src={selectedImage} alt="Quote Full" className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* Share Quote Modal */}
      {sharingQuote && sharingQuote.text_content && (
        <ShareQuoteModal
          quoteText={sharingQuote.text_content}
          bookTitle={bookTitle}
          bookAuthor={bookAuthor}
          pageNumber={sharingQuote.page_number}
          coverUrl={coverUrl}
          onClose={() => setSharingQuote(null)}
        />
      )}
    </div>
  );
}
