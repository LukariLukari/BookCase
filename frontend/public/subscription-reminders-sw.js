self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch { /* Show a useful default. */ }
  event.waitUntil(self.registration.showNotification(
    typeof payload.title === 'string' ? payload.title : 'Billy · Nhắc hủy gói', {
      body: typeof payload.body === 'string' ? payload.body : 'Mở Lịch gia hạn để kiểm tra gói cần xử lý.',
      tag: typeof payload.tag === 'string' ? payload.tag : 'billy-subscriptions',
      icon: '/icons/billy-192.png', badge: '/icons/billy-192.png',
    },
  ));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const target = new URL('/business/subscriptions', self.location.origin).href;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => client.url === target);
    if (existing) return existing.focus();
    return self.clients.openWindow(target);
  })());
});
