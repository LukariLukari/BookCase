'use client';
import { useState, useRef, useEffect } from 'react';
import { 
  X, Camera, Upload, Plus, Trash2, Clipboard, CheckCircle2, 
  Quote as QuoteIcon, Loader2, Maximize2, Minimize2, FileText,
  Crop, Sliders, Check, RefreshCw
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

// Client-side image compression
const compressImageFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        const maxDim = 1400;
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

        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve(compressedDataUrl);
      };
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export default function QuoteCollectorModal({ bookId, onClose, onSaveSuccess }: QuoteCollectorModalProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [rawUploadedSrc, setRawUploadedSrc] = useState<string | null>(null);
  const [isCompressingImage, setIsCompressingImage] = useState(false);
  const [quotes, setQuotes] = useState<QuoteItem[]>([{ text: '', pageNumber: '' }]);
  const [isSaving, setIsSaving] = useState(false);
  const [pastedIndex, setPastedIndex] = useState<number | null>(null);
  const [isImageExpanded, setIsImageExpanded] = useState(false);

  // Live Camera Viewfinder States
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [frameHeightRatio, setFrameHeightRatio] = useState<number>(0.35); // 35% height
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Static Image Cropper States (for uploaded photos)
  const [isCroppingStatic, setIsCroppingStatic] = useState(false);
  const [cropTopPercent, setCropTopPercent] = useState(25); // 0 - 100
  const [cropHeightPercent, setCropHeightPercent] = useState(35); // 15 - 80

  // Start Live Camera with Frame Overlay
  const handleStartLiveCamera = async () => {
    setCameraError(null);
    setIsCameraActive(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Trình duyệt không hỗ trợ truy cập camera trực tiếp.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.error("Camera access failed:", err);
      setCameraError(err.message || "Không thể mở camera. Vui lòng cấp quyền truy cập camera.");
      setIsCameraActive(false);
    }
  };

  // Stop Live Camera
  const handleStopLiveCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Capture Framed Snippet from Live Video
  const handleCaptureFramedSnippet = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const videoWidth = video.videoWidth || 1280;
    const videoHeight = video.videoHeight || 720;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate crop rectangle based on frameHeightRatio
    // Frame is centered horizontally (with 5% margin) and centered vertically
    const cropWidth = Math.round(videoWidth * 0.9);
    const cropHeight = Math.round(videoHeight * frameHeightRatio);
    const cropX = Math.round((videoWidth - cropWidth) / 2);
    const cropY = Math.round((videoHeight - cropHeight) / 2);

    canvas.width = cropWidth;
    canvas.height = cropHeight;

    ctx.drawImage(
      video,
      cropX, cropY, cropWidth, cropHeight, // Source
      0, 0, cropWidth, cropHeight          // Destination
    );

    const croppedSnippet = canvas.toDataURL('image/jpeg', 0.85);
    setImageSrc(croppedSnippet);
    setRawUploadedSrc(null);
    handleStopLiveCamera();
  };

  // Handle Standard Image Upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsCompressingImage(true);
      try {
        const compressed = await compressImageFile(file);
        setRawUploadedSrc(compressed);
        setImageSrc(compressed);
        setIsCroppingStatic(true); // Open crop frame immediately
      } catch (err) {
        console.error('Image compression failed:', err);
      } finally {
        setIsCompressingImage(false);
      }
    }
  };

  // Apply Static Crop on Uploaded Image
  const handleApplyStaticCrop = () => {
    if (!rawUploadedSrc) {
      setIsCroppingStatic(false);
      return;
    }

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setIsCroppingStatic(false);
        return;
      }

      const imgWidth = img.width;
      const imgHeight = img.height;

      const cropY = Math.round((cropTopPercent / 100) * imgHeight);
      const cropHeight = Math.round((cropHeightPercent / 100) * imgHeight);
      const safeHeight = Math.min(cropHeight, imgHeight - cropY);

      canvas.width = imgWidth;
      canvas.height = safeHeight;

      ctx.drawImage(
        img,
        0, cropY, imgWidth, safeHeight,
        0, 0, imgWidth, safeHeight
      );

      const croppedUrl = canvas.toDataURL('image/jpeg', 0.85);
      setImageSrc(croppedUrl);
      setIsCroppingStatic(false);
    };
    img.src = rawUploadedSrc;
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
      alert("Vui lòng chụp ảnh hoặc nhập ít nhất một đoạn trích dẫn.");
      return;
    }

    setIsSaving(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const token = localStorage.getItem('token');

      const batchPayload = {
        image_url: imageSrc || "",
        quotes: validQuotes.map(item => {
          const parsedPage = item.pageNumber ? parseInt(item.pageNumber, 10) : null;
          return {
            text_content: item.text.trim(),
            page_number: isNaN(parsedPage as number) ? null : parsedPage
          };
        })
      };

      try {
        await axios.post(`${API_URL}/api/users/me/books/${bookId}/quotes/batch`, batchPayload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (batchErr) {
        console.warn("Batch endpoint fallback to individual quote save:", batchErr);
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
      }

      if (onSaveSuccess) onSaveSuccess();
      onClose();
    } catch (err: any) {
      console.error("Lỗi khi lưu quote:", err);
      const errMsg = err.response?.data?.detail || "Lỗi khi lưu trích dẫn. Vui lòng thử lại.";
      alert(errMsg);
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
              <p className="text-xs text-[#D7C9B2]">Canh khung đoạn sách & lưu lại số trang</p>
            </div>
          </div>
          <button 
            onClick={() => {
              handleStopLiveCamera();
              onClose();
            }} 
            className="p-2 text-[#D7C9B2] hover:text-[#F5ECDC] bg-[#2A272A] hover:bg-[#3A373A] rounded-full transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-6">
          
          {/* Section 1: Book Snippet Camera / Frame Capture */}
          <div className="bg-[#2A272A]/70 border border-[#4D4845]/50 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-bold text-[#F5ECDC] flex items-center gap-1.5">
                <FileText size={15} className="text-[#D7C9B2]" />
                <span>1. Canh khung ảnh đoạn sách <span className="text-xs text-[#8A817C] font-normal">(Tùy chọn)</span></span>
              </label>
              
              {imageSrc && !isCameraActive && (
                <div className="flex items-center gap-2">
                  {rawUploadedSrc && (
                    <button
                      onClick={() => setIsCroppingStatic(true)}
                      className="flex items-center gap-1 text-xs text-[#F5ECDC] bg-[#1F1D20] px-2.5 py-1 rounded-lg border border-[#4D4845]/60 hover:bg-[#3A373A] transition-colors"
                    >
                      <Crop size={13} />
                      <span>Chỉnh khung</span>
                    </button>
                  )}
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

            {/* LIVE CAMERA VIEWFINDER WITH GOLDEN FOCUS FRAME */}
            {isCameraActive ? (
              <div className="relative rounded-2xl overflow-hidden bg-black border border-[#F5ECDC]/40 shadow-2xl flex flex-col items-center">
                <div className="relative w-full aspect-[4/3] md:aspect-[16/10] bg-black flex items-center justify-center overflow-hidden">
                  <video 
                    ref={videoRef} 
                    playsInline 
                    autoPlay 
                    muted 
                    className="w-full h-full object-cover" 
                  />

                  {/* Darkened Mask Outside the Frame */}
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                    {/* Top Mask */}
                    <div className="w-full bg-black/60 backdrop-blur-[1px] transition-all" style={{ height: `${(1 - frameHeightRatio) * 50}%` }} />
                    
                    {/* Centered Golden Snippet Viewfinder Frame */}
                    <div 
                      className="w-[92%] border-2 border-[#F5ECDC] rounded-xl shadow-[0_0_20px_rgba(245,236,220,0.35)] relative flex items-center justify-center transition-all bg-transparent"
                      style={{ height: `${frameHeightRatio * 100}%` }}
                    >
                      {/* Corner Accents */}
                      <span className="absolute -top-1 -left-1 w-3.5 h-3.5 border-t-2 border-l-2 border-white rounded-tl" />
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 border-t-2 border-r-2 border-white rounded-tr" />
                      <span className="absolute -bottom-1 -left-1 w-3.5 h-3.5 border-b-2 border-l-2 border-white rounded-bl" />
                      <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 border-b-2 border-r-2 border-white rounded-br" />
                      
                      {/* Center Guide Label */}
                      <span className="text-[11px] font-bold text-[#F5ECDC] bg-black/70 px-3 py-1 rounded-full border border-white/20 tracking-wide pointer-events-none shadow-md">
                        ĐẶT ĐOẠN SÁCH CẦN LƯU VÀO ĐÂY
                      </span>
                    </div>

                    {/* Bottom Mask */}
                    <div className="w-full bg-black/60 backdrop-blur-[1px] transition-all" style={{ height: `${(1 - frameHeightRatio) * 50}%` }} />
                  </div>
                </div>

                {/* Viewfinder Controls & Height Ratio Buttons */}
                <div className="w-full bg-[#181618] p-3 border-t border-[#4D4845]/50 flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#D7C9B2] font-semibold">Khổ khung chụp:</span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setFrameHeightRatio(0.22)}
                        className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${frameHeightRatio === 0.22 ? 'bg-[#F5ECDC] text-[#1F1D20]' : 'bg-[#2A272A] text-[#D7C9B2]'}`}
                      >
                        1 - 2 Dòng
                      </button>
                      <button
                        type="button"
                        onClick={() => setFrameHeightRatio(0.38)}
                        className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${frameHeightRatio === 0.38 ? 'bg-[#F5ECDC] text-[#1F1D20]' : 'bg-[#2A272A] text-[#D7C9B2]'}`}
                      >
                        Khổ vừa
                      </button>
                      <button
                        type="button"
                        onClick={() => setFrameHeightRatio(0.60)}
                        className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${frameHeightRatio === 0.60 ? 'bg-[#F5ECDC] text-[#1F1D20]' : 'bg-[#2A272A] text-[#D7C9B2]'}`}
                      >
                        Cả đoạn dài
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-1">
                    <button
                      type="button"
                      onClick={handleStopLiveCamera}
                      className="px-4 py-2 bg-[#2A272A] text-[#D7C9B2] hover:text-[#F5ECDC] rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Đóng Camera
                    </button>

                    {/* Big Capture Button */}
                    <button
                      type="button"
                      onClick={handleCaptureFramedSnippet}
                      className="flex-1 bg-[#F5ECDC] hover:bg-white py-2.5 px-4 rounded-xl font-bold text-xs shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
                      style={{ color: '#1F1D20' }}
                    >
                      <Camera size={16} />
                      <span>Chụp đúng đoạn này</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : isCroppingStatic && rawUploadedSrc ? (
              /* STATIC CROPPER FOR UPLOADED PHOTOS */
              <div className="space-y-3 bg-[#1F1D20] border border-[#4D4845] rounded-xl p-3.5">
                <div className="flex items-center justify-between text-xs font-bold text-[#F5ECDC]">
                  <span className="flex items-center gap-1.5">
                    <Crop size={14} className="text-[#D7C9B2]" /> Kéo thanh trượt để chọn đúng đoạn sách:
                  </span>
                  <button
                    onClick={() => {
                      setImageSrc(rawUploadedSrc);
                      setIsCroppingStatic(false);
                    }}
                    className="text-[#8A817C] hover:text-white"
                  >
                    Hủy cắt
                  </button>
                </div>

                {/* Interactive Crop Preview Box */}
                <div className="relative rounded-xl overflow-hidden bg-black/80 max-h-[300px] flex items-center justify-center border border-[#4D4845]/60">
                  <img src={rawUploadedSrc} alt="Crop preview" className="w-full h-auto object-contain" />
                  
                  {/* Highlight Crop Box */}
                  <div 
                    className="absolute left-0 right-0 border-y-2 border-[#F5ECDC] bg-[#F5ECDC]/15 pointer-events-none shadow-[0_0_15px_rgba(245,236,220,0.4)]"
                    style={{
                      top: `${cropTopPercent}%`,
                      height: `${cropHeightPercent}%`
                    }}
                  >
                    <span className="absolute top-1 left-2 text-[10px] font-bold bg-black/80 text-[#F5ECDC] px-2 py-0.5 rounded">
                      Đoạn được chọn
                    </span>
                  </div>
                </div>

                {/* Sliders for Top & Height */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-xs text-[#D7C9B2]">
                    <span>Vị trí đoạn (Lên / Xuống):</span>
                    <input 
                      type="range" 
                      min={0} 
                      max={100 - cropHeightPercent} 
                      value={cropTopPercent}
                      onChange={(e) => setCropTopPercent(Number(e.target.value))}
                      className="w-48 accent-[#F5ECDC] cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#D7C9B2]">
                    <span>Độ dài đoạn (Ngắn / Dài):</span>
                    <input 
                      type="range" 
                      min={15} 
                      max={85} 
                      value={cropHeightPercent}
                      onChange={(e) => setCropHeightPercent(Number(e.target.value))}
                      className="w-48 accent-[#F5ECDC] cursor-pointer"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleApplyStaticCrop}
                  className="w-full bg-[#F5ECDC] hover:bg-white font-bold text-xs py-2.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                  style={{ color: '#1F1D20' }}
                >
                  <Check size={15} />
                  <span>Xác nhận cắt đoạn này</span>
                </button>
              </div>
            ) : isCompressingImage ? (
              <div className="flex items-center justify-center py-10 gap-2 text-xs font-bold text-[#D7C9B2]">
                <Loader2 size={18} className="animate-spin text-[#F5ECDC]" />
                <span>Đang xử lý ảnh...</span>
              </div>
            ) : imageSrc ? (
              /* CROPPED SNIPPET RESULT DISPLAY */
              <div className="space-y-3">
                <div className={`relative w-full rounded-xl overflow-hidden bg-black/70 border border-[#4D4845]/60 flex items-center justify-center p-2 transition-all ${
                  isImageExpanded ? 'max-h-[75vh]' : 'max-h-[46vh] min-h-[140px]'
                }`}>
                  <img 
                    src={imageSrc} 
                    alt="Book page snippet" 
                    className={`w-full object-contain rounded-lg ${isImageExpanded ? 'max-h-[75vh]' : 'max-h-[44vh]'}`} 
                  />
                  
                  {/* Delete Snippet Button */}
                  <button 
                    onClick={() => {
                      setImageSrc(null);
                      setRawUploadedSrc(null);
                    }}
                    className="absolute top-3 right-3 p-2 bg-red-500/80 hover:bg-red-600 text-white rounded-full backdrop-blur-sm transition-colors shadow-lg cursor-pointer flex items-center gap-1 px-3 text-xs font-bold"
                    title="Xóa ảnh"
                  >
                    <Trash2 size={13} />
                    <span>Xóa ảnh</span>
                  </button>
                </div>
              </div>
            ) : (
              /* PICKER BUTTONS: LIVE CAMERA WITH FRAME OR UPLOAD */
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleStartLiveCamera}
                  className="flex flex-col items-center justify-center py-6 border border-dashed border-[#F5ECDC]/40 rounded-xl cursor-pointer hover:bg-[#3A373A] transition-all bg-[#1F1D20] group"
                >
                  <Camera size={26} className="text-[#F5ECDC] mb-1.5 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-[#F5ECDC]">Mở Camera canh khung</span>
                  <span className="text-[10px] text-[#8A817C] mt-0.5">Chụp đúng đoạn sách</span>
                </button>

                <label className="flex flex-col items-center justify-center py-6 border border-dashed border-[#4D4845] rounded-xl cursor-pointer hover:bg-[#3A373A] transition-all bg-[#1F1D20] group">
                  <Upload size={26} className="text-[#D7C9B2] mb-1.5 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-[#D7C9B2]">Tải ảnh từ máy</span>
                  <span className="text-[10px] text-[#8A817C] mt-0.5">Có công cụ cắt đoạn</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
              </div>
            )}

            {cameraError && (
              <p className="mt-2 text-xs text-red-400 bg-red-950/40 p-2 rounded-lg text-center">
                {cameraError}
              </p>
            )}
          </div>

          {/* Section 2: Quote Text Cards */}
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
                      placeholder="63"
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
            onClick={() => {
              handleStopLiveCamera();
              onClose();
            }}
            className="flex-1 bg-[#2A272A] hover:bg-[#3A373A] text-[#F5ECDC] border border-[#4D4845] py-3 rounded-xl font-bold text-sm transition-colors cursor-pointer"
          >
            Hủy
          </button>
          
          <button
            onClick={handleSaveAll}
            disabled={isSaving || isCompressingImage || isCameraActive}
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
