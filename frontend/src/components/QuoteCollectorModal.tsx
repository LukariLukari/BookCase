'use client';
import { useState, useEffect } from 'react';
import { 
  X, Camera, Upload, Plus, Trash2, Clipboard, CheckCircle2, 
  Quote as QuoteIcon, Loader2, Maximize2, Minimize2, 
  FileText, ArrowDownToLine, ScanLine, Copy, Check, Key, Settings2
} from 'lucide-react';
import axios from 'axios';
import Tesseract from 'tesseract.js';

interface QuoteItem {
  text: string;
  pageNumber: string;
}

interface QuoteCollectorModalProps {
  bookId: string;
  onClose: () => void;
  onSaveSuccess?: () => void;
}

// Client-Side Canvas Pre-processing for Fallback Tesseract
const preprocessImageForOcr = (imageSrc: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(imageSrc);
        return;
      }

      const maxDim = 1800;
      let width = img.width;
      let height = img.height;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;

      let totalGray = 0;
      for (let i = 0; i < data.length; i += 4) {
        totalGray += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }
      const avgGray = totalGray / (data.length / 4);
      const threshold = avgGray * 0.9;

      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const enhanced = gray < threshold ? Math.max(0, gray - 50) : Math.min(255, gray + 40);
        data[i] = enhanced;
        data[i + 1] = enhanced;
        data[i + 2] = enhanced;
      }

      ctx.putImageData(imgData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(imageSrc);
    img.src = imageSrc;
  });
};

