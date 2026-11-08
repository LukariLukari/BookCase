'use client';

import Link from 'next/link';
import { CircleDollarSign, ReceiptText, ShoppingCart } from 'lucide-react';

const options = [
  { href: '/business/orders#new-order', label: 'Tạo đơn hàng từ hàng tồn', icon: ReceiptText },
  { href: '/business/pos', label: 'Bán tại quầy', icon: ShoppingCart },
  { href: '/business/expenses', label: 'Quản lý chi tiêu', icon: CircleDollarSign },
];

export default function QuickCreateOptions({ close }: { close: () => void }) {
  return options.map(({ href, label, icon: Icon }) => (
    <Link
      key={href}
      href={href}
      aria-label={label}
      title={label}
      className="quick-create-option btn-push-primary flex h-14 w-14 items-center justify-center"
      onClick={close}
    >
      <Icon size={25} />
    </Link>
  ));
}
