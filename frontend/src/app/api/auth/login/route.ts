import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { signJwt } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    const normalized = String(username || '').trim();
    if (!normalized || !password) {
      return NextResponse.json({ detail: 'Vui lòng nhập tên đăng nhập và mật khẩu.' }, { status: 400 });
    }
    let user = await prisma.user.findUnique({ where: { username: normalized } });
    // One-time, environment-controlled bootstrap for a brand-new Vercel DB.
    // No default production password is stored in source code.
    if (!user && normalized === (process.env.ADMIN_USERNAME || 'admin') && process.env.ADMIN_SETUP_KEY && password === process.env.ADMIN_SETUP_KEY) {
      user = await prisma.user.create({
        data: { username: normalized, password_hash: await bcrypt.hash(password, 12), role: 'admin' },
      });
    }
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return NextResponse.json({ detail: 'Tên đăng nhập hoặc mật khẩu không đúng.' }, { status: 401 });
    }
    const access_token = signJwt({ sub: user.username, id: user.id, role: user.role });
    return NextResponse.json({
      access_token,
      token_type: 'bearer',
      user: { id: user.id, username: user.username, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ detail: 'Không thể kết nối cơ sở dữ liệu Vercel.' }, { status: 503 });
  }
}