export default function QuoteCollectorModal({ bookId, onClose, onSaveSuccess }: QuoteCollectorModalProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<QuoteItem[]>([{ text: '', pageNumber: '' }]);
  const [isSaving, setIsSaving] = useState(false);
  const [pastedIndex, setPastedIndex] = useState<number | null>(null);
  const [isImageExpanded, setIsImageExpanded] = useState(false);

  // OCR States
  const [isOcrScanning, setIsOcrScanning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatus, setOcrStatus] = useState('');
  const [detectedSentences, setDetectedSentences] = useState<string[]>([]);
  const [detectedRawText, setDetectedRawText] = useState<string | null>(null);
  const [copiedRaw, setCopiedRaw] = useState(false);

  // Free Gemini API Key Settings
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [showKeySetting, setShowKeySetting] = useState(false);
  const [savedKeySuccess, setSavedKeySuccess] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('bookcase_gemini_key') || '';
    setGeminiApiKey(saved);
  }, []);

  const handleSaveGeminiKey = (keyVal: string) => {
    setGeminiApiKey(keyVal);
    localStorage.setItem('bookcase_gemini_key', keyVal.trim());
    setSavedKeySuccess(true);
    setTimeout(() => setSavedKeySuccess(false), 2000);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setImageSrc(result);
        setDetectedSentences([]);
        setDetectedRawText(null);
      };
      reader.readAsDataURL(file);
    }
  };

  // OCR Scanning: Prioritizes Gemini AI Vision (100% accurate, Free) then Fallback to Tesseract
  const handleRunOcr = async () => {
    if (!imageSrc) return;
    setIsOcrScanning(true);
    setOcrProgress(15);
    setOcrStatus('Đang gửi ảnh phân tích AI...');

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const token = localStorage.getItem('token');
    const userStoredKey = localStorage.getItem('bookcase_gemini_key') || '';

    // Attempt 1: Backend Gemini AI Vision OCR
    try {
      const res = await axios.post(`${API_URL}/api/ocr/scan`, {
        image_base64: imageSrc,
        api_key: userStoredKey
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data && res.data.full_text) {
        const raw = res.data.full_text.trim();
        const page = res.data.page_number ? String(res.data.page_number) : '';
        const sentences = (res.data.sentences && res.data.sentences.length > 0)
          ? res.data.sentences
          : raw.split(/\n+/).filter((s: string) => s.trim().length > 10);

        setDetectedRawText(raw);
        setDetectedSentences(sentences);

        // Auto fill into empty quote box
        if (sentences.length > 0 && quotes.length === 1 && !quotes[0].text.trim()) {
          setQuotes([{ text: sentences[0], pageNumber: page }]);
        } else if (page && quotes.length >= 1 && !quotes[0].pageNumber) {
          setQuotes(prev => prev.map((q, i) => i === 0 ? { ...q, pageNumber: page } : q));
        }

        setIsOcrScanning(false);
        setOcrProgress(100);
        return;
      }
    } catch (err: any) {
      console.warn("Backend Gemini OCR not available or failed, falling back to local OCR:", err?.response?.data || err);
      // If error was missing API key, show helpful prompt
      if (!userStoredKey) {
        setShowKeySetting(true);
      }
    }

    // Attempt 2: Fallback to Client Tesseract
    setOcrStatus('Chạy bộ nhận diện dự phòng...');
    setOcrProgress(40);

    try {
      const processedImage = await preprocessImageForOcr(imageSrc);
      const { data } = await Tesseract.recognize(
        processedImage,
        'vie',
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              setOcrStatus('Đang đọc chữ Tiếng Việt...');
              setOcrProgress(40 + Math.round(m.progress * 55));
            }
          }
        }
      );

      const rawText = (data.text || '').trim();
      setDetectedRawText(rawText);

      const pageMatch = rawText.match(/(?:trang|page|\b)\s*(\d{1,4})\b/i);
      const likelyPage = pageMatch ? pageMatch[1] : '';

      const cleaned = rawText
        .split(/\n{2,}|\.\s+(?=[A-ZÀ-Ỹ])/)
        .map(s => s.replace(/\n/g, ' ').replace(/\s{2,}/g, ' ').trim())
        .filter(s => s.length > 10);

      setDetectedSentences(cleaned);

      if (cleaned.length > 0 && quotes.length === 1 && !quotes[0].text.trim()) {
        setQuotes([{ text: cleaned[0], pageNumber: likelyPage }]);
      }
    } catch (err) {
      console.error("Tesseract scan failed:", err);
      alert("Không thể quét ảnh. Bạn có thể sử dụng nút Dán trực tiếp nhé!");
    } finally {
      setIsOcrScanning(false);
      setOcrProgress(100);
    }
  };

  const handleAddSentenceToQuote = (sentence: string) => {
    const emptyIndex = quotes.findIndex(q => !q.text.trim());
    if (emptyIndex !== -1) {
      setQuotes(prev => {
        const copy = [...prev];
        copy[emptyIndex] = { ...copy[emptyIndex], text: sentence };
        return copy;
      });
    } else {
      setQuotes(prev => [...prev, { text: sentence, pageNumber: prev[prev.length - 1]?.pageNumber || '' }]);
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

  const handleCopyRawText = async () => {
    if (!detectedRawText) return;
    try {
      await navigator.clipboard.writeText(detectedRawText);
      setCopiedRaw(true);
      setTimeout(() => setCopiedRaw(false), 2000);
    } catch {}
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
      <div className="relative bg-[#1F1D20] border border-[#4D4845]/50 rounded-3xl p-5 md:p-8 max-w-3xl w-full shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#4D4845]/40 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#2A272A] rounded-xl text-[#F5ECDC] border border-[#4D4845]/50 shadow-inner">
              <QuoteIcon size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-[#F5ECDC]">Tạo Trích Dẫn</h2>
              <p className="text-xs text-[#D7C9B2]">Quét chữ từ ảnh trang sách & đánh số trang</p>
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
          
          {/* Photo Reference Picker + OCR Action */}
          <div className="bg-[#2A272A]/70 border border-[#4D4845]/50 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-bold text-[#F5ECDC] flex items-center gap-1.5">
                <FileText size={15} className="text-[#D7C9B2]" />
                <span>1. Ảnh trang sách đối chiếu</span>
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
                    onClick={() => {
                      setImageSrc(null);
                      setDetectedSentences([]);
                      setDetectedRawText(null);
                    }}
                    className="absolute top-3 right-3 p-2 bg-red-500/80 hover:bg-red-600 text-white rounded-full backdrop-blur-sm transition-colors shadow-lg cursor-pointer flex items-center gap-1 px-3 text-xs font-bold"
                    title="Xóa ảnh"
                  >
                    <Trash2 size={13} />
                    <span>Xóa ảnh</span>
                  </button>
                </div>

                {/* OCR Scanner Button & Progress Bar */}
                <div className="bg-[#1F1D20] border border-[#4D4845]/60 rounded-xl p-3.5 space-y-3">
                  {!isOcrScanning ? (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div className="text-xs text-[#D7C9B2]">
                        Nhận diện toàn bộ văn bản tiếng Việt từ ảnh
                      </div>
                      <button
                        onClick={handleRunOcr}
                        className="w-full sm:w-auto bg-[#F5ECDC] hover:bg-white font-bold text-xs px-4 py-2 rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer flex-shrink-0"
                        style={{ color: '#1F1D20' }}
                      >
                        <ScanLine size={15} />
                        <span>Quét chữ</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#F5ECDC] font-bold flex items-center gap-2">
                          <Loader2 size={14} className="animate-spin text-[#D7C9B2]" />
                          {ocrStatus}
                        </span>
                        <span className="font-bold text-[#F5ECDC]">{ocrProgress}%</span>
                      </div>
                      <div className="w-full h-2 bg-[#2A272A] rounded-full overflow-hidden border border-[#4D4845]">
                        <div 
                          className="h-full bg-[#F5ECDC] transition-all duration-300 rounded-full" 
                          style={{ width: `${ocrProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Free Gemini API Key Toggle for 100% Accuracy */}
                  <div className="pt-2 border-t border-[#4D4845]/30">
                    <button 
                      type="button"
                      onClick={() => setShowKeySetting(!showKeySetting)}
                      className="text-[11px] text-[#D7C9B2] hover:text-[#F5ECDC] flex items-center gap-1.5 font-medium transition-colors"
                    >
                      <Key size={12} className="text-amber-400" />
                      <span>{geminiApiKey ? "✅ Đang dùng Google AI Key (Quét chính xác 100%)" : "⚙️ Cài Google AI Key để quét chính xác 100% (Free vĩnh viễn)"}</span>
                    </button>

                    {showKeySetting && (
                      <div className="mt-2.5 p-3 bg-[#2A272A] border border-[#4D4845]/60 rounded-xl space-y-2">
                        <p className="text-[11px] text-[#D7C9B2] leading-relaxed">
                          Tesseract OCR thông thường dễ nhận diện sai dấu trên ảnh cong. Nhập <strong>Google Gemini API Key</strong> (miễn phí 100% tại <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-amber-400 underline font-bold">aistudio.google.com</a>) để đọc chuẩn xác 100% từng từ ngữ:
                        </p>
                        <div className="flex gap-2">
                          <input 
                            type="password"
                            value={geminiApiKey}
                            onChange={(e) => setGeminiApiKey(e.target.value)}
                            placeholder="Dán mã AI Key AIzaSy... vào đây"
                            className="flex-1 bg-[#1F1D20] border border-[#4D4845] text-xs text-[#F5ECDC] px-3 py-1.5 rounded-lg focus:outline-none focus:border-[#F5ECDC]/50 font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveGeminiKey(geminiApiKey)}
                            className="bg-[#F5ECDC] text-[#1F1D20] font-bold text-xs px-3 py-1.5 rounded-lg shadow-sm"
                            style={{ color: '#1F1D20' }}
                          >
                            {savedKeySuccess ? "Đã lưu!" : "Lưu"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* OCR Smart Chips Section */}
                  {detectedSentences.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[#4D4845]/40 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-[#F5ECDC] flex items-center gap-1.5">
                          <ArrowDownToLine size={13} /> Chạm vào đoạn văn để đưa vào ô trích dẫn:
                        </p>
                        {detectedRawText && (
                          <button
                            onClick={handleCopyRawText}
                            className="text-[11px] font-bold text-[#D7C9B2] hover:text-[#F5ECDC] flex items-center gap-1 bg-[#2A272A] px-2 py-0.5 rounded-md border border-[#4D4845]/60 transition-colors"
                          >
                            {copiedRaw ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                            <span>{copiedRaw ? "Đã copy" : "Copy tất cả"}</span>
                          </button>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1">
                        {detectedSentences.map((sentence, sIdx) => (
                          <button
                            key={sIdx}
                            onClick={() => handleAddSentenceToQuote(sentence)}
                            className="text-left text-xs bg-[#2A272A] hover:bg-[#3A373A] text-[#F5ECDC] border border-[#4D4845] hover:border-[#F5ECDC]/50 p-2.5 rounded-xl transition-all shadow-sm leading-relaxed group cursor-pointer"
                          >
                            <span className="text-[#D7C9B2] font-bold mr-1 group-hover:text-white">+</span> {sentence}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
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
                    placeholder="Nhập nội dung trích dẫn hoặc bấm vào đoạn văn ở trên..."
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
            disabled={isSaving || isOcrScanning}
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
