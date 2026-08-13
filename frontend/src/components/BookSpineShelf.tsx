'use client';

import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';
import { getCoverUrl } from '@/utils/image';

export interface Book {
  id: string;
  title: string;
  author: string;
  genre: string;
  summary: string;
  cover_url: string;
  created_at?: string;
}

interface BookSpineShelfProps {
  books: Book[];
  onSelectBook: (book: Book) => void;
  title?: string;
}

// Authentic hardcover bookbinding material themes
const PHYSICAL_SPINE_THEMES = [
  { 
    bg: '#4a121a', // Vintage Burgundy Leather
    textColor: '#fceade', 
    foilColor: '#d4af37', // Gold Foil
    authorColor: '#e2c2a4',
    paperEdge: '#f4ebd0',
    type: 'leather' 
  },
  { 
    bg: '#0f1b29', // Royal Navy Linen
    textColor: '#f0f4f8', 
    foilColor: '#e0e0e0', // Silver Foil
    authorColor: '#9bb1c9',
    paperEdge: '#e8e3d5',
    type: 'linen' 
  },
  { 
    bg: '#193324', // Deep Forest Velvet
    textColor: '#e8f5e9', 
    foilColor: '#d4af37', // Gold Foil
    authorColor: '#a3c9a8',
    paperEdge: '#f2ebd9',
    type: 'leather' 
  },
  { 
    bg: '#7c3626', // Terracotta Hardbound
    textColor: '#fff5ee', 
    foilColor: '#e8a87c', // Copper Foil
    authorColor: '#f7d6c6',
    paperEdge: '#f4ece1',
    type: 'linen' 
  },
  { 
    bg: '#2b231d', // Aged Espresso Leather
    textColor: '#f4e8c1', 
    foilColor: '#d4af37', // Gold Foil
    authorColor: '#c4b58a',
    paperEdge: '#ebdcb9',
    type: 'leather' 
  },
  { 
    bg: '#1c1d21', // Onyx Obsidian Cloth
    textColor: '#ffffff', 
    foilColor: '#c0c0c0', // Silver Foil
    authorColor: '#b0b3b8',
    paperEdge: '#dedede',
    type: 'cloth' 
  },
  { 
    bg: '#3b1f50', // Imperial Purple
    textColor: '#f8f0fc', 
    foilColor: '#d4af37', // Gold Foil
    authorColor: '#d8b4e2',
    paperEdge: '#f2e8f7',
    type: 'velvet' 
  },
  { 
    bg: '#8c7853', // Vintage Tan Canvas
    textColor: '#23180c', 
    foilColor: '#4a371c', // Dark Bronze
    authorColor: '#42331e',
    paperEdge: '#f5edd6',
    type: 'cloth' 
  },
  { 
    bg: '#6b1624', // Crimson Bound
    textColor: '#fff0f2', 
    foilColor: '#ffd700', // Bright Gold
    authorColor: '#f3b3bc',
    paperEdge: '#f8eedc',
    type: 'leather' 
  },
  { 
    bg: '#163840', // Deep Teal Hardcover
    textColor: '#e0f7fa', 
    foilColor: '#80deea', // Metallic Cyan
    authorColor: '#80cbc4',
    paperEdge: '#e5f3f0',
    type: 'linen' 
  },
];

