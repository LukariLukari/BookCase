const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;

export const getCoverUrl = (url: string | undefined | null) => {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  return `${baseUrl}${url}`;
};
