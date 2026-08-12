'use client';

import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';

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

// Elegant pastel color palettes for book spines
const SPINE_PALETTES = [
  { bg: '#bae6fd', text: '#0369a1', accent: '#0284c7' }, // Pastel Sky Blue
  { bg: '#a7f3d0', text: '#047857', accent: '#059669' }, // Pastel Mint
  { bg: '#fed7aa', text: '#c2410c', accent: '#ea580c' }, // Pastel Peach
  { bg: '#e9d5ff', text: '#7e22ce', accent: '#9333ea' }, // Pastel Lavender
  { bg: '#fbcfe8', text: '#be185d', accent: '#db2777' }, // Pastel Pink
  { bg: '#fef08a', text: '#a16207', accent: '#ca8a04' }, // Pastel Yellow
  { bg: '#99f6e4', text: '#0f766e', accent: '#0d9488' }, // Pastel Teal
  { bg: '#ddd6fe', text: '#6d28d9', accent: '#7c3aed' }, // Pastel Lilac
  { bg: '#fecdd3', text: '#be123c', accent: '#e11d48' }, // Pastel Soft Coral
  { bg: '#d9f99d', text: '#4d7c0f', accent: '#65a30d' }, // Pastel Matcha
  { bg: '#cffafe', text: '#0e7490', accent: '#0891b2' }, // Pastel Ice Blue
  { bg: '#fef3c7', text: '#b45309', accent: '#d97706' }, // Pastel Cream
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
      const scrollAmount = direction === 'left' ? -320 : 320;
      containerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="w-full mb-10 select-none">
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
            Bấm trực tiếp vào gáy sách để mở sách ngay lập tức
          </p>
        </div>

        {/* Scroll Buttons - High contrast button style */}
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

      {/* Book Spines sitting on a thin horizontal line */}
      <div className="relative pt-2 pb-2">
        
        {/* Hover Info Indicator */}
        <div className="h-8 mb-2 flex items-center px-1">
          <AnimatePresence mode="wait">
            {hoveredBook ? (
              <motion.div
                key={hoveredBook.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-xs font-bold text-black bg-white px-3 py-1 rounded-lg border border-gray-200 shadow-sm"
              >
                <BookOpen size={14} className="text-orange-500" />
                <span>{hoveredBook.title}</span>
                <span className="text-gray-400 font-normal">({hoveredBook.author || 'Tác giả ẩn danh'})</span>
              </motion.div>
            ) : (
              <span className="text-xs text-gray-400 font-medium italic">Rê chuột để xem tên sách, bấm để mở ngay</span>
            )}
          </AnimatePresence>
        </div>

        {/* Horizontal Container for Spines */}
        <div
          ref={containerRef}
          className="flex items-end gap-2 md:gap-3 overflow-x-auto pb-0.5 pt-4 px-2 no-scrollbar scroll-smooth relative z-10 min-h-[260px]"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {books.map((book, idx) => {
            const hash = getHash(book.id + book.title);
            const palette = SPINE_PALETTES[hash % SPINE_PALETTES.length];
            const height = 220 + (hash % 45); // slight height variations (220px to 265px)
            const width = 42 + ((hash * 3) % 12); // width (42px to 54px)
            const isHovered = hoveredBook?.id === book.id;

            return (
              <div
                key={book.id}
                className="flex-shrink-0 flex items-end justify-center cursor-pointer"
                onMouseEnter={() => setHoveredBook(book)}
                onMouseLeave={() => setHoveredBook(null)}
                onClick={() => onSelectBook(book)}
              >
                <motion.div
                  animate={{
                    y: isHovered ? -16 : 0,
                    scale: isHovered ? 1.03 : 1,
                  }}
                  transition={{ type: "spring", stiffness: 350, damping: 22 }}
                  style={{
                    height: `${height}px`,
                    width: `${width}px`,
                    backgroundColor: palette.bg,
                    color: palette.text,
                    boxShadow: isHovered ? '0 12px 20px -4px rgba(0,0,0,0.25)' : '0 2px 6px rgba(0,0,0,0.12)'
                  }}
                  className="rounded-t-md rounded-b-sm overflow-hidden flex flex-col justify-between p-2 relative border-t border-black/10 select-none"
                >
                  {/* Top Line Accent */}
                  <div
                    className="w-full h-1 rounded-full opacity-90"
                    style={{ backgroundColor: palette.accent }}
                  />

                  {/* Vertical Title */}
                  <div className="flex-1 flex items-center justify-center py-2 overflow-hidden">
                    <span
                      className="font-bold text-xs md:text-sm tracking-wide text-center leading-tight truncate max-h-[85%]"
                      style={{
                        writingMode: 'vertical-rl',
                        textOrientation: 'mixed',
                        maxHeight: `${height - 60}px`
                      }}
                    >
                      {book.title}
                    </span>
                  </div>

                  {/* Bottom Spine Number */}
                  <div className="text-[10px] font-mono text-center opacity-70 font-bold border-t border-black/10 pt-1">
                    {(idx + 1).toString().padStart(2, '0')}
                  </div>
                </motion.div>
              </div>
            );
          })}
        </div>

        {/* Thin Horizontal Line Base */}
        <div className="w-full h-[2px] bg-stone-300 rounded-full mt-0 relative z-20" />
      </div>
    </div>
  );
}
