'use client';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { Download, AlertCircle, Loader2, Sparkles, Smartphone } from 'lucide-react';
import { useParams } from 'next/navigation';
import BookCoverImage from '@/components/BookCoverImage';
import SubscriptionModal from '@/components/SubscriptionModal';
import KindleTransferModal from '@/components/KindleTransferModal';

export default function ShareBookPage() {
  const { id } = useParams();
  const [book, setBook] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [isKindleModalOpen, setIsKindleModalOpen] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  useEffect(() => {
    if (id) {
      fetchBook();
    }
  }, [id]);

  const fetchBook = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/books/${id}`);
      setBook(res.data);
    } catch (err: any) {
      setError('Không tìm thấy thông tin sách hoặc liên kết đã hết hạn.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!book) return;
    setIsDownloading(true);
    window.location.href = `${API_URL}/api/books/${book.id}/download`;
    setTimeout(() => {
      setIsDownloading(false);
    }, 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1F1D20] text-[#F5ECDC] flex flex-col items-center justify-center p-4">
        <Loader2 size={32} className="animate-spin text-[#F5ECDC] mb-4" />
        <p className="font-bold text-sm text-[#D7C9B2]">Đang tải thông tin sách...</p>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="min-h-screen bg-[#1F1D20] text-[#F5ECDC] flex flex-col items-center justify-center p-4">
        <div className="bg-[#2A272A] border border-[#4D4845]/50 p-8 rounded-3xl max-w-md w-full text-center space-y-4 shadow-xl">
          <AlertCircle size={48} className="mx-auto text-amber-500" />
          <h1 className="text-xl font-black text-[#F5ECDC]">Không Tìm Thấy Sách</h1>
          <p className="text-sm text-[#D7C9B2]">{error || 'Cuốn sách này không tồn tại.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1F1D20] text-[#F5ECDC] flex items-center justify-center p-4 sm:p-6 md:p-8">
      <div className="max-w-4xl w-full bg-[#2A272A] border border-[#4D4845]/40 rounded-3xl p-6 sm:p-8 md:p-10 shadow-2xl flex flex-col md:flex-row gap-8 items-stretch">
        
        {/* Cover Section */}
        <div className="w-full md:w-5/12 shrink-0 flex flex-col items-center">
           <div className="w-48 sm:w-56 md:w-full aspect-[2/3] relative rounded-2xl overflow-hidden shadow-2xl border border-[#4D4845]/40">
              <BookCoverImage 
                coverUrl={book.cover_url}
                bookId={book.id}
                title={book.title}
                author={book.author}
                className="w-full h-full object-cover"
              />
           </div>
        </div>

        {/* Content Section */}
        <div className="w-full md:w-7/12 flex flex-col justify-between">
          <div>
             <span className="text-xs font-bold uppercase tracking-wider text-[#8A817C] bg-[#1F1D20] px-3 py-1 rounded-full border border-[#4D4845]/40">
                {book.genre || 'General'}
             </span>
             <h1 className="text-2xl sm:text-3xl font-black text-[#F5ECDC] leading-tight mt-3">
                {book.title}
             </h1>
             <p className="text-base sm:text-lg font-semibold text-[#D7C9B2] mt-1.5">
                {book.author || 'Tác giả chưa rõ'}
             </p>

             {book.summary && (
                <div className="mt-5 pt-4 border-t border-[#4D4845]/30">
                   <h2 className="text-xs font-bold text-[#8A817C] uppercase tracking-wider mb-2">Tóm tắt nội dung</h2>
                   <p className="text-sm text-[#D7C9B2] leading-relaxed line-clamp-6 whitespace-pre-wrap">
                      {book.summary}
                   </p>
                </div>
             )}
          </div>

          <div className="mt-auto pt-6 border-t border-gray-100 flex flex-col gap-3 w-full">
             {/* Nút Tải Sách Xuống */}
             <button 
                onClick={handleDownload}
                disabled={isDownloading}
                className="btn-secondary w-full flex items-center justify-center gap-3 py-3.5 px-6 shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:-translate-y-0 text-base font-extrabold cursor-pointer"
             >
                {isDownloading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Download size={20} className="stroke-[2.5]" />
                )}
                <span className="font-black text-base">{isDownloading ? 'Đang Tải...' : 'Tải Sách Xuống'}</span>
             </button>

             {/* Nút Gửi Sang Kindle (Wi-Fi) */}
             <button
                onClick={() => setIsKindleModalOpen(true)}
                className="w-full bg-[#3A373A] hover:bg-[#4D4845] border border-[#F5ECDC]/30 rounded-xl py-3 px-6 text-center shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer flex items-center justify-center gap-2.5 font-bold text-sm"
                style={{ backgroundColor: '#3A373A', color: '#F5ECDC' }}
             >
                <Smartphone size={18} style={{ color: '#F5ECDC' }} />
                <span>Gửi Sang Kindle / Máy Đọc Sách (Wi-Fi)</span>
             </button>

             {/* Nút ĐĂNG KÍ */}
             <button
                onClick={() => setIsSubscriptionModalOpen(true)}
                className="hidden w-full bg-[#1F1D20] hover:bg-[#2A272A] border border-[#4D4845]/40 rounded-2xl py-3 px-6 text-left shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 cursor-pointer flex items-center gap-3.5"
                style={{ backgroundColor: '#1F1D20', color: '#F5ECDC' }}
             >
                <div className="p-2 bg-[#F5ECDC] rounded-xl shrink-0" style={{ backgroundColor: '#F5ECDC', color: '#000000' }}>
                   <Sparkles size={16} style={{ color: '#000000' }} />
                </div>
                <div>
                   <div className="text-sm font-black tracking-wide leading-tight text-[#F5ECDC]" style={{ color: '#F5ECDC' }}>
                      ĐĂNG KÍ
                   </div>
                   <div className="text-xs text-[#D7C9B2] font-semibold mt-0.5" style={{ color: '#D7C9B2' }}>
                      Để tải thêm sách theo yêu cầu
                   </div>
                </div>
             </button>
          </div>

          <p className="text-xs text-gray-400 mt-4 text-center sm:text-left">
             File được chia sẻ trực tiếp từ hệ thống tủ sách cá nhân BookCase.
          </p>
        </div>

      </div>

      <SubscriptionModal 
        isOpen={isSubscriptionModalOpen}
        onClose={() => setIsSubscriptionModalOpen(false)}
      />

      <KindleTransferModal 
        isOpen={isKindleModalOpen}
        onClose={() => setIsKindleModalOpen(false)}
        bookId={book?.id || null}
        bookTitle={book?.title}
      />
    </div>
  );
}
