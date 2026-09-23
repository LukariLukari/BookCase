'use client';
import Link from 'next/link';
import { KeyRound, Store } from 'lucide-react';

export default function AdminTabs() {
  return <nav className="flex flex-wrap gap-2" aria-label="Điều hướng quản trị">
    <Link href="/business" className="inline-flex items-center gap-2 rounded-full border border-[#D9CFC4] bg-white px-4 py-2 text-xs font-black text-[#203354]"><Store size={15}/> Quản lý bán hàng</Link>
    <Link href="/admin/registration-codes" className="inline-flex items-center gap-2 rounded-full bg-[#203354] px-4 py-2 text-xs font-black text-white shadow"><KeyRound size={15}/> Cấp tài khoản</Link>
  </nav>;
}
