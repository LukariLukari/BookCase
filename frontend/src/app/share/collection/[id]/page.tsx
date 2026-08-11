'use client';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { Download, AlertCircle, Library, Link as LinkIcon, Upload } from 'lucide-react';
import { useParams } from 'next/navigation';

export default function ShareCollectionPage() {
  const { id } = useParams();
  const [collection, setCollection] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) {
      fetchCollection();
    }
  }, [id]);

  const fetchCollection = async () => {
    try {
      const res = await axios.get(`http://localhost:8000/api/collections/${id}`);
      setCollection(res.data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError('Tệp sách không tồn tại hoặc đã bị xóa.');
      setLoading(false);
    }
  };

  const handleDownload = (book: any) => {
    window.location.href = `http://localhost:8000/api/books/${book.id}/download`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f7f4] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
      </div>
    );
  }

  if (error || !collection) {
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
    <div className="min-h-screen bg-[#f8f7f4] font-sans flex flex-col items-center p-4 pt-8 md:pt-16 pb-24">
      
      {/* Brand Header */}
      <div className="w-full max-w-6xl flex justify-between items-center mb-12 px-4">
         <h1 className="text-2xl font-extrabold text-black tracking-tight">
          Kindle<span className="text-orange-500">.</span>
        </h1>
      </div>

      {/* Collection Header */}
      <div className="w-full max-w-6xl px-4 mb-12">
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-3xl p-8 md:p-12 text-white shadow-xl flex flex-col md:flex-row items-center md:items-start gap-8 relative overflow-hidden">
           {/* Decor circle */}
           <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
           <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-black/10 rounded-full blur-3xl pointer-events-none"></div>
           
           <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center flex-shrink-0 shadow-inner">
             <Library size={40} className="text-white" />
           </div>
           
           <div className="text-center md:text-left z-10">
             <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-sm text-white font-bold text-xs rounded-full uppercase tracking-wider mb-3">
               Tệp Sách Được Chia Sẻ
             </span>
             <h1 className="text-3xl md:text-5xl font-black mb-3">{collection.name}</h1>
             {collection.description && (
               <p className="text-white/80 text-lg max-w-2xl">{collection.description}</p>
             )}
             <p className="mt-4 text-white/60 font-medium">{collection.book_count} cuốn sách</p>
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
                <div className="w-full aspect-[2/3] relative z-10 mb-3 rounded-2xl overflow-hidden shadow-sm border border-gray-100 group-hover:shadow-xl transition-all duration-300">
                   {book.cover_url ? (
                     <img 
                        src={book.cover_url} 
                        className="w-full h-full object-cover" 
                        alt={book.title} 
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = 'https://placehold.co/400x600/e2e8f0/64748b?text=No+Cover';
                        }}
                      />
                   ) : (
                     <div className="w-full h-full bg-slate-100 flex items-center justify-center p-4 text-center">
                        <span className="font-bold text-gray-400 text-xs">{book.title}</span>
                     </div>
                   )}
                   
                   {/* Source Tag */}
                   <div className="absolute top-2 left-2 z-20">
                     {book.external_url ? (
                       <span className="flex items-center gap-1 text-orange-600 font-bold bg-orange-50/90 backdrop-blur px-2 py-1 rounded-lg text-[10px] shadow-sm border border-orange-100" title={book.external_url}>
                         <LinkIcon size={12} /> Drive
                       </span>
                     ) : (
                       <span className="flex items-center gap-1 text-gray-700 font-bold bg-white/90 backdrop-blur px-2 py-1 rounded-lg text-[10px] shadow-sm border border-gray-100">
                         <Upload size={12} /> Local
                       </span>
                     )}
                   </div>

                   {/* Overlay Actions (Download) */}
                   <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20 backdrop-blur-[2px]">
                       <button 
                         onClick={() => handleDownload(book)} 
                         className="flex items-center gap-2 px-5 py-2.5 bg-white text-black hover:bg-orange-500 hover:text-white rounded-full font-bold shadow-lg transition-colors transform hover:scale-105"
                       >
                         <Download size={16} />
                         <span>Tải Xuống</span>
                       </button>
                   </div>
                </div>
                
                {/* Text Info */}
                <div className="px-1">
                  <h3 className="text-sm font-bold text-black leading-tight line-clamp-2">{book.title}</h3>
                  <p className="text-xs text-gray-500 mt-1">{book.author || 'Unknown Author'}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-24 bg-white rounded-3xl border border-gray-100 shadow-sm">
            <Library size={48} className="text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-800 mb-2">Tệp sách trống</h3>
            <p className="text-gray-500">Chưa có cuốn sách nào trong tệp này.</p>
          </div>
        )}
      </div>

    </div>
  );
}
