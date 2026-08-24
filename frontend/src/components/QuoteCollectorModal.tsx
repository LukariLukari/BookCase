'use client';
import { useState } from 'react';
import { 
  X, Camera, Upload, Plus, Trash2, Clipboard, CheckCircle2, 
  Quote as QuoteIcon, Loader2, Maximize2, Minimize2, FileText
} from 'lucide-react';
import axios from 'axios';

interface QuoteItem {
  text: string;
  pageNumber: string;
}

interface QuoteCollectorModalProps {
  bookId: string;
  onClose: () => void;
  onSaveSuccess?: () => void;
}

export default function QuoteCollectorModal({ bookId, onClose, onSaveSuccess }: QuoteCollectorModalProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<QuoteItem[]>([{ text: '', pageNumber: '' }]);
  const [isSaving, setIsSaving] = useState(false);
  const [pastedIndex, setPastedIndex] = useState<number | null>(null);
  const [isImageExpanded, setIsImageExpanded] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setImageSrc(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddQuoteBox = () => {
    setQuotes(prev => [...prev, { text: '', pageNumber: prev[prev.length - 1]?.pageNumber || '' }]);
  };

  const handleRemoveQuoteBox = (index: number) => {
    if (quotes.length === 1) {
      setQuotes([{ text: '', pageNumber: '' }]);
      return;
    }
    setQuotes(prev => prev.filter((_, i) => i !== index));
  };

  const handleTextChange = (index: number, val: string) => {
    setQuotes(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], text: val };
      return copy;
    });
  };

  const handlePageChange = (index: number, val: string) => {
    setQuotes(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], pageNumber: val };
      return copy;
    });
  };

  const handlePasteClipboard = async (index: number) => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          handleTextChange(index, text);
          setPastedIndex(index);
          setTimeout(() => setPastedIndex(null), 1500);
          return;
        }
      }
    } catch (err) {
      console.warn("Clipboard access warning:", err);
    }

    const el = document.getElementById(`quote-textarea-${index}`) as HTMLTextAreaElement;
    if (el) {
      el.focus();
    }
  };

  const handleSaveAll = async () => {
    const validQuotes = quotes.filter(q => q.text.trim().length > 0);

    if (validQuotes.length === 0 && !imageSrc) {
      alert("Vui lòng tải ảnh hoặc nhập ít nhất một đoạn trích dẫn.");
      return;
    }

    setIsSaving(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const token = localStorage.getItem('token');

      if (validQuotes.length > 0) {
        for (const item of validQuotes) {
          const parsedPage = item.pageNumber ? parseInt(item.pageNumber, 10) : null;
          await axios.post(`${API_URL}/api/users/me/books/${bookId}/quotes`, {
            image_url: imageSrc || "",
            text_content: item.text.trim(),
            page_number: isNaN(parsedPage as number) ? null : parsedPage
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
        }
      } else if (imageSrc) {
        await axios.post(`${API_URL}/api/users/me/books/${bookId}/quotes`, {
          image_url: imageSrc,
          text_content: "",
          page_number: null
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      if (onSaveSuccess) onSaveSuccess();
      onClose();
    } catch (err) {
      console.error("Lỗi khi lưu quote:", err);
      alert("Lỗi khi lưu trích dẫn. Vui lòng thử lại.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-3 md:p-4 backdrop-blur-md">
      <div className="relative bg-[#1F1D20] border border-[#4D4845]/50 rounded-3xl p-5 md:p-8 max-w-2xl w-full shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#4D4845]/40 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#2A272A] rounded-xl text-[#F5ECDC] border border-[#4D4845]/50 shadow-inner">
              <QuoteIcon size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-[#F5ECDC]">Tạo Trích Dẫn</h2>
              <p className="text-xs text-[#D7C9B2]">Lưu các câu nói hay & đánh số trang sách</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-[#D7C9B2] hover:text-[#F5ECDC] bg-[#2A272A] hover:bg-[#3A373A] rounded-full transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-6">
          
          {/* Photo Reference Picker */}
          <div className="bg-[#2A272A]/70 border border-[#4D4845]/50 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-bold text-[#F5ECDC] flex items-center gap-1.5">
                <FileText size={15} className="text-[#D7C9B2]" />
                <span>1. Ảnh chụp trang sách <span className="text-xs text-[#8A817C] font-normal">(Tùy chọn)</span></span>
              </label>
              {imageSrc && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsImageExpanded(!isImageExpanded)}
                    className="flex items-center gap-1 text-xs text-[#D7C9B2] hover:text-[#F5ECDC] bg-[#1F1D20] px-2.5 py-1 rounded-lg border border-[#4D4845]/60 transition-colors"
                  >
                    {isImageExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                    <span>{isImageExpanded ? "Thu nhỏ" : "Phóng to"}</span>
                  </button>
                </div>
              )}
            </div>

            {imageSrc ? (
              <div className="space-y-3">
                <div className={`relative w-full rounded-xl overflow-hidden bg-black/60 border border-[#4D4845]/60 flex items-center justify-center transition-all ${
                  isImageExpanded ? 'max-h-[75vh]' : 'max-h-[46vh] min-h-[220px]'
                }`}>
                  <img 
                    src={imageSrc} 
                    alt="Book page reference" 
                    className={`w-full object-contain ${isImageExpanded ? 'max-h-[75vh]' : 'max-h-[46vh]'}`} 
                  />
                  
                  <button 
                    onClick={() => setImageSrc(null)}
                    className="absolute top-3 right-3 p-2 bg-red-500/80 hover:bg-red-600 text-white rounded-full backdrop-blur-sm transition-colors shadow-lg cursor-pointer flex items-center gap-1 px-3 text-xs font-bold"
                    title="Xóa ảnh"
                  >
                    <Trash2 size={13} />
                    <span>Xóa ảnh</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col items-center justify-center py-6 border border-dashed border-[#F5ECDC]/30 rounded-xl cursor-pointer hover:bg-[#3A373A] transition-colors bg-[#1F1D20]">
                  <Camera size={24} className="text-[#F5ECDC] mb-1.5" />
                  <span className="text-xs font-bold text-[#F5ECDC]">Chụp ảnh trang sách</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageUpload} />
                </label>

                <label className="flex flex-col items-center justify-center py-6 border border-dashed border-[#4D4845] rounded-xl cursor-pointer hover:bg-[#3A373A] transition-colors bg-[#1F1D20]">
                  <Upload size={24} className="text-[#D7C9B2] mb-1.5" />
                  <span className="text-xs font-bold text-[#D7C9B2]">Tải ảnh từ máy</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
              </div>
            )}
          </div>

          {/* Quote Text Cards Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-bold text-[#F5ECDC]">
                2. Nội dung các đoạn trích dẫn (Quote Cards)
              </label>
              
              <button 
                onClick={handleAddQuoteBox}
                className="text-xs font-bold bg-[#F5ECDC] hover:bg-white px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                style={{ color: '#1F1D20' }}
              >
                <Plus size={14} className="stroke-[2.5]" />
                <span>Thêm ô Quote</span>
              </button>
            </div>

            {quotes.map((item, idx) => (
              <div 
                key={idx} 
                className="relative bg-[#2A272A] border border-[#4D4845] rounded-2xl p-4 shadow-md focus-within:border-[#F5ECDC]/60 transition-colors space-y-3"
              >
                <div className="relative">
                  <span className="absolute top-2 left-2 text-3xl font-serif text-[#F5ECDC]/20 select-none pointer-events-none">“</span>
                  
                  <textarea
                    id={`quote-textarea-${idx}`}
                    value={item.text}
                    onChange={(e) => handleTextChange(idx, e.target.value)}
                    placeholder="Nhập hoặc dán nội dung trích dẫn vào đây..."
                    rows={3}
                    className="w-full bg-transparent text-[#F5ECDC] placeholder-[#7B7369] text-sm font-medium focus:outline-none resize-none pt-4 px-3"
                  />

                  <span className="absolute bottom-2 right-3 text-3xl font-serif text-[#F5ECDC]/20 select-none pointer-events-none">”</span>
                </div>

                {/* Bottom Row: Page Number + Paste + Remove */}
                <div className="flex items-center justify-between pt-2 border-t border-[#4D4845]/40 gap-3">
                  
                  {/* Page Number Field */}
                  <div className="flex items-center gap-2 bg-[#1F1D20] border border-[#4D4845]/60 rounded-lg px-2.5 py-1">
                    <span className="text-xs text-[#D7C9B2] font-semibold">Trang:</span>
                    <input
                      type="number"
                      value={item.pageNumber}
                      onChange={(e) => handlePageChange(idx, e.target.value)}
                      placeholder="34"
                      className="w-14 bg-transparent text-[#F5ECDC] text-xs font-bold focus:outline-none placeholder-[#5A534E]"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handlePasteClipboard(idx)}
                      className="flex items-center gap-1.5 text-xs font-bold text-[#F5ECDC] bg-[#1F1D20] hover:bg-[#3A373A] border border-[#4D4845]/60 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      {pastedIndex === idx ? (
                        <>
                          <CheckCircle2 size={13} className="text-emerald-400" />
                          <span className="text-emerald-400 font-bold">Đã dán!</span>
                        </>
                      ) : (
                        <>
                          <Clipboard size={13} className="text-[#F5ECDC]" />
                          <span>Dán</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRemoveQuoteBox(idx)}
                      className="text-xs text-red-400 hover:text-red-300 hover:bg-red-950/40 border border-red-500/20 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                      title={quotes.length === 1 ? "Xóa nội dung ô này" : "Xóa ô này"}
                    >
                      <Trash2 size={13} />
                      <span>{quotes.length === 1 ? "Xóa" : "Xóa ô"}</span>
                    </button>
                  </div>

                </div>
              </div>
            ))}
          </div>

        </div>

        {/* Footer Actions */}
        <div className="mt-6 pt-4 border-t border-[#4D4845]/40 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-[#2A272A] hover:bg-[#3A373A] text-[#F5ECDC] border border-[#4D4845] py-3 rounded-xl font-bold text-sm transition-colors cursor-pointer"
          >
            Hủy
          </button>
          
          <button
            onClick={handleSaveAll}
            disabled={isSaving}
            className="flex-1 bg-[#F5ECDC] hover:bg-white py-3 rounded-xl font-bold text-sm shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            style={{ color: '#1F1D20' }}
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            <span>{isSaving ? 'Đang lưu...' : 'Lưu Trích Dẫn'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
