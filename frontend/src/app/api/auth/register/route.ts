import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { signJwt } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body.username || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const code = String(body.registration_code || '').trim().toUpperCase();
    if (username.length < 3 || !email || String(body.password || '').length < 6 || !code) {
      return NextResponse.json({ detail: 'Thông tin đăng ký chưa đầy đủ hoặc không hợp lệ.' }, { status: 400 });
    }
    const password_hash = await bcrypt.hash(body.password, 12);
    const user = await prisma.$transaction(async (tx) => {
      const invite = await tx.registrationCode.findUnique({ where: { code } });
      if (!invite || invite.isUsed) throw new Error('INVALID_CODE');
      if (await tx.user.findFirst({ where: { OR: [{ username }, { email }] } })) throw new Error('DUPLICATE_USER');
      const created = await tx.user.create({ data: { username, email, password_hash, role: 'user' } });
      const claimed = await tx.registrationCode.updateMany({
        where: { id: invite.id, isUsed: false },
        data: { isUsed: true, usedByUsername: username },
      });
      if (claimed.count !== 1) throw new Error('INVALID_CODE');
      return created;
    });
    const access_token = signJwt({ sub: user.username, id: user.id, role: user.role });
    return NextResponse.json({ access_token, token_type: 'bearer', user: { id: user.id, username: user.username, email: user.email, role: user.role } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'INVALID_CODE') return NextResponse.json({ detail: 'Mã đăng ký không hợp lệ hoặc đã được sử dụng.' }, { status: 400 });
    if (message === 'DUPLICATE_USER') return NextResponse.json({ detail: 'Tên đăng nhập hoặc email đã tồn tại.' }, { status: 400 });
    console.error('Registration error:', error);
    return NextResponse.json({ detail: 'Không thể kết nối cơ sở dữ liệu Vercel.' }, { status: 503 });
  }
}
