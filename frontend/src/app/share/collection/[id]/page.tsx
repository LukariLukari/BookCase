'use client';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { Download, AlertCircle, Library, Link as LinkIcon, Upload, Loader2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import BookCoverImage from '@/components/BookCoverImage';

export default function ShareCollectionPage() {
  const { id } = useParams();
  const [collection, setCollection] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  useEffect(() => {
    if (id) {
      fetchCollection();
    }
  }, [id]);

  const fetchCollection = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/collections/${id}`);
      setCollection(res.data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError('Tệp sách không tồn tại hoặc đã bị xóa.');
      setLoading(false);
    }
  };

  const handleDownload = (book: any) => {
    setDownloadingId(book.id);
    window.location.href = `${API_URL}/api/books/${book.id}/download`;
    setTimeout(() => setDownloadingId(null), 1500);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1F1D20] flex items-center justify-center" suppressHydrationWarning>
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent" suppressHydrationWarning></div>
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className="min-h-screen bg-[#1F1D20] flex flex-col items-center justify-center p-4 text-center" suppressHydrationWarning>
        <div className="bg-[#2A272A] border border-[#4D4845]/50 p-8 rounded-3xl shadow-xl max-w-md w-full" suppressHydrationWarning>
          <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-[#F5ECDC] mb-2">Oops!</h1>
          <p className="text-[#D7C9B2]">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1F1D20] text-[#F5ECDC] font-sans flex flex-col items-center p-4 pt-8 md:pt-16 pb-24" suppressHydrationWarning>
      
      {/* Brand Header */}
      <div className="w-full max-w-6xl flex justify-between items-center mb-12 px-4">
         <h1 className="text-2xl font-extrabold text-[#F5ECDC] tracking-tight">
          BookCase<span className="text-orange-500">.</span>
        </h1>
      </div>

      {/* Collection Header Banner */}
      <div className="w-full max-w-6xl px-4 mb-12">
        <div className="bg-[#2A272A] rounded-3xl p-8 md:p-12 text-[#F5ECDC] shadow-2xl flex flex-col items-start relative overflow-hidden border border-[#4D4845]/50">
           <div className="text-left z-10">
             <span className="inline-block px-3.5 py-1 bg-orange-500/20 border border-orange-500/30 text-orange-400 font-bold text-xs rounded-full uppercase tracking-wider mb-3">
               Tệp Sách Được Chia Sẻ
             </span>
             <h1 className="text-3xl md:text-5xl font-black mb-3 text-[#F5ECDC] tracking-tight">{collection.name}</h1>
             {collection.description && (
               <p className="text-[#D7C9B2] text-lg max-w-2xl">{collection.description}</p>
             )}
             <p className="mt-4 text-[#D7C9B2] font-semibold text-sm">{collection.book_count} cuốn sách</p>
           </div>
        </div>
      </div>

      {/* Books Grid */}
      <div className="w-full max-w-6xl px-4">
        {collection.books.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-x-4 md:gap-x-6 gap-y-8 md:gap-y-10">
            {collection.books.map((book: any) => (
              <div key={book.id} className="flex flex-col group relative">
                {/* Cover Image */}
                <div className="w-full aspect-[2/3] relative z-10 mb-3 rounded-2xl overflow-hidden shadow-sm border border-[#4D4845]/40 group-hover:shadow-xl transition-all duration-300">
                   <BookCoverImage 
                     coverUrl={book.cover_url}
                     bookId={book.id}
                     title={book.title}
                     author={book.author}
                     className="w-full h-full object-cover"
                   />
                   
                   {/* Source Tag */}
                   <div className="absolute top-2 left-2 z-20">
                     {book.external_url ? (
                       <span className="flex items-center gap-1 text-orange-400 font-bold bg-[#1F1D20]/90 backdrop-blur px-2 py-1 rounded-lg text-[10px] shadow-sm border border-orange-500/30" title={book.external_url}>
                         <LinkIcon size={12} /> Drive
                       </span>
                     ) : (
                       <span className="flex items-center gap-1 text-[#D7C9B2] font-bold bg-[#1F1D20]/90 backdrop-blur px-2 py-1 rounded-lg text-[10px] shadow-sm border border-[#4D4845]/40">
                         <Upload size={12} /> Local
                       </span>
                     )}
                   </div>

                   {/* Overlay Actions (Download) */}
                   <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20 backdrop-blur-[2px]">
                       <button 
                         onClick={() => handleDownload(book)}
                         disabled={downloadingId === book.id} 
                         className="btn-primary shadow-lg hover:scale-105 disabled:opacity-70 disabled:hover:scale-100"
                       >
                         {downloadingId === book.id ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                         <span>{downloadingId === book.id ? 'Đang tải...' : 'Tải Xuống'}</span>
                       </button>
                   </div>
                </div>
                
                {/* Text Info */}
                <div className="px-1">
                  <h3 className="text-sm font-bold text-[#F5ECDC] leading-tight line-clamp-2">{book.title}</h3>
                  <p className="text-xs text-[#D7C9B2] mt-1">{book.author || 'Unknown Author'}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-24 bg-[#2A272A] rounded-3xl border border-[#4D4845]/50 shadow-sm">
            <Library size={48} className="text-[#7B7369] mx-auto mb-4" />
            <h3 className="text-xl font-bold text-[#F5ECDC] mb-2">Tệp sách trống</h3>
            <p className="text-[#D7C9B2]">Chưa có cuốn sách nào trong tệp này.</p>
          </div>
        )}
      </div>

    </div>
  );
}
