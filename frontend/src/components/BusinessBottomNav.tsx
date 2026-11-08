'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { BarChart3, Boxes, PackageOpen, Plus, Store, X } from 'lucide-react';
import QuickCreateOptions from './QuickCreateOptions';

const navItems = [
  { href: '/business/pos', label: 'Bán tại quầy', shortLabel: 'Tại quầy', icon: Store },
  { href: '/business/products', label: 'Món bán POS', shortLabel: 'Món bán', icon: PackageOpen },
  { href: '/business/inventory', label: 'Nhập và tồn kho', shortLabel: 'Tồn kho', icon: Boxes },
  { href: '/business/reports', label: 'Thống kê', shortLabel: 'Thống kê', icon: BarChart3 },
];

export default function BusinessBottomNav() {
  const pathname = usePathname();
  const [quickOpen, setQuickOpen] = useState(false);
  const left = navItems.slice(0, 2);
  const right = navItems.slice(2);

  const item = ({ href, label, shortLabel, icon: Icon }: (typeof navItems)[number]) => {
    const active = pathname === href;
    return (
      <Link
        key={href}
        href={href}
        aria-label={label}
        title={label}
        aria-current={active ? 'page' : undefined}
        onClick={() => setQuickOpen(false)}
        className="business-bottom-nav-link ui-flat-control relative z-10 flex h-full min-w-0 flex-col items-center justify-center gap-1 px-1"
      >
        <Icon size={20} strokeWidth={2.3} aria-hidden="true" />
        <span className="business-bottom-nav-label">{shortLabel}</span>
      </Link>
    );
  };

  return (
    <>
      {quickOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 cursor-default bg-transparent md:hidden"
          aria-label="Đóng lựa chọn tạo đơn"
          onClick={() => setQuickOpen(false)}
        />
      )}
      <nav
        aria-label="Điều hướng bán hàng"
        className="pixel-panel fixed left-1/2 z-50 grid h-[72px] w-[calc(100%_-_40px)] max-w-xl -translate-x-1/2 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_76px_minmax(0,1fr)_minmax(0,1fr)] items-center overflow-visible px-3 md:hidden"
        style={{ bottom: 'calc(16px + env(safe-area-inset-bottom))' }}
      >
        {left.map(item)}
        <div className="relative z-20 flex h-full items-center justify-center">
          <AnimatePresence>
            {quickOpen && (
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.85 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.85 }}
                transition={{ type: 'spring', stiffness: 340, damping: 24, mass: 0.72 }}
                className="absolute bottom-[calc(100%+18px)] left-1/2 flex -translate-x-1/2 gap-3"
              >
                <QuickCreateOptions close={() => setQuickOpen(false)} />
              </motion.div>
            )}
          </AnimatePresence>
          <motion.div
            animate={quickOpen ? { y: 21, scale: 0.7 } : { y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 22, mass: 0.75 }}
            className="absolute -top-8 h-[62px] w-[62px]"
          >
            <button
              type="button"
              aria-label={quickOpen ? 'Đóng lựa chọn tạo đơn' : 'Mở lựa chọn tạo đơn'}
              title={quickOpen ? 'Đóng' : 'Tạo đơn mới'}
              aria-expanded={quickOpen}
              onClick={() => setQuickOpen((open) => !open)}
              className="quick-create-toggle btn-push flex h-full w-full items-center justify-center bg-white"
            >
              {quickOpen ? <X size={27} /> : <Plus className="quick-create-plus" size={44} strokeWidth={3.5} />}
            </button>
          </motion.div>
        </div>
        {right.map(item)}
      </nav>
    </>
  );
}
