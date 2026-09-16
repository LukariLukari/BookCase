'use client';

import { useState } from 'react';
import { getCoverUrl } from '@/utils/image';
import { BookOpen } from 'lucide-react';

interface BookCoverImageProps {
  coverUrl?: string | null;
  bookId?: string | null;
  title: string;
  author?: string | null;
  className?: string;
  aspectRatio?: string;
  isActive?: boolean;
}

export default function BookCoverImage({
  coverUrl,
  bookId,
  title,
  author,
  className = "w-full h-full object-cover",
  aspectRatio = "aspect-[2/3]",
  isActive = false
}: BookCoverImageProps) {
  const [imgState, setImgState] = useState<'initial' | 'fallback' | 'error'>(
    (coverUrl && coverUrl.trim()) ? 'initial' : 'fallback'
  );

  let src = '';
  if (imgState === 'initial') {
    src = getCoverUrl(coverUrl);
  } else if (imgState === 'fallback' && bookId) {
    src = getCoverUrl(`/api/books/cover/${bookId}`);
  }

  const handleImageError = () => {
    if (imgState === 'initial' && bookId) {
      setImgState('fallback');
    } else {
      setImgState('error');
    }
  };

  const getEditorialPalette = (str: string) => {
    const palettes = [
      { bg: 'bg-[#2A2B2E]', text: 'text-[#F5F2EB]', accent: 'text-[#D9822B]' },
      { bg: 'bg-[#1C2826]', text: 'text-[#F5F2EB]', accent: 'text-[#E0A96D]' },
      { bg: 'bg-[#3D2645]', text: 'text-[#F5F2EB]', accent: 'text-[#DA7B93]' },
      { bg: 'bg-[#2E4057]', text: 'text-[#F5F2EB]', accent: 'text-[#F4D06F]' },
      { bg: 'bg-[#463F3A]', text: 'text-[#F5F2EB]', accent: 'text-[#E0AFA0]' },
      { bg: 'bg-[#191923]', text: 'text-[#F5F2EB]', accent: 'text-[#FB6107]' }
    ];
    let hash = 0;
    for (let i = 0; i < (str || '').length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return palettes[Math.abs(hash) % palettes.length];
  };

  if (imgState === 'error' || (!src && !bookId)) {
    const palette = getEditorialPalette(title);
    return (
      <div 
        className={`w-full h-full ${aspectRatio} ${palette.bg} p-5 flex flex-col justify-between relative overflow-hidden select-none rounded-r-md rounded-l-[2px] ${
          isActive ? 'book-3d-shadow-active' : 'book-3d-shadow'
        } book-spine-shine`}
      >
        {/* Book spine line overlay */}
        <div className="absolute top-0 bottom-0 left-2 w-[2px] bg-white/20" />
        <div className="absolute top-0 bottom-0 left-2.5 w-[1px] bg-black/30" />

        <div className="pl-3 pr-1 pt-2 z-10">
          <span className={`text-[9px] font-black tracking-widest ${palette.accent} uppercase block mb-1.5`}>
            BookCase Classic
          </span>
          <h4 className={`font-extrabold ${palette.text} text-sm md:text-base leading-snug line-clamp-4 tracking-tight`}>
            {title}
          </h4>
        </div>

        <div className="pl-3 pr-1 pb-1 z-10 mt-auto pt-3 border-t border-white/10 flex items-center justify-between">
          <p className="text-[11px] font-medium text-white/70 truncate">{author || "Tác giả chưa rõ"}</p>
          <BookOpen size={14} className="text-white/40 flex-shrink-0" />
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`relative w-full h-full overflow-hidden rounded-r-md rounded-l-[2px] ${
        isActive ? 'book-3d-shadow-active' : 'book-3d-shadow'
      } book-spine-shine`}
    >
      <img 
        src={src} 
        alt={title} 
        className={className} 
        onError={handleImageError} 
      />
    </div>
  );
}

