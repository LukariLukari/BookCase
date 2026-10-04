'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Boxes, KeyRound, LogOut, Menu, ReceiptText, Store, Users, Workflow, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';

const items = [
  { href: '/business', label: 'Tổng quan', icon: Store },
  { href: '/business/orders', label: 'Đơn hàng', icon: ReceiptText },
  { href: '/business/workflow', label: 'Vận hành', icon: Workflow },
  { href: '/business/customers', label: 'Khách hàng', icon: Users },
  { href: '/business/inventory', label: 'Kho hàng', icon: Boxes },
  { href: '/business/reports', label: 'Báo cáo', icon: BarChart3 },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navItems = user?.role === 'admin' ? [...items, { href: '/admin/registration-codes', label: 'Tài khoản', icon: KeyRound }] : items;
  const active = (href: string) => href === '/business' ? pathname === href : pathname.startsWith(href);

  const desktopLinks = (
    <>
      {navItems.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={() => setOpen(false)}
          title={label}
          className={`flex h-11 w-full items-center gap-3 rounded-full px-3 text-sm font-black transition-all md:justify-center md:px-0 xl:justify-start xl:px-4 ${
            active(href)
              ? 'btn-push-primary'
              : 'text-[#5F554E] hover:bg-white hover:border-2 hover:border-[#203354] hover:shadow-[0_3px_0_0_#203354] hover:text-[#203354] active:translate-y-[3px] active:shadow-none'
          }`}
        >
          <Icon size={19} className="shrink-0" />
          <span className="md:hidden xl:inline">{label}</span>
        </Link>
      ))}
    </>
  );

  const mobileLinks = (
    <>
      {navItems.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={() => setOpen(false)}
          title={label}
          className={`flex h-12 items-center justify-start gap-2.5 rounded-full px-3.5 text-xs font-black transition-all ${
            active(href)
              ? 'btn-push-primary shadow-[0_3px_0_0_#0E1626]'
              : 'btn-push text-[#203354]'
          }`}
        >
          <Icon size={18} className="shrink-0" />
          <span className="truncate">{label}</span>
        </Link>
      ))}
    </>
  );

  return (
    <>
      <aside className="sticky top-6 hidden h-[calc(100vh-48px)] w-20 shrink-0 self-start flex-col card-push p-2.5 pt-3.5 pb-3 no-scrollbar overflow-y-auto md:flex xl:w-52">
        <Link
          href="/business"
          title="Billy · Bán Hàng"
          className="btn-push-primary mb-3 flex h-11 w-full items-center justify-center rounded-full font-black text-white xl:justify-start xl:px-4"
        >
          <span className="text-sm font-black tracking-wider">Billy</span>
          <span className="hidden truncate text-xs font-black tracking-wide text-white/90 xl:inline ml-1.5">
            · BÁN HÀNG
          </span>
        </Link>
        <nav className="space-y-2">{desktopLinks}</nav>
        <div className="mt-auto border-t-2 border-[#203354]/20 pt-3">
          <p className="hidden truncate px-3 pb-2 text-xs font-bold text-[#776C64] xl:block">
            {user?.username}
          </p>
          <button
            onClick={logout}
            title="Đăng xuất"
            className="btn-push-danger flex h-11 w-full items-center gap-3 rounded-full px-3 text-sm font-black text-[#9B3B30] md:justify-center md:px-0 xl:justify-start xl:px-4"
          >
            <LogOut size={19} className="shrink-0" />
            <span className="md:hidden xl:inline">Đăng xuất</span>
          </button>
        </div>
      </aside>
      <header className="fixed inset-x-2 top-2 z-50 flex h-12 items-center justify-between card-push px-4 rounded-2xl md:hidden">
        <Link href="/business" className="font-black text-[#203354]">BILLY · BÁN HÀNG</Link>
        <button onClick={() => setOpen(v => !v)} aria-label="Mở menu" className="btn-push flex h-9 w-9 items-center justify-center rounded-xl">
          {open ? <X size={18}/> : <Menu size={18}/>}
        </button>
      </header>
      {open && (
        <div className="card-push fixed inset-x-2 top-[62px] z-50 p-3.5 shadow-2xl md:hidden">
          <nav className="grid grid-cols-2 gap-2">{mobileLinks}</nav>
          <button onClick={logout} className="btn-push-danger mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-black text-[#9B3B30]">
            <LogOut size={18}/> Đăng xuất
          </button>
        </div>
      )}
    </>
  );
}
