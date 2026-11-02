'use client';

import Link, { useLinkStatus } from 'next/link';
import { ChartPie, ReceiptText, Tags, Wallet } from 'lucide-react';

const items = [
  { view: 'transactions', href: '/business/expenses/transactions', label: 'Giao dịch', icon: ReceiptText },
  { view: 'accounts', href: '/business/expenses/accounts', label: 'Khoản tiền', icon: Wallet },
  { view: 'statistics', href: '/business/expenses/statistics', label: 'Thống kê', icon: ChartPie },
  { view: 'categories', href: '/business/expenses/categories', label: 'Danh mục', icon: Tags },
] as const;

function NavigationFeedback() {
  const { pending } = useLinkStatus();
  return <span aria-hidden="true" className={`finance-nav-progress${pending ? ' is-pending' : ''}`} />;
}

export default function FinanceNav({ view }: { view: typeof items[number]['view'] }) {
  return (
    <nav aria-label="Quản lý chi tiêu" className="finance-footer pixel-panel">
      {items.map(({ view: itemView, href, label, icon: Icon }) => (
        <Link key={href} href={href} prefetch={true} aria-current={view === itemView ? 'page' : undefined} className={`finance-nav-link ui-flat-control${view === itemView ? ' is-active' : ''}`} >
          <Icon size={18} aria-hidden="true" />
          <span>{label}</span>
          <NavigationFeedback />
        </Link>
      ))}
    </nav>
  );
}
