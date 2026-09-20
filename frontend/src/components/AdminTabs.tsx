'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, FolderTree, KeyRound } from 'lucide-react';

export default function AdminTabs() {
  const pathname = usePathname();

  const tabs = [
    {
      name: 'Kho Sách',
      href: '/admin',
      icon: <BookOpen size={14} />,
      isActive: pathname === '/admin',
    },
    {
      name: 'Tệp Sách',
      href: '/admin/collections',
      icon: <FolderTree size={14} />,
      isActive: pathname.startsWith('/admin/collections'),
    },
    {
      name: 'Mã Đăng Ký',
      href: '/admin/registration-codes',
      icon: <KeyRound size={14} />,
      isActive: pathname.startsWith('/admin/registration-codes'),
    },
  ];

  return (
    <nav className="flex items-center gap-1.5 sm:gap-2 flex-wrap" aria-label="Admin Navigation Tabs">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border shadow-sm ${
            tab.isActive
              ? 'bg-[#1B2A4A] text-white border-[#1B2A4A] shadow-md'
              : 'bg-[#FAF6F0] hover:bg-[#EFE8DE] text-[#1C1917] border-[#E5DACD] hover:border-[#D8C9BB]'
          }`}
        >
          <span className={tab.isActive ? 'text-white' : 'text-[#1B2A4A]'}>
            {tab.icon}
          </span>
          <span className={tab.isActive ? 'text-white font-black' : 'text-[#1C1917]'}>
            {tab.name}
          </span>
        </Link>
      ))}
    </nav>
  );
}
