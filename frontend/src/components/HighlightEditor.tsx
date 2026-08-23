'use client';
import { useState, useRef, useEffect } from 'react';
import { X, Undo, Download, Trash2, Camera, Upload, CheckCircle2 } from 'lucide-react';
import axios from 'axios';

interface Point { x: number; y: number }
interface Path { points: Point[]; size: number }

export default function HighlightEditor({ 
  bookId, 
  onClose,
  onSaveSuccess
}: { 
  bookId: string;
  onClose: () => void;
  onSaveSuccess?: () => void;
}) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [paths, setPaths] = useState<Path[]>([]);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const [brushSize, setBrushSize] = useState(30);
  const [isSaving, setIsSaving] = useState(false);
  
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImageSrc(event.target?.result as string);
        setPaths([]); // reset drawing
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (imageSrc) {
      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
        redraw();
      };
      img.src = imageSrc;
    }
  }, [imageSrc, paths, currentPath]);

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err) {
      console.error("Camera access error:", err);
      alert("Không thể truy cập Camera. Hãy đảm bảo bạn đã cấp quyền hoặc đang dùng HTTPS.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        setImageSrc(canvas.toDataURL('image/jpeg', 0.9));
        setPaths([]);
        stopCamera();
      }
    }
  };

  const redraw = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const img = imageRef.current;
    if (!canvas || !ctx || !img || !containerRef.current) return;

    // Set canvas dimensions to match container width while maintaining aspect ratio
    const containerWidth = containerRef.current.clientWidth;
    const scale = containerWidth / img.width;
    canvas.width = containerWidth;
    canvas.height = img.height * scale;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Layer 1: Blurred Background
    ctx.save();
    ctx.filter = 'blur(6px) brightness(0.85)';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Layer 2: Draw the sharp cutout
    // We create an offscreen canvas to create the mask
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = canvas.width;
    maskCanvas.height = canvas.height;
    const maskCtx = maskCanvas.getContext('2d');
    
    if (maskCtx) {
      // Draw paths on mask canvas
      maskCtx.lineCap = 'round';
      maskCtx.lineJoin = 'round';
      
      const allPaths = [...paths];
      if (currentPath.length > 0) {
        allPaths.push({ points: currentPath, size: brushSize });
      }

      allPaths.forEach(path => {
        if (path.points.length === 0) return;
        maskCtx.beginPath();
        maskCtx.lineWidth = path.size;
        maskCtx.strokeStyle = 'white'; // Color doesn't matter for masking
        maskCtx.moveTo(path.points[0].x, path.points[0].y);
        for (let i = 1; i < path.points.length; i++) {
          maskCtx.lineTo(path.points[i].x, path.points[i].y);
        }
        maskCtx.stroke();
      });

      // Now use destination-in to cut out the sharp image
      maskCtx.globalCompositeOperation = 'source-in';
      maskCtx.drawImage(img, 0, 0, maskCanvas.width, maskCanvas.height);

      // Finally draw the mask on top of our blurred canvas
      ctx.drawImage(maskCanvas, 0, 0);
    }
  };

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    return {
      x: (e as React.MouseEvent).clientX - rect.left,
      y: (e as React.MouseEvent).clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const coords = getCoordinates(e);
    setCurrentPath([coords]);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault(); // prevent scrolling while drawing on touch
    const coords = getCoordinates(e);
    setCurrentPath(prev => [...prev, coords]);
  };

  const stopDrawing = () => {
    if (isDrawing && currentPath.length > 0) {
      setPaths(prev => [...prev, { points: currentPath, size: brushSize }]);
    }
    setIsDrawing(false);
    setCurrentPath([]);
  };

  const undo = () => {
    setPaths(prev => prev.slice(0, -1));
  };

  const clear = () => {
    setPaths([]);
  };

  const saveQuote = async () => {
    if (!canvasRef.current) return;
    setIsSaving(true);
    try {
      const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.85);
      
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const token = localStorage.getItem('token');
      
      await axios.post(`${API_URL}/api/users/me/books/${bookId}/quotes`, {
        image_url: dataUrl,
        text_content: "Highlight from image"
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (onSaveSuccess) onSaveSuccess();
      onClose();
    } catch (err) {
      console.error("Failed to save quote:", err);
      alert("Lỗi khi lưu trích dẫn. Vui lòng thử lại.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col">
      <div className="flex items-center justify-between p-4 bg-[#1F1D20] border-b border-[#4D4845]/50">
        <h2 className="text-[#F5ECDC] font-bold">Tạo Trích Dẫn (Highlight)</h2>
        <button onClick={() => { stopCamera(); onClose(); }} className="p-2 text-[#D7C9B2] hover:text-white bg-[#2A272A] rounded-full">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-4 relative w-full h-full">
        {isCameraActive ? (
          <div className="flex flex-col items-center justify-center w-full h-full gap-4">
            <div className="relative w-full max-w-2xl bg-black rounded-xl overflow-hidden border border-[#4D4845]">
              <video 
                ref={videoRef} 
                className="w-full h-auto object-contain max-h-[70vh]" 
                playsInline 
                autoPlay 
                muted 
              />
            </div>
            <div className="flex gap-4">
              <button 
                onClick={stopCamera} 
                className="px-6 py-3 bg-[#2A272A] text-[#F5ECDC] rounded-full font-bold border border-[#4D4845]"
              >
                Hủy
              </button>
              <button 
                onClick={capturePhoto} 
                className="px-8 py-3 bg-white text-black rounded-full font-bold shadow-lg"
              >
                Chụp Ảnh
              </button>
            </div>
          </div>
        ) : !imageSrc ? (
          <div className="flex flex-col gap-6 items-center w-full max-w-sm">
            <div className="flex gap-3 w-full">
              <button 
                onClick={startCamera}
                className="flex-1 flex flex-col items-center justify-center h-48 border-2 border-[#F5ECDC]/30 rounded-2xl cursor-pointer hover:bg-[#2A272A] transition-colors bg-[#2A272A]"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-[#F5ECDC]">
                  <Camera size={40} className="mb-3 text-[#F5ECDC]" />
                  <p className="mb-2 text-sm font-bold text-center">Camera Trực Tiếp</p>
                </div>
              </button>
              
              <label className="flex-1 flex flex-col items-center justify-center h-48 border-2 border-dashed border-[#F5ECDC]/30 rounded-2xl cursor-pointer hover:bg-[#2A272A] transition-colors bg-[#1F1D20]">
                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-[#F5ECDC]">
                  <Camera size={40} className="mb-3 text-[#D7C9B2]" />
                  <p className="mb-2 text-sm font-bold text-center">App Camera</p>
                </div>
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageUpload} />
              </label>
            </div>

            <div className="w-full text-center text-[#D7C9B2] text-sm font-bold">HOẶC</div>

            <label className="flex flex-col items-center justify-center w-full h-24 border border-[#4D4845] rounded-xl cursor-pointer hover:bg-[#3A373A] transition-colors bg-[#2A272A]">
              <div className="flex items-center justify-center gap-3 text-[#F5ECDC]">
                <Upload size={24} />
                <span className="font-bold">Tải ảnh từ thư viện</span>
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
          </div>
        ) : (
          <div className="w-full max-w-2xl flex flex-col items-center gap-4 h-full">
            
            {/* Toolbar */}
            <div className="w-full flex items-center justify-between bg-[#2A272A] p-3 rounded-xl border border-[#4D4845]">
              <div className="flex items-center gap-4">
                <button onClick={undo} disabled={paths.length === 0} className="p-2 text-[#D7C9B2] hover:text-white disabled:opacity-50">
                  <Undo size={20} />
                </button>
                <button onClick={clear} disabled={paths.length === 0} className="p-2 text-red-400 hover:text-red-300 disabled:opacity-50">
                  <Trash2 size={20} />
                </button>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-[#D7C9B2] text-xs font-bold">Cọ vẽ:</span>
                <input 
                  type="range" 
                  min="10" max="60" 
                  value={brushSize} 
                  onChange={e => setBrushSize(parseInt(e.target.value))}
                  className="w-24 accent-[#F5ECDC]"
                />
              </div>

              <button 
                onClick={saveQuote} 
                disabled={isSaving || paths.length === 0}
                className="bg-[#F5ECDC] text-black font-bold py-1.5 px-4 rounded-lg flex items-center gap-2 disabled:opacity-50"
              >
                {isSaving ? <span className="animate-spin text-xl">⏳</span> : <CheckCircle2 size={18} />}
                {isSaving ? 'Đang lưu...' : 'Lưu Quote'}
              </button>
            </div>

            {/* Canvas Area */}
            <div 
              className="w-full relative flex-1 bg-[#1F1D20] rounded-xl overflow-hidden border border-[#4D4845] shadow-2xl flex items-center justify-center"
              ref={containerRef}
            >
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                onTouchCancel={stopDrawing}
                className="touch-none w-full object-contain cursor-crosshair max-h-full"
                style={{ touchAction: 'none' }} // crucial for mobile drawing
              />
              {paths.length === 0 && !isDrawing && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-black/40 text-center p-8">
                  <p className="text-white text-lg font-bold bg-black/60 px-4 py-2 rounded-xl backdrop-blur-sm">
                    Dùng ngón tay bôi vùng chữ bạn muốn trích dẫn
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
