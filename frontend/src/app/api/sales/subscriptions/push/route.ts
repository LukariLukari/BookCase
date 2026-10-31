import { NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { SubscriptionError, subscriptionUnauthorized } from '@/lib/subscriptionServer';
import { endpointHash, pushConfig, pushFailureStatus, sendDevicePush, validatePushEndpoint, validatePushRegistration } from '@/lib/webPushServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
async function body(request: Request) {
  const text = await request.text();
  if (text.length > 16000) throw new SubscriptionError('Dữ liệu thiết bị quá lớn.', 413);
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, unknown>;
  } catch { throw new SubscriptionError('Dữ liệu thiết bị không hợp lệ.'); }
}
function failure(error: unknown) {
  if (error instanceof SubscriptionError) return json({ detail: error.message }, error.status);
  console.error('[WebPush] Device request failed');
  return json({ detail: 'Không thể cập nhật thông báo. Kiểm tra cấu hình Web Push và cơ sở dữ liệu.' }, 500);
}

export async function GET(request: Request) {
  if (!getRequestUser(request)) return subscriptionUnauthorized();
  try { return json({ publicKey: pushConfig().publicKey }); }
  catch (error) { return failure(error); }
}

export async function PUT(request: Request) {
  const user = getRequestUser(request);
  if (!user) return subscriptionUnauthorized();
  try {
    const config = pushConfig();
    const data = validatePushRegistration(await body(request));
    const previous = await prisma.subscriptionPushDevice.findUnique({ where: { endpointHash: data.endpointHash } });
    if (previous && (previous.p256dh !== data.p256dh || previous.auth !== data.auth)) throw new SubscriptionError('Đăng ký thiết bị đã thay đổi. Tắt và bật lại thông báo.', 409);
    if (previous?.userId !== user.id && await prisma.subscriptionPushDevice.count({ where: { userId: user.id } }) >= 20) throw new SubscriptionError('Tối đa 20 thiết bị cho mỗi tài khoản.', 409);
    const device = await prisma.subscriptionPushDevice.upsert({ where: { endpointHash: data.endpointHash },
      create: { ...data, userId: user.id, vapidPublicKey: config.publicKey },
      update: { ...data, userId: user.id, vapidPublicKey: config.publicKey, ...(previous?.userId !== user.id ? { lastSentDate: null, lastTestAt: null } : {}) },
    });
    return json({ enabled: true, daysBefore: device.daysBefore });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  const user = getRequestUser(request);
  if (!user) return subscriptionUnauthorized();
  try {
    const input = await body(request);
    if (input.action !== 'status' && input.action !== 'test') throw new SubscriptionError('Thao tác không hợp lệ.');
    const hash = endpointHash(validatePushEndpoint(input.endpoint));
    const device = await prisma.subscriptionPushDevice.findFirst({ where: { endpointHash: hash, userId: user.id } });
    if (input.action === 'status') return json({ enabled: !!device && device.vapidPublicKey === pushConfig().publicKey, daysBefore: device?.daysBefore ?? 3 });
    if (!device) throw new SubscriptionError('Thiết bị chưa bật Web Push cho tài khoản này.', 404);
    if (device.vapidPublicKey !== pushConfig().publicKey) throw new SubscriptionError('Khóa máy chủ đã thay đổi. Tắt rồi bật lại Web Push.', 409);
    const claimed = await prisma.subscriptionPushDevice.updateMany({ where: { id: device.id, userId: user.id, OR: [{ lastTestAt: null }, { lastTestAt: { lt: new Date(Date.now() - 30_000) } }] }, data: { lastTestAt: new Date() } });
    if (!claimed.count) throw new SubscriptionError('Chờ 30 giây trước khi gửi thử tiếp.', 429);
    try {
      await sendDevicePush(device, { title: 'Billy · Thông báo thử', body: 'Web Push từ máy chủ đã hoạt động. Bấm để mở Lịch gia hạn.', tag: 'billy-subscriptions-test' }, 300);
    } catch (error) {
      if ([404, 410].includes(pushFailureStatus(error))) {
        await prisma.subscriptionPushDevice.deleteMany({ where: { id: device.id, userId: user.id } });
        throw new SubscriptionError('Đăng ký đã hết hiệu lực. Tắt rồi bật lại Web Push.', 410);
      }
      throw new SubscriptionError('Dịch vụ push chưa nhận thông báo. Kiểm tra khóa VAPID, kết nối máy chủ rồi thử lại.', 502);
    }
    return json({ accepted: true });
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request) {
  const user = getRequestUser(request);
  if (!user) return subscriptionUnauthorized();
  try {
    const input = await body(request);
    await prisma.subscriptionPushDevice.deleteMany({ where: { endpointHash: endpointHash(validatePushEndpoint(input.endpoint)), userId: user.id } });
    return json({ enabled: false });
  } catch (error) { return failure(error); }
}
