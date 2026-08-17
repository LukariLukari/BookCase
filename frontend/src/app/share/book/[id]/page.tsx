'use client';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { Download, AlertCircle, BookOpen, Loader2, Sparkles } from 'lucide-react';
import { useParams } from 'next/navigation';
import BookCoverImage from '@/components/BookCoverImage';
import SubscriptionModal from '@/components/SubscriptionModal';

export default function ShareBookPage() {
  const { id } = useParams();
  const [book, setBook] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);

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
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError('Sách không tồn tại hoặc đã bị xóa.');
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (book) {
      setIsDownloading(true);
      window.location.href = `${API_URL}/api/books/${book.id}/download`;
      setTimeout(() => setIsDownloading(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f7f4] flex items-center justify-center" suppressHydrationWarning>
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent" suppressHydrationWarning></div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="min-h-screen bg-[#f8f7f4] flex flex-col items-center justify-center p-4 text-center" suppressHydrationWarning>
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 max-w-md w-full" suppressHydrationWarning>
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-black mb-2">Oops!</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f7f4] font-sans flex flex-col items-center justify-center p-4 py-12 md:py-24" suppressHydrationWarning>
      {/* Brand Header */}
      <div className="absolute top-6 left-6 md:top-10 md:left-10 flex items-center">
         <h1 className="text-2xl font-extrabold text-black tracking-tight">
          BookCase<span className="text-orange-500">.</span>
        </h1>
      </div>

      {/* Book Card */}
      <div className="w-full max-w-5xl bg-white rounded-[2rem] shadow-xl overflow-hidden flex flex-col md:flex-row border border-gray-100">
        
        {/* Left Side: Cover Image */}
        <div className="w-full md:w-5/12 bg-gray-50 p-8 md:p-12 flex items-center justify-center border-b md:border-b-0 md:border-r border-gray-100">
          <div className="w-full max-w-[320px] aspect-[2/3] relative">
            <BookCoverImage 
              coverUrl={book.cover_url}
              bookId={book.id}
              title={book.title}
              author={book.author}
              className="absolute inset-0 w-full h-full object-cover rounded-2xl shadow-2xl"
            />
          </div>
        </div>

        {/* Right Side: Info & Actions */}
        <div className="w-full md:w-7/12 p-8 md:p-12 flex flex-col justify-center bg-white relative">
          
          <div className="mb-2">
            {book.genre ? (
              <span className="inline-block px-3 py-1 bg-orange-100 text-orange-700 font-bold text-xs rounded-full uppercase tracking-wider">
                {book.genre}
              </span>
            ) : (
              <span className="inline-block px-3 py-1 bg-gray-100 text-gray-500 font-bold text-xs rounded-full uppercase tracking-wider">
                Book
              </span>
            )}
          </div>

          <h1 className="text-3xl md:text-5xl font-black text-black leading-tight mb-2 tracking-tight">
            {book.title}
          </h1>
          
          <p className="text-lg md:text-xl text-gray-500 font-medium mb-6">
            bởi <span className="text-gray-800">{book.author || 'Unknown Author'}</span>
          </p>

          <div className="prose prose-sm text-gray-600 mb-8 line-clamp-4">
             {book.summary ? (
               <p>{book.summary}</p>
             ) : (
               <p className="italic text-gray-400">Không có mô tả cho cuốn sách này.</p>
             )}
          </div>

          <div className="mt-auto pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
             <button 
                onClick={handleDownload}
                disabled={isDownloading}
                className="btn-secondary flex items-center justify-center gap-3 py-4 px-8 shadow-lg hover:shadow-xl hover:-translate-y-1 disabled:opacity-70 disabled:hover:-translate-y-0"
             >
                {isDownloading ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
                <span>{isDownloading ? 'Đang Tải...' : 'Tải Sách Xuống'}</span>
             </button>

             <button
                onClick={() => setIsSubscriptionModalOpen(true)}
                className="bg-[#1F1D20] hover:bg-[#2A272A] border border-[#4D4845]/40 rounded-2xl py-3 px-6 text-left shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 cursor-pointer flex items-center gap-3"
                style={{ backgroundColor: '#1F1D20', color: '#F5ECDC' }}
             >
                <div className="p-2 bg-[#F5ECDC] rounded-xl shrink-0" style={{ backgroundColor: '#F5ECDC', color: '#000000' }}>
                   <Sparkles size={18} style={{ color: '#000000' }} />
                </div>
                <div>
                   <div className="text-base font-extrabold leading-tight text-[#F5ECDC]" style={{ color: '#F5ECDC' }}>
                      Đăng ký
                   </div>
                   <div className="text-xs text-[#D7C9B2] font-medium mt-0.5" style={{ color: '#D7C9B2' }}>
                      để tải thêm sách theo nhu cầu
                   </div>
                </div>
             </button>
          </div>

          <p className="text-xs text-gray-400 mt-4 text-center sm:text-left">
             Được chia sẻ thông qua nền tảng BookCase.
          </p>
        </div>
      </div>

      {/* Subscription Pricing Modal */}
      <SubscriptionModal 
        isOpen={isSubscriptionModalOpen}
        onClose={() => setIsSubscriptionModalOpen(false)}
      />
    </div>
  );
}
