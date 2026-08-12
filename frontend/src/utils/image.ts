const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;

export const DEFAULT_COVER_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600"><rect width="400" height="600" fill="%23f1f5f9"/><rect x="20" y="20" width="360" height="560" rx="16" fill="%23e2e8f0" stroke="%23cbd5e1" stroke-width="4" stroke-dasharray="8 8"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="system-ui, sans-serif" font-size="22" font-weight="bold" fill="%2364748b">No Cover</text></svg>`;

export const getCoverUrl = (url: string | undefined | null) => {
  if (!url) return '';

  // Transform Google Drive viewer URLs to direct thumbnail image URLs
  if (url.includes('drive.google.com')) {
    const matchD = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (matchD && matchD[1]) {
      return `https://lh3.googleusercontent.com/d/${matchD[1]}`;
    }
    const matchId = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (matchId && matchId[1]) {
      return `https://lh3.googleusercontent.com/d/${matchId[1]}`;
    }
  }

  if (url.startsWith('http') || url.startsWith('data:')) {
    return url;
  }

  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${baseUrl}${cleanPath}`;
};

