import { NextResponse } from 'next/server';
import { prisma, getDatabaseSource } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const source = getDatabaseSource();
  if (!source) {
    return NextResponse.json({ ok: false, code: 'DATABASE_URL_MISSING', detail: 'Máy chủ chưa cấu hình kết nối PostgreSQL.' }, { status: 503 });
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, database: 'postgresql', source });
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : 'DATABASE_UNREACHABLE';
    return NextResponse.json({ ok: false, code, detail: 'Máy chủ không thể kết nối PostgreSQL.' }, { status: 503 });
  }
}
