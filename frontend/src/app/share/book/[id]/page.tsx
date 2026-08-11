'use client';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { Download, AlertCircle, BookOpen } from 'lucide-react';
import { useParams } from 'next/navigation';
import { getCoverUrl } from '@/utils/image';

export default function ShareBookPage() {
  const { id } = useParams();
  const [book, setBook] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) {
      fetchBook();
    }
  }, [id]);

  const fetchBook = async () => {
    try {
      const res = await axios.get(`http://localhost:8000/api/books/${id}`);
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
      window.location.href = `http://localhost:8000/api/books/${book.id}/download`;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f7f4] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="min-h-screen bg-[#f8f7f4] flex flex-col items-center justify-center p-4 text-center">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 max-w-md w-full">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-black mb-2">Oops!</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f7f4] font-sans flex flex-col items-center justify-center p-4 py-12 md:py-24">
      {/* Brand Header */}
      <div className="absolute top-6 left-6 md:top-10 md:left-10 flex items-center">
         <h1 className="text-2xl font-extrabold text-black tracking-tight">
          Kindle<span className="text-orange-500">.</span>
        </h1>
      </div>

      {/* Book Card */}
      <div className="w-full max-w-4xl bg-white rounded-[2rem] shadow-xl overflow-hidden flex flex-col md:flex-row border border-gray-100">
        
        {/* Left Side: Cover Image */}
        <div className="w-full md:w-5/12 bg-gray-100 relative min-h-[300px] md:min-h-[500px]">
          {book.cover_url ? (
            <img 
              src={getCoverUrl(book.cover_url)} 
              className="absolute inset-0 w-full h-full object-cover" 
              alt={book.title} 
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = 'https://placehold.co/400x600/e2e8f0/64748b?text=No+Cover';
              }}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-gray-100 to-gray-200">
              <BookOpen size={48} className="text-gray-300 mb-4" />
              <span className="font-bold text-gray-400 text-lg">{book.title}</span>
            </div>
          )}
          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
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

          <div className="prose prose-sm text-gray-600 mb-10 line-clamp-4">
             {book.summary ? (
               <p>{book.summary}</p>
             ) : (
               <p className="italic text-gray-400">Không có mô tả cho cuốn sách này.</p>
             )}
          </div>

          <div className="mt-auto pt-8 border-t border-gray-100">
             <button 
                onClick={handleDownload}
                className="w-full sm:w-auto flex items-center justify-center gap-3 bg-black hover:bg-gray-800 text-white font-bold py-4 px-8 rounded-2xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
             >
                <Download size={20} />
                <span>Tải Sách Xuống</span>
             </button>
             <p className="text-xs text-gray-400 mt-4 text-center sm:text-left">
               Được chia sẻ thông qua nền tảng Kindle.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}
