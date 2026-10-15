'use client';
import Link from 'next/link';
import { KeyRound, Store } from 'lucide-react';
import { useAuth } from '@/app/contexts/AuthContext';

export default function AdminTabs() {
  const { user, isLoading } = useAuth();

  if (isLoading || user?.role !== 'admin') return null;

  return <nav className="flex flex-wrap gap-2" aria-label="Điều hướng quản trị">
    <Link href="/business" className="btn-push inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black text-[#585556]"><Store size={15}/> Quản lý bán hàng</Link>
    <Link href="/admin/registration-codes" className="btn-push-primary inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black"><KeyRound size={15}/> Cấp tài khoản</Link>
  </nav>;
}
