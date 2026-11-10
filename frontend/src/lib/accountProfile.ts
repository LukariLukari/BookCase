import type { Prisma } from '@prisma/client';

export type AccountProfile = {
  id: string;
  username: string;
  email: string | null;
  role: string;
  createdAt: string;
  displayName: string;
  phone: string;
  bio: string;
  avatarDataUrl: string | null;
  passwordChangedAt: string | null;
};

export const accountProfileSelect = {
  id: true, username: true, email: true, role: true, createdAt: true,
  profile: { select: { displayName: true, phone: true, bio: true, avatarDataUrl: true, passwordChangedAt: true } },
} satisfies Prisma.UserSelect;

export function serializeProfile(user: Prisma.UserGetPayload<{ select: typeof accountProfileSelect }>): AccountProfile {
  return {
    id: user.id, username: user.username, email: user.email, role: user.role,
    createdAt: user.createdAt.toISOString(),
    displayName: user.profile?.displayName || '', phone: user.profile?.phone || '', bio: user.profile?.bio || '',
    avatarDataUrl: user.profile?.avatarDataUrl || null,
    passwordChangedAt: user.profile?.passwordChangedAt?.toISOString() || null,
  };
}

export class ProfileInputError extends Error {}

// Raster data only: no SVG, remote tracking URLs or executable image formats.
export function validateAvatar(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || value.length > 350_000) throw new ProfileInputError('Ảnh đại diện tối đa 256 KB sau khi xử lý.');
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) throw new ProfileInputError('Ảnh đại diện phải là PNG, JPEG hoặc WebP.');
  const bytes = Buffer.from(match[2], 'base64');
  const valid = match[1] === 'png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : match[1] === 'jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!valid || bytes.length > 256 * 1024) throw new ProfileInputError('Ảnh đại diện không hợp lệ hoặc vượt quá 256 KB.');
  return value;
}

export function parseProfileInput(body: Record<string, unknown>) {
  const allowed = new Set(['displayName', 'phone', 'bio', 'avatarDataUrl', 'email', 'currentPassword']);
  if (Object.keys(body).some(key => !allowed.has(key)) || !Object.keys(body).some(key => key !== 'currentPassword')) {
    throw new ProfileInputError('Thông tin cập nhật không hợp lệ.');
  }
  const profile: { displayName?: string; phone?: string; bio?: string; avatarDataUrl?: string | null } = {};
  for (const [key, limit] of [['displayName', 80], ['phone', 30], ['bio', 300]] as const) {
    if (!(key in body)) continue;
    if (typeof body[key] !== 'string' || body[key].trim().length > limit) throw new ProfileInputError(`Thông tin ${key} quá dài hoặc không hợp lệ.`);
    profile[key] = body[key].trim();
  }
  if (profile.phone && !/^[+\d\s().-]{3,30}$/.test(profile.phone)) throw new ProfileInputError('Số điện thoại không hợp lệ.');
  if ('avatarDataUrl' in body) profile.avatarDataUrl = validateAvatar(body.avatarDataUrl);
  let email: string | undefined;
  if ('email' in body) {
    if (typeof body.email !== 'string') throw new ProfileInputError('Email không hợp lệ.');
    email = body.email.trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ProfileInputError('Email không hợp lệ.');
  }
  return { profile, email };
}

export async function readProfileBody(request: Request): Promise<Record<string, unknown>> {
  if (Number(request.headers.get('content-length')) > 360_000) throw new ProfileInputError('Dữ liệu gửi lên quá lớn.');
  const text = await request.text();
  if (text.length > 360_000) throw new ProfileInputError('Dữ liệu gửi lên quá lớn.');
  let body: unknown;
  try { body = JSON.parse(text); } catch { throw new ProfileInputError('Dữ liệu gửi lên không hợp lệ.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ProfileInputError('Dữ liệu gửi lên không hợp lệ.');
  return body as Record<string, unknown>;
}
