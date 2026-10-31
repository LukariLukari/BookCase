import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/', name: 'Billy · Quản lý kinh doanh', short_name: 'Billy',
    description: 'Theo dõi kinh doanh và nhắc hạn hủy gói khách hàng.',
    start_url: '/business/subscriptions', scope: '/', display: 'standalone',
    background_color: '#fef9f4', theme_color: '#df7a08', lang: 'vi',
    icons: [
      { src: '/icons/billy-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/billy-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
