import { createECDH, createHash } from 'node:crypto';
import webpush from 'web-push';
import { prisma } from './db';
import { addDays, todayKey } from './subscriptions';
import { reminderLeadDays } from './subscriptionReminders';
import { SubscriptionError } from './subscriptionServer';
import type { SubscriptionPushDevice } from '@prisma/client';

export function pushConfig() {
  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY?.trim();
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY?.trim();
  const subject = process.env.WEB_PUSH_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject) throw new SubscriptionError('Máy chủ chưa cấu hình Web Push. Xem hướng dẫn WEB_PUSH.md.', 503);
  try {
    // Validate the key pair and contact before accepting device registrations.
    webpush.getVapidHeaders('https://fcm.googleapis.com', subject, publicKey, privateKey, 'aes128gcm');
    const key = createECDH('prime256v1');
    key.setPrivateKey(Buffer.from(privateKey, 'base64url'));
    if (key.getPublicKey().toString('base64url') !== publicKey) throw new Error('VAPID pair mismatch');
  } catch { throw new SubscriptionError('Cấu hình Web Push không hợp lệ. Kiểm tra khóa VAPID và địa chỉ liên hệ.', 503); }
  return { publicKey, privateKey, subject };
}

export function endpointHash(endpoint: string) {
  return createHash('sha256').update(endpoint).digest('hex');
}

export function validatePushEndpoint(value: unknown): string {
  if (typeof value !== 'string' || value.length > 4096) throw new SubscriptionError('Địa chỉ nhận push không hợp lệ.');
  let url: URL;
  try { url = new URL(value); } catch { throw new SubscriptionError('Địa chỉ nhận push không hợp lệ.'); }
  // Never let authenticated input turn the push sender into an arbitrary HTTP client.
  const allowed = url.hostname === 'fcm.googleapis.com' || url.hostname === 'updates.push.services.mozilla.com' ||
    url.hostname.endsWith('.push.apple.com') || url.hostname.endsWith('.notify.windows.com');
  if (url.protocol !== 'https:' || url.port || url.username || url.password || url.hash || !allowed) {
    throw new SubscriptionError('Dịch vụ push của trình duyệt này chưa được hỗ trợ. Dùng Chrome, Edge, Firefox hoặc Safari.');
  }
  return value;
}

export function validatePushRegistration(body: unknown) {
  if (!body || typeof body !== 'object') throw new SubscriptionError('Dữ liệu thiết bị không hợp lệ.');
  const { subscription, daysBefore } = body as Record<string, unknown>;
  if (!reminderLeadDays.includes(daysBefore as typeof reminderLeadDays[number])) throw new SubscriptionError('Chọn nhắc trước 0, 1, 3 hoặc 7 ngày.');
  if (!subscription || typeof subscription !== 'object') throw new SubscriptionError('Thiếu đăng ký thiết bị.');
  const { endpoint, keys } = subscription as Record<string, unknown>;
  const validatedEndpoint = validatePushEndpoint(endpoint);
  if (!keys || typeof keys !== 'object') throw new SubscriptionError('Thiếu khóa thiết bị.');
  const { p256dh, auth } = keys as Record<string, unknown>;
  const validKey = (value: unknown, size: number) => typeof value === 'string' && /^[A-Za-z0-9_-]+={0,2}$/.test(value) && Buffer.from(value, 'base64url').length === size;
  if (!validKey(p256dh, 65) || !validKey(auth, 16) || Buffer.from(p256dh as string, 'base64url')[0] !== 4) throw new SubscriptionError('Khóa thiết bị không hợp lệ.');
  return { endpoint: validatedEndpoint, endpointHash: endpointHash(validatedEndpoint), p256dh: p256dh as string, auth: auth as string, daysBefore: daysBefore as number };
}

export function pushFailureStatus(error: unknown) {
  return error && typeof error === 'object' && 'statusCode' in error ? Number(error.statusCode) : 0;
}

export async function sendDevicePush(device: SubscriptionPushDevice, payload: { title: string; body: string; tag: string }, ttl = 86400) {
  const config = pushConfig();
  // Check again at send time, including registrations restored from storage.
  validatePushEndpoint(device.endpoint);
  await webpush.sendNotification({ endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } }, JSON.stringify(payload), {
    vapidDetails: { subject: config.subject, publicKey: config.publicKey, privateKey: config.privateKey },
    TTL: ttl, urgency: 'normal', timeout: 4000,
  });
}

// Atomic leases prevent two overlapping cron requests from sending the same digest.
// A crash after the provider accepts a push may still produce a retry; the stable tag
// replaces an existing notification on browsers that support notification tags.
export async function dispatchSubscriptionPush(now = new Date()) {
  const config = pushConfig();
  const today = todayKey(now);
  const summary = { sent: 0, skipped: 0, expired: 0, failed: 0, incomplete: false };
  const deadline = Date.now() + 40_000;
  let cursor = '';
  while (Date.now() < deadline) {
    const devices = await prisma.subscriptionPushDevice.findMany({
      where: { vapidPublicKey: config.publicKey, ...(cursor ? { id: { gt: cursor } } : {}), AND: [
        { OR: [{ lastSentDate: null }, { lastSentDate: { not: today } }] },
        { OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] },
      ] }, orderBy: { id: 'asc' }, take: 10,
    });
    if (!devices.length) return summary;
    cursor = devices[devices.length - 1].id;
    await Promise.all(devices.map(async device => {
      const claimed = await prisma.subscriptionPushDevice.updateMany({ where: { id: device.id, userId: device.userId, updatedAt: device.updatedAt, AND: [
        { OR: [{ lastSentDate: null }, { lastSentDate: { not: today } }] },
        { OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] },
      ] }, data: { lockedUntil: new Date(now.getTime() + 120_000) } });
      if (!claimed.count) { summary.skipped++; return; }
      try {
        const count = await prisma.customerSubscription.count({ where: { userId: device.userId, status: 'active', cancelDate: { lte: new Date(`${addDays(today, device.daysBefore)}T00:00:00Z`) } } });
        if (!count) { summary.skipped++; return; }
        // Keep customer/account details off lock screens and queued stale messages.
        await sendDevicePush(device, { title: 'Billy · Nhắc hủy gói', body: `Có ${count} gói đến hạn, sắp đến hạn hoặc quá hạn hủy. Mở lịch để kiểm tra và xử lý.`, tag: `billy-subscriptions:${device.userId}:${today}` });
        await prisma.subscriptionPushDevice.updateMany({ where: { id: device.id, userId: device.userId }, data: { lastSentDate: today } });
        summary.sent++;
      } catch (error) {
        if ([404, 410].includes(pushFailureStatus(error))) {
          await prisma.subscriptionPushDevice.deleteMany({ where: { id: device.id, userId: device.userId } });
          summary.expired++;
        } else {
          // Do not log provider errors: they may contain private subscription endpoints.
          console.error('[WebPush] Delivery failed', { deviceId: device.id, status: pushFailureStatus(error) });
          summary.failed++;
        }
      } finally {
        await prisma.subscriptionPushDevice.updateMany({ where: { id: device.id, userId: device.userId }, data: { lockedUntil: null } });
      }
    }));
  }
  summary.incomplete = true;
  return summary;
}
