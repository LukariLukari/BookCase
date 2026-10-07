'use client';
import Link from 'next/link';
import { KeyRound, Store } from 'lucide-react';

export default function AdminTabs() {
  return <nav className="flex flex-wrap gap-2" aria-label="Điều hướng quản trị">
    <Link href="/business" className="btn-push inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black text-[#1C1C1B]"><Store size={15}/> Quản lý bán hàng</Link>
    <Link href="/admin/registration-codes" className="btn-push-primary inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black"><KeyRound size={15}/> Cấp tài khoản</Link>
  </nav>;
}
