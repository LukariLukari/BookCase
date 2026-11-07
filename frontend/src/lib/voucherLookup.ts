import type { PrismaClient } from '@prisma/client';
import { normalizeVoucherCode } from './vouchers';

export function findVoucher(client: Pick<PrismaClient, 'businessVoucher'>, userId: string, value: string) {
  const text = value.trim();
  return client.businessVoucher.findFirst({
    where: { userId, ...(/^BV:/i.test(text) ? { id: text.slice(3) } : { code: normalizeVoucherCode(text) }) },
    select: { id: true, code: true, note: true },
  });
}