function getHash(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export default function BookSpineShelf({ books, onSelectBook, title = "Tủ Sách Gáy Nổi Bật" }: BookSpineShelfProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredBook, setHoveredBook] = useState<Book | null>(null);

  if (!books || books.length === 0) return null;

  const handleScroll = (direction: 'left' | 'right') => {
    if (containerRef.current) {
      const scrollAmount = direction === 'left' ? -340 : 340;
      containerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="w-full mb-12 select-none">
      {/* Header Section */}
      <div className="flex justify-between items-end mb-4 px-1">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl md:text-2xl font-bold text-black tracking-tight">{title}</h2>
            <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2.5 py-0.5 rounded-full border border-orange-200">
              {books.length} cuốn
            </span>
          </div>
          <p className="text-xs md:text-sm text-gray-500 mt-0.5 font-medium">
            Bấm trực tiếp vào gáy sách 3D để xem chi tiết
          </p>
        </div>

        {/* Scroll Buttons - High contrast button style per guidelines */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleScroll('left')}
            className="w-9 h-9 rounded-full bg-black text-white hover:bg-orange-600 transition-colors flex items-center justify-center shadow-md active:scale-95 cursor-pointer"
            title="Cuộn sang trái"
            aria-label="Cuộn sang trái"
          >
            <ChevronLeft size={20} className="text-white" />
          </button>
          <button
            onClick={() => handleScroll('right')}
            className="w-9 h-9 rounded-full bg-black text-white hover:bg-orange-600 transition-colors flex items-center justify-center shadow-md active:scale-95 cursor-pointer"
            title="Cuộn sang phải"
            aria-label="Cuộn sang phải"
          >
            <ChevronRight size={20} className="text-white" />
          </button>
        </div>
      </div>

      {/* Book Spines Container sitting on a 3D Wooden Ledge */}
      <div className="relative pt-2 pb-0">
        
        {/* Hover Info Indicator */}
        <div className="h-9 mb-3 flex items-center px-1">
          <AnimatePresence mode="wait">
            {hoveredBook ? (
              <motion.div
                key={hoveredBook.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-xs font-bold text-black bg-white px-3.5 py-1.5 rounded-xl border border-gray-200 shadow-md"
              >
                <BookOpen size={15} className="text-orange-500 shrink-0" />
                <span className="font-extrabold">{hoveredBook.title}</span>
                <span className="text-gray-400 font-normal border-l border-gray-200 pl-2">
                  {hoveredBook.author || 'Tác giả ẩn danh'}
                </span>
              </motion.div>
            ) : (
              <span className="text-xs text-gray-400 font-medium italic">Rê chuột lên gáy sách 3D để preview, click để mở</span>
            )}
          </AnimatePresence>
        </div>

        {/* Horizontal Scrollable Container for Spines */}
        <div
          ref={containerRef}
          className="flex items-end gap-1.5 md:gap-2.5 overflow-x-auto pb-1 pt-6 px-3 no-scrollbar scroll-smooth relative z-10 min-h-[285px]"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {books.map((book, idx) => {
            const hash = getHash(book.id + book.title);
            const theme = PHYSICAL_SPINE_THEMES[hash % PHYSICAL_SPINE_THEMES.length];
            const height = 230 + (hash % 40); // Height variation (230px to 270px)
            const width = 44 + ((hash * 7) % 12); // Width variation (44px to 56px)
            const isHovered = hoveredBook?.id === book.id;
            const coverSrc = getCoverUrl(book.cover_url);

            return (
              <div
                key={book.id}
                className="flex-shrink-0 flex items-end justify-center cursor-pointer group"
                onMouseEnter={() => setHoveredBook(book)}
                onMouseLeave={() => setHoveredBook(null)}
                onClick={() => onSelectBook(book)}
              >
                <motion.div
                  animate={{
                    y: isHovered ? -20 : 0,
                    scale: isHovered ? 1.05 : 1,
                  }}
                  transition={{ type: "spring", stiffness: 380, damping: 24 }}
                  style={{
                    height: `${height}px`,
                    width: `${width}px`,
                    backgroundColor: theme.bg,
                    boxShadow: isHovered 
                      ? '0 20px 25px -5px rgba(0,0,0,0.5), 0 10px 10px -5px rgba(0,0,0,0.3)' 
                      : '0 4px 10px rgba(0,0,0,0.25), inset -2px 0 4px rgba(0,0,0,0.4), inset 2px 0 4px rgba(255,255,255,0.1)'
                  }}
                  className="rounded-t-[3px] rounded-b-[2px] relative flex flex-col justify-between p-1.5 overflow-hidden select-none border-t border-white/20 transition-shadow duration-300"
                >
                  {/* Top Paper Page Edge (Book Head) */}
                  <div 
                    className="absolute top-0 left-1 right-1 h-[3px] rounded-t-sm opacity-90 shadow-inner"
                    style={{ backgroundColor: theme.paperEdge }}
                  />

                  {/* 3D Cylindrical Spine Shading Overlay (Light highlight center, edge shadows) */}
                  <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-black/40 via-transparent to-black/35" />
                  <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                  {/* Top Spine Stitching & Foil Trim Lines */}
                  <div className="relative z-10 pt-1 flex flex-col items-center gap-1">
                    <div 
                      className="w-full h-[2px] rounded-full opacity-80"
                      style={{ backgroundColor: theme.foilColor }}
                    />
                    <div 
                      className="w-3/4 h-[1px] rounded-full opacity-60"
                      style={{ backgroundColor: theme.foilColor }}
                    />
                  </div>

                  {/* Optional Real Cover Thumbnail Slice on Spine */}
                  {coverSrc && (
                    <div className="relative z-10 my-1 mx-auto w-[85%] aspect-[2/3] max-h-16 rounded overflow-hidden shadow-md border border-white/20 shrink-0">
                      <img 
                        src={coverSrc} 
                        alt={book.title} 
                        className="w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    </div>
                  )}

                  {/* Vertical Title & Author Text */}
                  <div className="relative z-10 flex-1 flex flex-col items-center justify-center py-2 overflow-hidden">
                    <span
                      className="font-extrabold text-xs md:text-[13px] tracking-wide text-center leading-snug drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] truncate max-h-[85%]"
                      style={{
                        writingMode: 'vertical-rl',
                        textOrientation: 'mixed',
                        color: theme.textColor,
                        maxHeight: `${height - (coverSrc ? 110 : 80)}px`
                      }}
                    >
                      {book.title}
                    </span>
                  </div>

                  {/* Bottom Spine Foil Medallion & Ribbed Folds */}
                  <div className="relative z-10 pb-0.5 flex flex-col items-center gap-1">
                    <div 
                      className="w-full h-[1px] rounded-full opacity-60"
                      style={{ backgroundColor: theme.foilColor }}
                    />
                    
                    <div 
                      className="w-5 h-5 rounded-full flex items-center justify-center border text-[9px] font-mono font-bold shadow-inner opacity-90"
                      style={{ 
                        borderColor: theme.foilColor, 
                        color: theme.textColor,
                        backgroundColor: 'rgba(0,0,0,0.2)'
                      }}
                    >
                      {(idx + 1).toString().padStart(2, '0')}
                    </div>

                    <div 
                      className="w-full h-[2px] rounded-full opacity-80"
                      style={{ backgroundColor: theme.foilColor }}
                    />
                  </div>

                </motion.div>
              </div>
            );
          })}
        </div>

        {/* 3D Wooden Bookshelf Base (Kệ Gỗ Sang Trọng 3D) */}
        <div className="w-full relative z-20">
          {/* Top Wooden Surface Shadow */}
          <div className="w-full h-2 bg-gradient-to-b from-black/40 to-transparent" />
          
          {/* Main Wooden Plank */}
          <div className="w-full h-4 bg-gradient-to-b from-[#4a2e18] via-[#3d2411] to-[#2b1809] border-t border-[#6b4527]/60 shadow-lg relative flex items-center justify-between px-4">
             <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:8px_8px] pointer-events-none" />
             <div className="w-full h-[1px] bg-white/10" />
          </div>

          {/* Wooden Bevel Front Ledge */}
          <div className="w-full h-2.5 bg-gradient-to-b from-[#241306] to-[#150a03] border-t border-black/50 shadow-md" />
        </div>
      </div>
    </div>
  );
}
