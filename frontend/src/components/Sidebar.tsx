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
          className={`flex h-11 w-full items-center gap-3 rounded-2xl border px-3 text-sm font-black transition-all md:justify-center md:px-0 xl:justify-start xl:px-4 ${
            active(href)
              ? 'border-transparent bg-[#18201c] text-white shadow-[0_8px_20px_rgb(24_32_28_/_0.16)]'
              : 'border-transparent bg-white/55 text-[#18201c]/70 shadow-none hover:bg-white hover:text-[#18201c]'
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
          className={`flex h-12 items-center justify-start gap-2.5 rounded-2xl px-3.5 text-xs font-black transition-all ${
            active(href)
              ? 'bg-[#18201c] text-white shadow-[0_8px_20px_rgb(24_32_28_/_0.16)]'
              : 'btn-push'
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
      <aside className="sticky top-6 hidden h-[calc(100vh-48px)] w-20 shrink-0 self-start flex-col rounded-[30px] border border-white/70 bg-[#fbfaf5]/95 p-2.5 pt-3.5 pb-3 shadow-[0_18px_44px_rgb(39_45_37_/_0.08)] backdrop-blur-xl no-scrollbar overflow-y-auto md:flex xl:w-52">
        <Link
          href="/business"
          title="Billy · Bán Hàng"
          className="btn-push-primary mb-3 flex h-11 w-full items-center justify-center font-black text-white xl:justify-start xl:px-4"
        >
          <span className="text-sm font-black tracking-wider">Billy</span>
          <span className="hidden truncate text-xs font-black tracking-wide text-white/90 xl:inline ml-1.5">
            · BÁN HÀNG
          </span>
        </Link>
        <nav className="space-y-2">{desktopLinks}</nav>
        <div className="mt-auto border-t border-[#18201c]/8 pt-3">
          <p className="hidden truncate px-3 pb-2 text-xs font-bold text-[#18201c]/60 xl:block">
            {user?.username}
          </p>
          <button
            onClick={logout}
            title="Đăng xuất"
            className="btn-push-danger flex h-11 w-full items-center gap-3 rounded-full px-3 text-sm font-black md:justify-center md:px-0 xl:justify-start xl:px-4"
          >
            <LogOut size={19} className="shrink-0" />
            <span className="md:hidden xl:inline">Đăng xuất</span>
          </button>
        </div>
      </aside>
      <header className="fixed inset-x-3.5 top-[max(0.625rem,calc(env(safe-area-inset-top)+0.25rem))] z-50 flex h-14 items-center justify-between gap-3 rounded-[22px] border border-white/70 bg-[#fbfaf5]/95 px-5 py-2 shadow-[0_10px_30px_rgb(39_45_37_/_0.08)] backdrop-blur-xl md:hidden">
        <Link href="/business" className="font-black text-[#18201c] tracking-wide text-sm">BILLY · BÁN HÀNG</Link>
        <button
          onClick={() => setOpen(v => !v)}
          aria-label={open ? 'Đóng menu' : 'Mở menu'}
          className="btn-push flex h-9 w-9 shrink-0 items-center justify-center text-[#18201c]"
        >
          {open ? <X size={19}/> : <Menu size={19}/>}
        </button>
      </header>
      {open && (
        <div className="fixed inset-x-3.5 top-[calc(max(0.625rem,calc(env(safe-area-inset-top)+0.25rem))+4.25rem)] z-50 rounded-[24px] border border-white/70 bg-[#fbfaf5]/98 p-4 shadow-[0_16px_38px_rgb(39_45_37_/_0.1)] backdrop-blur-xl md:hidden">
          <nav className="grid grid-cols-2 gap-2.5">{mobileLinks}</nav>
          <button onClick={logout} className="btn-push-danger mt-3.5 flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-black">
            <LogOut size={18}/> Đăng xuất
          </button>
        </div>
      )}
    </>
  );
}
