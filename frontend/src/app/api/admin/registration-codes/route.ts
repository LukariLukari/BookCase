import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getRequestUser } from '@/lib/auth';

function unauthorized() {
  return NextResponse.json({ detail: 'Bạn không có quyền quản trị.' }, { status: 403 });
}

function serialize(item: { id: string; code: string; isUsed: boolean; usedByUsername: string | null; createdBy: string | null; createdAt: Date }) {
  return { id: item.id, code: item.code, is_used: item.isUsed, used_by_username: item.usedByUsername, created_by: item.createdBy, created_at: item.createdAt.toISOString() };
}

async function uniqueCode() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const value = randomBytes(6).toString('hex').toUpperCase().match(/.{1,4}/g)!.join('-');
    if (!(await prisma.registrationCode.findUnique({ where: { code: value }, select: { id: true } }))) return value;
  }
  throw new Error('CODE_GENERATION_FAILED');
}

export async function GET(request: Request) {
  const user = getRequestUser(request);
  if (!user || user.role !== 'admin') return unauthorized();
  try {
    const codes = await prisma.registrationCode.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json(codes.map(serialize));
  } catch (error) {
    console.error('List registration codes error:', error);
    return NextResponse.json({ detail: 'Không thể tải mã đăng ký. Kiểm tra kết nối cơ sở dữ liệu.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const user = getRequestUser(request);
  if (!user || user.role !== 'admin') return unauthorized();
  try {
    const code = await uniqueCode();
    const created = await prisma.registrationCode.create({ data: { code, createdBy: user.sub } });
    return NextResponse.json(serialize(created), { status: 201 });
  } catch (error) {
    console.error('Create registration code error:', error);
    return NextResponse.json({ detail: 'Không thể tạo mã đăng ký. Vui lòng thử lại.' }, { status: 503 });
  }
}
