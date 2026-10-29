import Link from 'next/link';
import { BookOpen, ReceiptText, Tags, Wallet } from 'lucide-react';

const items = [
  { view: 'overview', href: '/business/expenses', label: 'Tổng quan', icon: BookOpen },
  { view: 'transactions', href: '/business/expenses/transactions', label: 'Giao dịch', icon: ReceiptText },
  { view: 'accounts', href: '/business/expenses/accounts', label: 'Khoản tiền', icon: Wallet },
  { view: 'categories', href: '/business/expenses/categories', label: 'Danh mục', icon: Tags },
] as const;

export default function FinanceNav({ view }: { view: typeof items[number]['view'] }) {
  return (
    <nav aria-label="Quản lý chi tiêu" className="finance-tabs grid grid-cols-2 md:flex md:flex-wrap">
      {items.map(({ view: itemView, href, label, icon: Icon }) => (
        <Link key={href} href={href} aria-current={view === itemView ? 'page' : undefined} className="finance-nav-link ui-flat-control">
          <Icon size={18} aria-hidden="true" />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
