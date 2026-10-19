'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Boxes,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  KeyRound,
  LogOut,
  Menu,
  PackageOpen,
  ReceiptText,
  ShoppingCart,
  Users,
  Workflow,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';

const standaloneItems = [
  { href: '/business/pos', label: 'Bán tại quầy', icon: ShoppingCart },
  { href: '/business/customers', label: 'Khách hàng', icon: Users },
];

const groups = [
  {
    id: 'warehouse',
    label: 'Kho Hàng',
    icon: Boxes,
    items: [
      { href: '/business/products', label: 'Món bán POS', icon: PackageOpen },
      { href: '/business/inventory', label: 'Nhập & tồn kho', icon: Boxes },
    ],
  },
  {
    id: 'statistics',
    label: 'Thống kê',
    icon: BarChart3,
    items: [
      { href: '/business/workflow', label: 'Vận hành', icon: Workflow },
      { href: '/business/reports', label: 'Báo cáo', icon: BarChart3 },
      { href: '/business/orders', label: 'Đơn hàng', icon: ReceiptText },
      { href: '/business/daily', label: 'Doanh thu ngày', icon: CalendarDays },
      { href: '/business/expenses', label: 'Quản lý chi tiêu', icon: CircleDollarSign },
    ],
  },
] as const;

type GroupId = (typeof groups)[number]['id'];
type NavItem = { href: string; label: string; icon: typeof ShoppingCart };

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<GroupId, boolean>>({
    warehouse: false,
    statistics: false,
  });
  const isAdmin = user?.role === 'admin';
  const active = (href: string) => href === '/business' ? pathname === href : pathname.startsWith(href);
  const groupActive = (group: (typeof groups)[number]) => group.items.some(({ href }) => active(href));

  const toggleGroup = (id: GroupId) => {
    setOpenGroups(current => ({ ...current, [id]: !current[id] }));
  };

  const desktopLink = ({ href, label, icon: Icon }: NavItem, nested = false) => (
    <Link
      key={href}
      href={href}
      onClick={() => setOpen(false)}
      title={label}
      className={`flex w-full flex-nowrap items-center gap-2.5 rounded-2xl border text-sm font-black transition-all md:justify-center md:px-0 lg:justify-start ${nested ? 'h-10 px-3 lg:pl-7 lg:pr-3.5 xl:pl-8' : 'h-11 px-3 lg:px-3.5 xl:px-4'} ${
        active(href)
          ? 'pixel-active text-white'
          : nested
            ? 'border-[#57575c]/20 bg-[#e5dcc4] text-[#57575c] hover:bg-[#eee6d2]'
            : 'pixel-tile bg-[#cfc4a8] text-[#57575c] hover:bg-[#d9ceb0]'
      }`}
    >
      <Icon size={nested ? 17 : 19} className={`shrink-0 ${active(href) ? 'text-white stroke-white' : ''}`} />
      <span className="whitespace-nowrap md:hidden lg:inline">{label}</span>
    </Link>
  );

  const mobileLink = ({ href, label, icon: Icon }: NavItem) => (
    <Link
      key={href}
      href={href}
      onClick={() => setOpen(false)}
      title={label}
      className={`flex h-12 items-center justify-start gap-2.5 rounded-2xl px-3.5 text-xs font-black transition-all ${
        active(href) ? 'pixel-active text-white' : 'btn-push'
      }`}
    >
      <Icon size={18} className={`shrink-0 ${active(href) ? 'text-white stroke-white' : ''}`} />
      <span className="truncate">{label}</span>
    </Link>
  );

  const desktopGroup = (group: (typeof groups)[number]) => {
    const Icon = group.icon;
    const isActive = groupActive(group);
    const expanded = openGroups[group.id] || isActive;
    return (
      <div key={group.id} className="space-y-1.5">
        <button
          type="button"
          onClick={() => toggleGroup(group.id)}
          aria-expanded={expanded}
          title={group.label}
          className={`flex h-11 w-full flex-nowrap items-center gap-2.5 rounded-2xl border px-3 text-sm font-black transition-all md:justify-center md:px-0 lg:justify-start lg:px-3.5 xl:px-4 ${
            isActive ? 'pixel-active text-white' : 'pixel-tile bg-[#cfc4a8] text-[#57575c] hover:bg-[#d9ceb0]'
          }`}
        >
          <Icon size={19} className={`shrink-0 ${isActive ? 'text-white stroke-white' : ''}`} />
          <span className="whitespace-nowrap md:hidden lg:inline">{group.label}</span>
          <ChevronDown
            size={16}
            className={`ml-auto hidden shrink-0 transition-transform lg:block ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
        {expanded && <div className="space-y-1.5">{group.items.map(item => desktopLink(item, true))}</div>}
      </div>
    );
  };

  const mobileGroup = (group: (typeof groups)[number]) => {
    const Icon = group.icon;
    const isActive = groupActive(group);
    const expanded = openGroups[group.id] || isActive;
    return (
      <div key={group.id} className="col-span-2">
        <button
          type="button"
          onClick={() => toggleGroup(group.id)}
          aria-expanded={expanded}
          className={`flex h-12 w-full items-center gap-2.5 rounded-2xl px-3.5 text-xs font-black transition-all ${
            isActive ? 'pixel-active text-white' : 'btn-push'
          }`}
        >
          <Icon size={18} className={`shrink-0 ${isActive ? 'text-white stroke-white' : ''}`} />
          <span>{group.label}</span>
          <ChevronDown size={16} className={`ml-auto transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
        {expanded && <div className="mt-2.5 grid grid-cols-2 gap-2.5">{group.items.map(item => mobileLink(item))}</div>}
      </div>
    );
  };

  return (
    <>
      <aside className="pixel-panel sticky top-6 hidden h-[calc(100vh-48px)] w-20 shrink-0 self-start flex-col overflow-y-auto p-2.5 pb-3 pt-3.5 no-scrollbar md:flex lg:w-60 xl:w-64">
        <Link
          href="/business"
          title="Billy · Bán Hàng"
          className="pixel-logo mb-3 flex w-full flex-col items-center justify-center px-2 py-3 text-[#57575c] transition-transform active:translate-y-1 lg:items-start"
        >
          <span className="brand-orange text-[30px] font-black uppercase leading-none tracking-wider lg:hidden">B.</span>
          <span className="brand-orange hidden text-2xl font-black uppercase leading-none tracking-wider lg:block xl:text-[30px]">Billy.</span>
          <span className="mt-1 hidden text-[12px] font-black uppercase tracking-widest text-[#6d6a64] lg:block">Bán Hàng</span>
        </Link>
        <nav className="space-y-2">
          {desktopLink(standaloneItems[0])}
          {desktopGroup(groups[0])}
          {desktopLink(standaloneItems[1])}
          {desktopGroup(groups[1])}
          {isAdmin && desktopLink({ href: '/admin/registration-codes', label: 'Tài khoản', icon: KeyRound })}
        </nav>
        <div className="mt-auto pt-3">
          <p className="hidden truncate px-3 pb-2 text-sm font-bold text-[#6d6a64] lg:block">{user?.username}</p>
          <button
            onClick={logout}
            title="Đăng xuất"
            className="btn-push-danger flex h-11 w-full flex-nowrap items-center gap-2.5 rounded-full px-3 text-sm font-black md:justify-center md:px-0 lg:justify-start lg:px-3.5 xl:px-4"
          >
            <LogOut size={19} className="shrink-0" />
            <span className="whitespace-nowrap md:hidden lg:inline">Đăng xuất</span>
          </button>
        </div>
      </aside>

      <header className="pixel-panel fixed inset-x-3.5 top-[max(0.625rem,calc(env(safe-area-inset-top)+0.25rem))] z-50 flex h-14 items-center justify-between gap-3 px-5 py-2 md:hidden">
        <Link href="/business" className="flex items-baseline gap-1.5 text-[#57575c] transition-transform active:translate-y-1">
          <span className="brand-orange text-2xl font-black uppercase tracking-wider">Billy.</span>
          <span className="text-sm font-black uppercase tracking-widest text-[#6d6a64]">Bán Hàng</span>
        </Link>
        <button
          onClick={() => setOpen(value => !value)}
          aria-label={open ? 'Đóng menu' : 'Mở menu'}
          className="btn-push flex h-9 w-9 shrink-0 items-center justify-center"
        >
          {open ? <X size={19} /> : <Menu size={19} />}
        </button>
      </header>

      {open && (
        <div className="pixel-panel fixed inset-x-3.5 top-[calc(max(0.625rem,calc(env(safe-area-inset-top)+0.25rem))+4.25rem)] z-50 max-h-[calc(100vh-6rem-env(safe-area-inset-bottom))] overflow-y-auto p-4 md:hidden">
          <nav className="grid grid-cols-2 gap-2.5">
            {mobileLink(standaloneItems[0])}
            {mobileLink(standaloneItems[1])}
            {mobileGroup(groups[0])}
            {mobileGroup(groups[1])}
            {isAdmin && mobileLink({ href: '/admin/registration-codes', label: 'Tài khoản', icon: KeyRound })}
          </nav>
          <button onClick={logout} className="btn-push-danger mt-3.5 flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-black">
            <LogOut size={18} /> Đăng xuất
          </button>
        </div>
      )}
    </>
  );
}
