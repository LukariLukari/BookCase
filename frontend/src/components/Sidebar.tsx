'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Boxes, KeyRound, LogOut, Menu, ReceiptText, Store, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';

const items = [
  { href: '/business', label: 'Tổng quan', icon: Store },
  { href: '/business/orders', label: 'Đơn hàng', icon: ReceiptText },
  { href: '/business/inventory', label: 'Kho hàng', icon: Boxes },
  { href: '/business/reports', label: 'Báo cáo', icon: BarChart3 },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navItems = user?.role === 'admin' ? [...items, { href: '/admin/registration-codes', label: 'Tài khoản', icon: KeyRound }] : items;
  const active = (href: string) => href === '/business' ? pathname === href : pathname.startsWith(href);
  const links = <>{navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setOpen(false)} title={label} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-black transition ${active(href) ? 'bg-[#203354] text-white shadow-md' : 'text-[#5F554E] hover:bg-[#EEE7DF]'}`}><Icon size={19}/><span className="md:hidden xl:inline">{label}</span></Link>)}</>;
  return <>
    <aside className="sticky top-6 hidden h-[calc(100vh-48px)] w-20 shrink-0 flex-col rounded-[28px] border border-[#ECE2D5] bg-[#FAF7F2] p-2 shadow-lg md:flex xl:w-52">
      <Link href="/business" className="mb-5 flex h-14 items-center justify-center rounded-2xl bg-[#203354] font-black text-white xl:justify-start xl:px-4">BC<span className="hidden xl:inline"> · BÁN HÀNG</span></Link>
      <nav className="space-y-2">{links}</nav>
      <div className="mt-auto border-t border-[#E4D9CE] pt-3"><p className="hidden truncate px-3 pb-2 text-xs font-bold text-[#776C64] xl:block">{user?.username}</p><button onClick={logout} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-black text-[#9B403A] hover:bg-red-50"><LogOut size={19}/><span className="md:hidden xl:inline">Đăng xuất</span></button></div>
    </aside>
    <header className="fixed inset-x-2 top-2 z-50 flex h-12 items-center justify-between rounded-2xl border border-[#ECE2D5] bg-[#FAF7F2]/95 px-4 shadow-md backdrop-blur md:hidden"><Link href="/business" className="font-black text-[#203354]">BC · BÁN HÀNG</Link><button onClick={() => setOpen(v => !v)} aria-label="Mở menu" className="rounded-lg bg-[#E9E2DA] p-2">{open ? <X size={18}/> : <Menu size={18}/>}</button></header>
    {open && <div className="fixed inset-x-2 top-[62px] z-50 rounded-2xl border border-[#E2D8CC] bg-[#FAF7F2] p-3 shadow-2xl md:hidden"><nav className="grid grid-cols-2 gap-2">{links}</nav><button onClick={logout} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 p-3 text-sm font-black text-[#9B403A]"><LogOut size={18}/> Đăng xuất</button></div>}
  </>;
}
