'use client';

import { useState } from 'react';
import { getCoverUrl } from '@/utils/image';

interface BookCoverImageProps {
  coverUrl?: string | null;
  title: string;
  author?: string | null;
  className?: string;
  aspectRatio?: string;
}

export default function BookCoverImage({
  coverUrl,
  title,
  author,
  className = "w-full h-full object-cover",
  aspectRatio = "aspect-[2/3]"
}: BookCoverImageProps) {
  const [imageError, setImageError] = useState(false);
  const src = getCoverUrl(coverUrl);

  const getGradient = (str: string) => {
    const gradients = [
      'from-amber-800 via-stone-800 to-amber-950',
      'from-slate-800 via-zinc-900 to-black',
      'from-indigo-900 via-slate-900 to-blue-950',
      'from-emerald-800 via-teal-900 to-slate-950',
      'from-rose-900 via-stone-900 to-neutral-950',
      'from-orange-800 via-amber-900 to-stone-950',
      'from-cyan-900 via-slate-900 to-stone-950',
    ];
    let hash = 0;
    for (let i = 0; i < (str || '').length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % gradients.length;
    return gradients[index];
  };

  if (!src || imageError) {
    const bgGradient = getGradient(title || "Book");
    return (
      <div className={`w-full h-full ${aspectRatio} bg-gradient-to-br ${bgGradient} p-4 flex flex-col justify-between relative overflow-hidden select-none border border-white/10 shadow-md rounded-2xl`}>
        {/* Book spine line overlay */}
        <div className="absolute top-0 bottom-0 left-2.5 w-[3px] bg-white/20 blur-[0.5px]" />
        <div className="absolute top-0 bottom-0 left-3.5 w-[1px] bg-black/40" />
        
        {/* Subtle background glow */}
        <div className="absolute -right-8 -bottom-8 w-28 h-28 bg-white/5 rounded-full blur-2xl pointer-events-none" />

        <div className="pl-3 pr-1 pt-2 z-10">
          <span className="text-[10px] font-black tracking-widest text-amber-300/90 block mb-1 uppercase">BookCase</span>
          <h4 className="font-extrabold text-white text-xs sm:text-sm md:text-base leading-snug line-clamp-4 drop-shadow-sm">{title}</h4>
        </div>

        <div className="pl-3 pr-1 pb-1 z-10 mt-auto pt-2 border-t border-white/15">
          <p className="text-[11px] font-bold text-gray-300/90 truncate">{author || "Tác giả chưa rõ"}</p>
        </div>
      </div>
    );
  }

  return (
    <img 
      src={src} 
      alt={title} 
      className={className} 
      onError={() => setImageError(true)} 
    />
  );
}
