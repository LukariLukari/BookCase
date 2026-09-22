import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const source = process.env.DATABASE_URL
    ? 'DATABASE_URL'
    : process.env.POSTGRES_PRISMA_URL
      ? 'POSTGRES_PRISMA_URL'
      : process.env.POSTGRES_URL
        ? 'POSTGRES_URL'
        : process.env.POSTGRES_URL_NON_POOLING
          ? 'POSTGRES_URL_NON_POOLING'
          : null;
  if (!source) {
    return NextResponse.json({ ok: false, code: 'DATABASE_URL_MISSING', detail: 'Chưa gắn PostgreSQL vào Vercel project.' }, { status: 503 });
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, database: 'postgresql', source });
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : 'DATABASE_UNREACHABLE';
    return NextResponse.json({ ok: false, code, detail: 'Có URL PostgreSQL nhưng Vercel không thể kết nối.' }, { status: 503 });
  }
}
