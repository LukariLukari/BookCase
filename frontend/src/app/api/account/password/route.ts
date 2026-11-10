import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getRequestUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { ProfileInputError, readProfileBody } from '@/lib/accountProfile';

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

export async function POST(request: Request) {
  const actor = getRequestUser(request);
  if (!actor) return json({ detail: 'Vui lòng đăng nhập lại.' }, 401);
  try {
    const body = await readProfileBody(request);
    if (Object.keys(body).some(key => !['currentPassword', 'newPassword', 'confirmPassword'].includes(key)) ||
      typeof body.currentPassword !== 'string' || typeof body.newPassword !== 'string' || typeof body.confirmPassword !== 'string') {
      throw new ProfileInputError('Vui lòng nhập đầy đủ thông tin mật khẩu.');
    }
    if (body.newPassword.length < 8 || Buffer.byteLength(body.newPassword, 'utf8') > 72) throw new ProfileInputError('Mật khẩu mới cần ít nhất 8 ký tự và tối đa 72 byte.');
    if (body.newPassword !== body.confirmPassword) throw new ProfileInputError('Mật khẩu xác nhận không khớp.');
    const user = await prisma.user.findUnique({ where: { id: actor.id }, select: { password_hash: true } });
    if (!user) return json({ detail: 'Tài khoản không còn tồn tại.' }, 401);
    if (!await bcrypt.compare(body.currentPassword, user.password_hash)) throw new ProfileInputError('Mật khẩu hiện tại không đúng.');
    if (await bcrypt.compare(body.newPassword, user.password_hash)) throw new ProfileInputError('Mật khẩu mới phải khác mật khẩu hiện tại.');
    const password_hash = await bcrypt.hash(body.newPassword, 12);
    const passwordChangedAt = new Date();
    await prisma.$transaction(async tx => {
      const changed = await tx.user.updateMany({ where: { id: actor.id, password_hash: user.password_hash }, data: { password_hash } });
      if (changed.count !== 1) throw new ProfileInputError('Mật khẩu vừa được thay đổi. Vui lòng thử lại.');
      await tx.userProfile.upsert({ where: { userId: actor.id }, create: { userId: actor.id, passwordChangedAt }, update: { passwordChangedAt } });
    });
    return json({ detail: 'Đã cập nhật mật khẩu.', passwordChangedAt: passwordChangedAt.toISOString() });
  } catch (error) {
    if (error instanceof ProfileInputError) return json({ detail: error.message }, 400);
    return json({ detail: 'Không thể đổi mật khẩu. Vui lòng thử lại.' }, 503);
  }
}
