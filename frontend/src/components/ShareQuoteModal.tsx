'use client';
import { useState, useRef } from 'react';
import { X, Download, Copy, Check, Sparkles, Smartphone, Square as SquareIcon, Palette } from 'lucide-react';
import confetti from 'canvas-confetti';

interface ShareQuoteModalProps {
  quoteText: string;
  bookTitle?: string;
  bookAuthor?: string;
  pageNumber?: number | null;
  coverUrl?: string | null;
  onClose: () => void;
}

type AspectRatio = 'story' | 'square';
type ThemeId = 'obsidian' | 'parchment' | 'midnight' | 'emerald';

interface ThemeConfig {
  id: ThemeId;
  name: string;
  bgGradient: string;
  cardBg: string;
  textColor: string;
  accentColor: string;
  subtextColor: string;
  canvasBg: string[];
  canvasText: string;
  canvasAccent: string;
  canvasSubtext: string;
  canvasCardBg: string;
}

const THEMES: Record<ThemeId, ThemeConfig> = {
  obsidian: {
    id: 'obsidian',
    name: 'Obsidian Gold',
    bgGradient: 'from-[#3C3E4A] via-[#3C3E4A] to-[#3C3E4A]',
    cardBg: 'bg-[#3C3E4A]/80 border-[#F3F1EC]/20',
    textColor: 'text-[#F3F1EC]',
    accentColor: '#F3F1EC',
    subtextColor: 'text-[#B6B8AB]',
    canvasBg: ['#3C3E4A', '#3C3E4A', '#3C3E4A'],
    canvasText: '#F3F1EC',
    canvasAccent: '#F3F1EC',
    canvasSubtext: '#9FA3AD',
    canvasCardBg: 'rgba(60, 62, 74, 0.9)'
  },
  parchment: {
    id: 'parchment',
    name: 'Parchment Warm',
    bgGradient: 'from-[#E0DFD2] via-[#E0DFD2] to-[#E0DFD2]',
    cardBg: 'bg-[#F3F1EC]/90 border-[#9FA3AD]/20 shadow-xl',
    textColor: 'text-[#3C3E4A]',
    accentColor: '#9FA3AD',
    subtextColor: 'text-[#9FA3AD]',
    canvasBg: ['#E0DFD2', '#E0DFD2', '#E0DFD2'],
    canvasText: '#3C3E4A',
    canvasAccent: '#9FA3AD',
    canvasSubtext: '#9FA3AD',
    canvasCardBg: 'rgba(243, 241, 236, 0.95)'
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight Velvet',
    bgGradient: 'from-[#3C3E4A] via-[#3C3E4A] to-[#3C3E4A]',
    cardBg: 'bg-[#3C3E4A]/80 border-[#B6B8AB]/20',
    textColor: 'text-[#F3F1EC]',
    accentColor: '#B6B8AB',
    subtextColor: 'text-[#9FA3AD]',
    canvasBg: ['#3C3E4A', '#3C3E4A', '#3C3E4A'],
    canvasText: '#F3F1EC',
    canvasAccent: '#B6B8AB',
    canvasSubtext: '#9FA3AD',
    canvasCardBg: 'rgba(60, 62, 74, 0.9)'
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald Ink',
    bgGradient: 'from-[#3C3E4A] via-[#3C3E4A] to-[#3C3E4A]',
    cardBg: 'bg-[#3C3E4A]/80 border-[#B6B8AB]/30',
    textColor: 'text-[#F3F1EC]',
    accentColor: '#B6B8AB',
    subtextColor: 'text-[#B6B8AB]',
    canvasBg: ['#3C3E4A', '#3C3E4A', '#3C3E4A'],
    canvasText: '#F3F1EC',
    canvasAccent: '#B6B8AB',
    canvasSubtext: '#B6B8AB',
    canvasCardBg: 'rgba(60, 62, 74, 0.9)'
  }
};

