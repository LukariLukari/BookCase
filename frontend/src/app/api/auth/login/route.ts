import { NextResponse } from 'next/server';

const backend = () => (
  process.env.BACKEND_API_URL ||
  (process.env.NODE_ENV === 'production'
    ? 'https://virtual-bookshelf-api.onrender.com'
    : 'http://localhost:8000')
).replace(/\/$/, '');

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    if (!username || !password) {
      return NextResponse.json({ detail: 'Vui lòng nhập tên đăng nhập và mật khẩu.' }, { status: 400 });
    }

    const form = new URLSearchParams({ username: username.trim(), password });
    const authResponse = await fetch(`${backend()}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
      cache: 'no-store',
    });
    const authBody = await authResponse.json().catch(() => ({}));
    if (!authResponse.ok) {
      return NextResponse.json(authBody, { status: authResponse.status });
    }

    const meResponse = await fetch(`${backend()}/api/auth/me`, {
      headers: { Authorization: `Bearer ${authBody.access_token}` },
      cache: 'no-store',
    });
    const user = await meResponse.json().catch(() => null);
    if (!meResponse.ok || !user) {
      return NextResponse.json({ detail: 'Không thể tải thông tin tài khoản.' }, { status: 502 });
    }

    return NextResponse.json({ ...authBody, user });
  } catch (error) {
    console.error('Login gateway error:', error);
    return NextResponse.json({ detail: 'Máy chủ dữ liệu đang tạm thời không phản hồi.' }, { status: 503 });
  }
}
