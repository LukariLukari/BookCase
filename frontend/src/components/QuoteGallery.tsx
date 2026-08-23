'use client';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2, Camera, X } from 'lucide-react';
import HighlightEditor from './HighlightEditor';

interface Quote {
  id: string;
  image_url: string;
  created_at: string;
  text_content?: string;
}

export default function QuoteGallery({ userBookId }: { userBookId: string }) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<string | null>(null);

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

  useEffect(() => {
    fetchQuotes();
  }, [userBookId]);

  return (
    <div className="w-full mt-8">
      <div className="flex items-center justify-between mb-6 border-b border-[#4D4845]/40 pb-4">
        <h3 className="text-xl font-bold text-[#F5ECDC]">Trích dẫn của tôi</h3>
        <button 
          onClick={() => setIsEditorOpen(true)}
          className="bg-[#F5ECDC] text-black font-bold py-2 px-4 rounded-xl flex items-center gap-2 hover:bg-white transition-colors shadow-md"
        >
          <Camera size={18} />
          <span>Thêm Trích Dẫn</span>
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-[#D7C9B2]" /></div>
      ) : quotes.length === 0 ? (
        <div className="bg-[#2A272A] rounded-2xl border border-[#4D4845] p-10 text-center flex flex-col items-center">
          <Camera size={40} className="text-[#4D4845] mb-4" />
          <p className="text-[#D7C9B2] font-medium mb-2">Bạn chưa có trích dẫn nào cho cuốn sách này.</p>
          <p className="text-sm text-[#8A817C]">Hãy chụp một trang sách và tô sáng dòng chữ bạn tâm đắc nhất nhé!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {quotes.map(quote => (
            <div 
              key={quote.id} 
              className="bg-[#1F1D20] border border-[#4D4845]/60 rounded-xl overflow-hidden cursor-pointer hover:border-[#F5ECDC]/50 transition-colors relative group"
              onClick={() => setSelectedQuote(quote.image_url)}
            >
              <div className="aspect-[4/3] w-full relative">
                <img src={quote.image_url} alt="Quote" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      {isEditorOpen && (
        <HighlightEditor 
          bookId={userBookId} 
          onClose={() => setIsEditorOpen(false)} 
          onSaveSuccess={fetchQuotes} 
        />
      )}

      {/* Image Viewer Modal */}
      {selectedQuote && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedQuote(null)}>
          <button className="absolute top-6 right-6 p-2 text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10" onClick={() => setSelectedQuote(null)}>
             <X size={24} />
          </button>
          <img src={selectedQuote} alt="Quote Full" className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