export default function ShareQuoteModal({
  quoteText: rawQuoteText,
  bookTitle: rawBookTitle = "Sách chưa đặt tên",
  bookAuthor: rawBookAuthor = "Tác giả ẩn danh",
  pageNumber,
  coverUrl,
  onClose
}: ShareQuoteModalProps) {
  const quoteText = (rawQuoteText || "").normalize('NFC');
  const bookTitle = (rawBookTitle || "").normalize('NFC');
  const bookAuthor = (rawBookAuthor || "").normalize('NFC');
  const [ratio, setRatio] = useState<AspectRatio>('story');
  const [currentTheme, setCurrentTheme] = useState<ThemeId>('obsidian');
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);

  const previewCardRef = useRef<HTMLDivElement>(null);

  const activeTheme = THEMES[currentTheme];

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#F3F1EC', '#F3F1EC', '#B6B8AB', '#F3F1EC']
      });
    } catch {
      // fallback
    }
  };

  // High-Resolution Canvas Renderer for Crisp PNG Download
  const generateCanvasImage = async (): Promise<string | null> => {
    const isStory = ratio === 'story';
    const width = isStory ? 1080 : 1080;
    const height = isStory ? 1920 : 1080;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // 1. Draw Background Gradient
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, activeTheme.canvasBg[0]);
    gradient.addColorStop(0.5, activeTheme.canvasBg[1]);
    gradient.addColorStop(1, activeTheme.canvasBg[2]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Subtle Noise / Mesh Accent Pattern
    ctx.save();
    ctx.strokeStyle = activeTheme.canvasAccent;
    ctx.globalAlpha = 0.08;
    ctx.lineWidth = 1.5;
    const margin = isStory ? 70 : 60;
    ctx.strokeRect(margin, margin, width - margin * 2, height - margin * 2);
    ctx.restore();

    // 2. Draw Main Central Card (Rounded Container)
    const cardX = isStory ? 90 : 80;
    const cardY = isStory ? 240 : 100;
    const cardW = width - cardX * 2;
    const cardH = height - cardY * 2;
    const radius = 40;

    ctx.save();
    ctx.fillStyle = activeTheme.canvasCardBg;
    ctx.shadowColor = 'rgba(60, 62, 74, 0.4)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 20;

    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, radius);
    ctx.fill();
    ctx.restore();

    // Card border
    ctx.save();
    ctx.strokeStyle = activeTheme.canvasAccent;
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, radius);
    ctx.stroke();
    ctx.restore();

    // 3. Draw Watermark / Brand Header Top
    ctx.save();
    ctx.font = 'bold 26px "Playfair Display", Georgia, serif';
    ctx.fillStyle = activeTheme.canvasAccent;
    ctx.textAlign = 'center';
    ctx.fillText('B O O K C A S E', width / 2, isStory ? 170 : 65);
    ctx.restore();

    // 4. Draw Quotation Mark Icon
    ctx.save();
    ctx.font = 'italic 120px Georgia, serif';
    ctx.fillStyle = activeTheme.canvasAccent;
    ctx.globalAlpha = 0.35;
    ctx.fillText('“', cardX + 60, cardY + 120);
    ctx.restore();

    // 5. Draw Quote Text (Wrapped with Dynamic Font Scaling)
    ctx.save();
    ctx.fillStyle = activeTheme.canvasText;
    ctx.textAlign = 'left';

    // Compute optimal font size based on text length
    let fontSize = isStory ? 46 : 40;
    if (quoteText.length > 250) fontSize = isStory ? 36 : 30;
    if (quoteText.length > 450) fontSize = isStory ? 30 : 24;

    ctx.font = `italic 500 ${fontSize}px "Lora", Georgia, serif`;
    const lineHeight = fontSize * 1.6;
    const textMaxWidth = cardW - 140;
    const textStartX = cardX + 70;
    const textStartY = cardY + 180;

    // Word Wrap Function
    const words = quoteText.split(' ');
    let line = '';
    const lines: string[] = [];

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > textMaxWidth && n > 0) {
        lines.push(line);
        line = words[n] + ' ';
      } else {
        line = testLine;
      }
    }
    lines.push(line);

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i].trim(), textStartX, textStartY + (i * lineHeight));
    }
    ctx.restore();

    // 6. Draw Footer Info (Book Title, Author, Page Number, Small Cover)
    const footerY = cardY + cardH - 120;

    // Divider Line inside Card
    ctx.save();
    ctx.strokeStyle = activeTheme.canvasAccent;
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cardX + 60, footerY - 40);
    ctx.lineTo(cardX + cardW - 60, footerY - 40);
    ctx.stroke();
    ctx.restore();

    // Book Title & Author
    ctx.save();
    ctx.fillStyle = activeTheme.canvasText;
    ctx.font = 'bold 32px "Lora", Georgia, serif';
    ctx.textAlign = 'left';
    
    // Truncate title if too long
    let displayTitle = bookTitle;
    if (ctx.measureText(displayTitle).width > textMaxWidth - 180) {
      displayTitle = displayTitle.substring(0, 30) + '...';
    }
    ctx.fillText(displayTitle, cardX + 70, footerY);

    ctx.font = '500 24px sans-serif';
    ctx.fillStyle = activeTheme.canvasSubtext;
    ctx.fillText(bookAuthor, cardX + 70, footerY + 36);

    // Page Number Tag
    if (pageNumber) {
      const pageText = `Trang ${pageNumber}`;
      ctx.font = 'bold 22px sans-serif';
      const pageTextW = ctx.measureText(pageText).width;
      const badgeX = cardX + cardW - pageTextW - 90;
      const badgeY = footerY - 10;

      // Badge Background
      ctx.fillStyle = activeTheme.canvasAccent;
      ctx.globalAlpha = 0.15;
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY - 22, pageTextW + 30, 42, 12);
      ctx.fill();

      // Badge Text
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = activeTheme.canvasAccent;
      ctx.fillText(pageText, badgeX + 15, badgeY + 6);
    }
    ctx.restore();

    return canvas.toDataURL('image/png', 1.0);
  };

  const handleDownload = async () => {
    setIsExporting(true);
    try {
      const dataUrl = await generateCanvasImage();
      if (!dataUrl) return;

      const link = document.createElement('a');
      link.download = `Billy_Quote_${Date.now()}.png`;
      link.href = dataUrl;
      link.click();

      triggerConfetti();
    } catch (err) {
      console.error("Download quote card failed:", err);
      alert("Lỗi khi tải ảnh. Vui lòng thử lại.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyImage = async () => {
    setIsExporting(true);
    try {
      const dataUrl = await generateCanvasImage();
      if (!dataUrl) return;

      // Convert dataUrl to Blob
      const res = await fetch(dataUrl);
      const blob = await res.blob();

      if (navigator.clipboard && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        setCopied(true);
        triggerConfetti();
        setTimeout(() => setCopied(false), 2500);
      } else {
        // Fallback to text copy
        await navigator.clipboard.writeText(`"${quoteText}"\n— ${bookTitle} (${bookAuthor})`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch (err) {
      console.warn("Clipboard image write not supported, falling back to text copy:", err);
      try {
        await navigator.clipboard.writeText(`"${quoteText}"\n— ${bookTitle} (${bookAuthor})`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch (e) {
        alert("Trình duyệt không hỗ trợ sao chép trực tiếp. Hãy chọn 'Tải ảnh' nhé!");
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-md flex items-center justify-center p-3 md:p-6 overflow-y-auto">
      <div className="relative bg-[#3C3E4A] border border-[#3C3E4A]/30/60 rounded-3xl p-5 md:p-8 max-w-4xl w-full shadow-2xl flex flex-col my-auto max-h-[96vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#3C3E4A]/30/40 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#3C3E4A] rounded-xl text-[#F3F1EC] border border-[#3C3E4A]/30/50">
              <Sparkles size={22} className="text-[#3C3E4A]/60" />
            </div>
            <div>
              <h2 className="text-xl font-black text-[#F3F1EC]">Xuất Ảnh Trích Dẫn Nghệ Thuật</h2>
              <p className="text-xs text-[#3C3E4A]/60">Tạo Quote Card sang trọng để chia sẻ Story hoặc Feed</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-[#3C3E4A]/60 hover:text-[#F3F1EC] bg-[#3C3E4A] hover:bg-[#3C3E4A] rounded-full transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto pr-1">
          
          {/* Left: Interactive Preview */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center bg-[#3C3E4A] border border-[#3C3E4A]/30/40 rounded-2xl p-4 md:p-6 relative overflow-hidden min-h-[380px]">
            
            <div 
              ref={previewCardRef}
              className={`w-full max-w-[340px] bg-gradient-to-b ${activeTheme.bgGradient} rounded-3xl p-5 shadow-2xl flex flex-col justify-between border border-white/10 transition-all duration-300 relative ${
                ratio === 'story' ? 'aspect-[9/16]' : 'aspect-square'
              }`}
            >
              {/* Header Branding */}
              <div className="text-center pt-2">
                <span className="text-[10px] tracking-[3px] font-serif uppercase font-bold opacity-75" style={{ color: activeTheme.accentColor }}>
                  B O O K C A S E
                </span>
              </div>

              {/* Central Quote Container */}
              <div className={`my-auto ${activeTheme.cardBg} backdrop-blur-sm rounded-2xl p-4 md:p-5 border flex flex-col justify-center`}>
                <span className="text-4xl font-serif leading-none block -mb-2 select-none" style={{ color: activeTheme.accentColor }}>
                  “
                </span>
                <p className={`font-serif italic font-medium leading-relaxed ${activeTheme.textColor} text-sm md:text-base line-clamp-6`}>
                  {quoteText}
                </p>
                <span className="text-4xl font-serif leading-none text-right block -mt-2 select-none" style={{ color: activeTheme.accentColor }}>
                  ”
                </span>
              </div>

              {/* Footer Metadata */}
              <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                <div className="min-w-0 flex-1 pr-2">
                  <p className={`text-xs font-bold font-serif truncate ${activeTheme.textColor}`}>{bookTitle}</p>
                  <p className={`text-[11px] truncate ${activeTheme.subtextColor}`}>{bookAuthor}</p>
                </div>
                {pageNumber && (
                  <span 
                    className="text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0"
                    style={{ backgroundColor: `${activeTheme.accentColor}25`, color: activeTheme.accentColor }}
                  >
                    Trang {pageNumber}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 text-[11px] text-[#3C3E4A]/60">
              <span>Chất lượng xuất: <strong>1080p Ultra HD</strong></span>
            </div>
          </div>

          {/* Right: Controls & Options */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
            
            <div className="space-y-5">
              {/* Ratio Selector */}
              <div>
                <label className="block text-xs font-bold text-[#3C3E4A]/60 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Smartphone size={14} /> 1. Chọn định dạng khung hình
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={() => setRatio('story')}
                    className={`py-3 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                      ratio === 'story'
                        ? 'bg-[#F3F1EC] border-[#F3F1EC] shadow-md'
                        : 'bg-[#3C3E4A] text-[#3C3E4A]/60 border-[#3C3E4A]/30/60 hover:bg-[#3C3E4A]'
                    }`}
                    style={ratio === 'story' ? { color: '#3C3E4A' } : undefined}
                  >
                    <Smartphone size={15} />
                    <span>Story 9:16</span>
                  </button>

                  <button
                    onClick={() => setRatio('square')}
                    className={`py-3 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                      ratio === 'square'
                        ? 'bg-[#F3F1EC] border-[#F3F1EC] shadow-md'
                        : 'bg-[#3C3E4A] text-[#3C3E4A]/60 border-[#3C3E4A]/30/60 hover:bg-[#3C3E4A]'
                    }`}
                    style={ratio === 'square' ? { color: '#3C3E4A' } : undefined}
                  >
                    <SquareIcon size={15} />
                    <span>Square 1:1</span>
                  </button>
                </div>
              </div>

              {/* Theme Palette Selector */}
              <div>
                <label className="block text-xs font-bold text-[#3C3E4A]/60 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Palette size={14} /> 2. Bộ phối màu (Color Theme)
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {(Object.keys(THEMES) as ThemeId[]).map((key) => {
                    const theme = THEMES[key];
                    const isSelected = currentTheme === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setCurrentTheme(key)}
                        className={`p-3 rounded-xl border flex items-center gap-2.5 transition-all text-left cursor-pointer ${
                          isSelected 
                            ? 'border-[#F3F1EC] bg-[#3C3E4A] ring-2 ring-[#F3F1EC]/30' 
                            : 'border-[#3C3E4A]/30/40 bg-[#3C3E4A] hover:bg-[#3C3E4A]'
                        }`}
                      >
                        <div 
                          className="w-4 h-4 rounded-full border border-white/20 flex-shrink-0" 
                          style={{ background: theme.canvasBg[1] }} 
                        />
                        <span className="text-xs font-bold text-[#F3F1EC] truncate">{theme.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Actions: Download & Copy Buttons */}
            <div className="space-y-3 pt-4 border-t border-[#3C3E4A]/30/40">
              <button
                onClick={handleDownload}
                disabled={isExporting}
                className="w-full bg-[#F3F1EC] hover:bg-white py-3.5 px-4 rounded-xl font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                style={{ color: '#3C3E4A' }}
              >
                <Download size={17} />
                <span>{isExporting ? 'Đang xuất ảnh Ultra HD...' : 'Tải Ảnh Xuống (.PNG)'}</span>
              </button>

              <button
                onClick={handleCopyImage}
                disabled={isExporting}
                className="w-full bg-[#3C3E4A] hover:bg-[#3C3E4A] text-[#F3F1EC] border border-[#3C3E4A]/30 py-3 px-4 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check size={16} className="text-emerald-400" />
                    <span className="text-emerald-400 font-bold">Đã sao chép ảnh vào bộ nhớ!</span>
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    <span>Sao chép ảnh vào Clipboard</span>
                  </>
                )}
              </button>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
