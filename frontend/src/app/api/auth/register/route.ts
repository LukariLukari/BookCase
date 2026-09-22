import { NextResponse } from 'next/server';

const backend = () => (
  process.env.BACKEND_API_URL ||
  (process.env.NODE_ENV === 'production'
    ? 'https://virtual-bookshelf-api.onrender.com'
    : 'http://localhost:8000')
).replace(/\/$/, '');

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const response = await fetch(`${backend()}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, registration_code: body.registration_code?.trim().toUpperCase(), role: 'user' }),
      cache: 'no-store',
    });
    const result = await response.json().catch(() => ({ detail: 'Phản hồi máy chủ không hợp lệ.' }));
    return NextResponse.json(result, { status: response.status });
  } catch (error) {
    console.error('Registration gateway error:', error);
    return NextResponse.json({ detail: 'Máy chủ dữ liệu đang tạm thời không phản hồi.' }, { status: 503 });
  }
}
