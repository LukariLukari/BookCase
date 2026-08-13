'use client';

import { useState } from 'react';
import { getCoverUrl } from '@/utils/image';

interface BookCoverImageProps {
  coverUrl?: string | null;
  bookId?: string | null;
  title: string;
  author?: string | null;
  className?: string;
  aspectRatio?: string;
}

export default function BookCoverImage({
  coverUrl,
  bookId,
  title,
  author,
  className = "w-full h-full object-cover",
  aspectRatio = "aspect-[2/3]"
}: BookCoverImageProps) {
  const [imageError, setImageError] = useState(false);
  const [triedFallback, setTriedFallback] = useState(false);
  
  let src = getCoverUrl(coverUrl);
  if (imageError && !triedFallback && bookId) {
    src = getCoverUrl(`/api/books/cover/${bookId}`);
  }

  const handleImageError = () => {
    if (!triedFallback && bookId && coverUrl !== `/api/books/cover/${bookId}`) {
      setTriedFallback(true);
    } else {
      setImageError(true);
    }
  };

  const getGradient = (str: string) => {
    const gradients = [
      'from-amber-100 via-orange-100 to-amber-200 text-amber-950',
      'from-sky-100 via-indigo-100 to-blue-200 text-slate-900',
      'from-emerald-100 via-teal-100 to-cyan-200 text-emerald-950',
      'from-rose-100 via-pink-100 to-red-200 text-rose-950',
      'from-purple-100 via-fuchsia-100 to-pink-200 text-purple-950',
      'from-lime-100 via-emerald-100 to-teal-200 text-lime-950',
      'from-indigo-100 via-violet-100 to-purple-200 text-indigo-950',
    ];
    let hash = 0;
    for (let i = 0; i < (str || '').length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % gradients.length;
    return gradients[index];
  };

  if (!src || (imageError && (triedFallback || !bookId))) {
    const bgGradient = getGradient(title || "Book");
    return (
      <div className={`w-full h-full ${aspectRatio} bg-gradient-to-br ${bgGradient} p-4 flex flex-col justify-between relative overflow-hidden select-none border border-black/10 shadow-md rounded-2xl`}>
        {/* Book spine line overlay */}
        <div className="absolute top-0 bottom-0 left-2.5 w-[3px] bg-black/10 blur-[0.5px]" />
        <div className="absolute top-0 bottom-0 left-3.5 w-[1px] bg-black/20" />
        
        {/* Subtle background glow */}
        <div className="absolute -right-8 -bottom-8 w-28 h-28 bg-white/40 rounded-full blur-2xl pointer-events-none" />

        <div className="pl-3 pr-1 pt-2 z-10">
          <span className="text-[10px] font-black tracking-widest text-orange-600 block mb-1 uppercase">BookCase</span>
          <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm md:text-base leading-snug line-clamp-4 drop-shadow-none">{title}</h4>
        </div>

        <div className="pl-3 pr-1 pb-1 z-10 mt-auto pt-2 border-t border-black/10">
          <p className="text-[11px] font-bold text-slate-700 truncate">{author || "Tác giả chưa rõ"}</p>
        </div>
      </div>
    );
  }

  return (
    <img 
      src={src} 
      alt={title} 
      className={className} 
      onError={handleImageError} 
    />
  );
}
