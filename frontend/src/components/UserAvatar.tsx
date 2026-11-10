'use client';

import Image from 'next/image';
import { useState } from 'react';

export default function UserAvatar({ name, src, size = 36 }: { name: string; src?: string | null; size?: number }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const initials = name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase() || 'U';
  return <span className="account-avatar" style={{ width: size, height: size, fontSize: Math.max(12, size / 3) }}>
    {src && src !== failedSource ? <Image unoptimized src={src} alt={`Ảnh đại diện của ${name}`} width={size} height={size} onError={() => setFailedSource(src)} /> : <span aria-label={`Ảnh đại diện của ${name}`}>{initials}</span>}
  </span>;
}
