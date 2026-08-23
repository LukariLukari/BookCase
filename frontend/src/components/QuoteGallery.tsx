'use client';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2, Plus, X, Trash2, Quote as QuoteIcon, Image as ImageIcon } from 'lucide-react';
import QuoteCollectorModal from './QuoteCollectorModal';

interface Quote {
  id: string;
  image_url?: string;
  text_content?: string;
  created_at: string;
}

export default function QuoteGallery({ userBookId }: { userBookId: string }) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCollectorOpen, setIsCollectorOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const fetchQuotes = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
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
      const token = localStorage.getItem('token');
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
  }, [userBookId]);

  return (
    <div className="w-full mt-8">
      <div className="flex items-center justify-between mb-6 border-b border-[#4D4845]/40 pb-4">
        <div className="flex items-center gap-2">
          <QuoteIcon size={20} className="text-[#F5ECDC]" />
          <h3 className="text-xl font-bold text-[#F5ECDC]">Trích dẫn của tôi</h3>
          <span className="text-xs font-bold bg-[#2A272A] text-[#D7C9B2] border border-[#4D4845]/60 px-2.5 py-0.5 rounded-full">
            {quotes.length}
          </span>
        </div>
        <button 
          onClick={() => setIsCollectorOpen(true)}
          className="bg-[#F5ECDC] hover:bg-white text-black font-black py-2 px-4 rounded-xl flex items-center gap-2 shadow-md transition-colors cursor-pointer"
          style={{ color: '#000000' }}
        >
          <Plus size={18} className="text-black stroke-[3]" />
          <span className="text-black font-black">Thêm Trích Dẫn</span>
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-[#D7C9B2]" size={32} /></div>
      ) : quotes.length === 0 ? (
        <div className="bg-[#2A272A] rounded-2xl border border-[#4D4845]/50 p-10 text-center flex flex-col items-center">
          <QuoteIcon size={44} className="text-[#4D4845] mb-4" />
          <p className="text-[#D7C9B2] font-bold text-base mb-1">Chưa có trích dẫn nào cho cuốn sách này.</p>
          <p className="text-sm text-[#8A817C] max-w-md">Bấm vào nút "Thêm Trích Dẫn" để dán nhanh các câu nói hay hoặc lưu lại trang sách kỷ niệm nhé!</p>
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
                {/* Delete Button */}
                <button
                  onClick={() => handleDeleteQuote(quote.id)}
                  className="absolute top-3 right-3 p-1.5 text-[#7B7369] hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer opacity-80 group-hover:opacity-100"
                  title="Xóa trích dẫn này"
                >
                  <Trash2 size={16} />
                </button>

                {/* Quote Content */}
                <div>
                  {hasText ? (
                    <div className="relative pt-2 pb-3 px-2">
                      <span className="text-4xl font-serif text-[#F5ECDC]/25 leading-none block -mb-3 select-none">“</span>
                      <p className="text-[#F5ECDC] text-base md:text-sm font-medium leading-relaxed italic whitespace-pre-wrap pl-2 pr-4">
                        {quote.text_content}
                      </p>
                      <span className="text-4xl font-serif text-[#F5ECDC]/25 leading-none text-right block -mt-2 select-none">”</span>
                    </div>
                  ) : (
                    <div className="py-2 text-xs text-[#8A817C] font-semibold italic">Trích dẫn bằng ảnh</div>
                  )}

                  {/* Reference Image Thumbnail */}
                  {hasImage && (
                    <div 
                      onClick={() => setSelectedImage(quote.image_url!)}
                      className="mt-3 relative w-full h-36 rounded-xl overflow-hidden bg-black/40 border border-[#4D4845]/50 cursor-pointer group/img flex items-center justify-center"
                    >
                      <img src={quote.image_url} alt="Reference photo" className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-300" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white text-xs font-bold">
                        <ImageIcon size={16} />
                        <span>Xem ảnh gốc</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Timestamp */}
                <div className="mt-4 pt-3 border-t border-[#4D4845]/30 flex justify-between items-center text-[11px] text-[#7B7369]">
                  <span>{new Date(quote.created_at).toLocaleDateString('vi-VN')}</span>
                  {hasImage && <span className="flex items-center gap-1 text-[#D7C9B2] font-semibold"><ImageIcon size={12} /> Có ảnh đính kèm</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quote Collector Modal */}
      {isCollectorOpen && (
        <QuoteCollectorModal 
          bookId={userBookId} 
          onClose={() => setIsCollectorOpen(false)} 
          onSaveSuccess={fetchQuotes} 
        />
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
    </div>
  );
}
