'use client';

export const pushApi = '/api/sales/subscriptions/push';
export const pushScope = '/business/subscriptions';

export async function pushRequest<T>(token: string, method: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(pushApi, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    cache: 'no-store', signal, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.detail || 'Không thể kết nối dịch vụ thông báo.');
  return data as T;
}

export function pushSupported() {
  return window.isSecureContext && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function notificationWorker() {
  const registration = await navigator.serviceWorker.register('/subscription-reminders-sw.js', { scope: pushScope, updateViaCache: 'none' });
  if (!registration.active) {
    await new Promise<void>((resolve, reject) => {
      const worker = registration.installing || registration.waiting;
      if (!worker) { reject(new Error('Chưa khởi tạo được thông báo. Hãy thử lại.')); return; }
      const timer = window.setTimeout(() => { worker.removeEventListener('statechange', check); reject(new Error('Khởi tạo thông báo quá lâu. Hãy thử lại.')); }, 10000);
      function check() {
        if (worker?.state === 'activated' || worker?.state === 'redundant') {
          window.clearTimeout(timer); worker.removeEventListener('statechange', check);
          if (worker.state === 'activated') resolve();
          else reject(new Error('Không thể khởi tạo thông báo.'));
        }
      }
      worker.addEventListener('statechange', check); check();
    });
  }
  return registration;
}

export function applicationServerKey(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64 + '='.repeat((4 - base64.length % 4) % 4)), character => character.charCodeAt(0));
}

export async function stopDevicePush(token: string) {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration(pushScope);
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  try {
    await pushRequest(token, 'DELETE', { endpoint: subscription.endpoint }, AbortSignal.timeout(5000));
  } finally {
    // Also revoke locally, including when logout happens without a connection.
    await subscription.unsubscribe();
  }
}
