import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getRequestUser } from '@/lib/auth';
import { clearBusinessAccountData } from '@/lib/businessBackup';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) {
    return NextResponse.json({ detail: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' }, { status: 401 });
  }

  // Yêu cầu bắt buộc: Chỉ tài khoản admin mới có quyền thực hiện xóa sạch toàn bộ hệ thống
  if (user.role !== 'admin') {
    return NextResponse.json({ detail: 'Chỉ có quản trị viên (Admin) mới có quyền xóa sạch hệ thống dữ liệu.' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const targetUserId = String(body.target_user_id || user.id);

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, username: true, role: true },
    });

    if (!targetUser) {
      return NextResponse.json({ detail: 'Không tìm thấy tài khoản cần xóa dữ liệu.' }, { status: 404 });
    }

    await clearBusinessAccountData(targetUserId, {
      deleteBackups: Boolean(body.delete_backups),
      createSafetyBackup: body.create_safety_backup !== false,
    });

    return NextResponse.json({
      message: `Đã xóa sạch toàn bộ dữ liệu kinh doanh của tài khoản @${targetUser.username}. Các tài khoản khác hoàn toàn không bị ảnh hưởng.`,
      target_user_id: targetUserId,
      target_username: targetUser.username,
    });
  } catch (error) {
    console.error('Reset business data error:', error);
    return NextResponse.json({ detail: 'Không thể xóa sạch dữ liệu. Vui lòng thử lại sau.' }, { status: 500 });
  }
}
