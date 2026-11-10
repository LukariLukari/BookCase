import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getRequestUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { accountProfileSelect, parseProfileInput, ProfileInputError, readProfileBody, serializeProfile } from '@/lib/accountProfile';

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

export async function GET(request: Request) {
  const actor = getRequestUser(request);
  if (!actor) return json({ detail: 'Vui lòng đăng nhập lại.' }, 401);
  try {
    const user = await prisma.user.findUnique({ where: { id: actor.id }, select: accountProfileSelect });
    return user ? json(serializeProfile(user)) : json({ detail: 'Tài khoản không còn tồn tại.' }, 401);
  } catch {
    return json({ detail: 'Không thể tải hồ sơ. Vui lòng thử lại.' }, 503);
  }
}

export async function PATCH(request: Request) {
  const actor = getRequestUser(request);
  if (!actor) return json({ detail: 'Vui lòng đăng nhập lại.' }, 401);
  try {
    const body = await readProfileBody(request);
    const { profile, email } = parseProfileInput(body);
    const user = await prisma.user.findUnique({ where: { id: actor.id }, select: { id: true, email: true, password_hash: true } });
    if (!user) return json({ detail: 'Tài khoản không còn tồn tại.' }, 401);
    const changingEmail = email !== undefined && email !== user.email;
    if (changingEmail && (typeof body.currentPassword !== 'string' || !await bcrypt.compare(body.currentPassword, user.password_hash))) {
      return json({ detail: 'Nhập đúng mật khẩu hiện tại để thay đổi email.' }, 400);
    }
    const result = await prisma.$transaction(async tx => {
      if (changingEmail) {
        const changed = await tx.user.updateMany({ where: { id: actor.id, password_hash: user.password_hash }, data: { email } });
        if (changed.count !== 1) throw new ProfileInputError('Tài khoản vừa được thay đổi. Vui lòng tải lại hồ sơ.');
      }
      if (Object.keys(profile).length) await tx.userProfile.upsert({ where: { userId: actor.id }, create: { userId: actor.id, ...profile }, update: profile });
      return tx.user.findUniqueOrThrow({ where: { id: actor.id }, select: accountProfileSelect });
    });
    return json(serializeProfile(result));
  } catch (error) {
    if (error instanceof ProfileInputError) return json({ detail: error.message }, 400);
    if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002') return json({ detail: 'Email này đã được sử dụng bởi tài khoản khác.' }, 409);
    return json({ detail: 'Không thể lưu hồ sơ. Vui lòng thử lại.' }, 503);
  }
}
