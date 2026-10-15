'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { BarChart3, Boxes, PackageOpen, Plus, ReceiptText, ShoppingCart, Store, X } from 'lucide-react';

const navItems = [
  { href: '/business/pos', label: 'Bán tại quầy', icon: Store },
  { href: '/business/products', label: 'Món bán POS', icon: PackageOpen },
  { href: '/business/inventory', label: 'Nhập và tồn kho', icon: Boxes },
  { href: '/business/reports', label: 'Thống kê', icon: BarChart3 },
];

export default function BusinessBottomNav() {
  const pathname = usePathname();
  const [quickOpen, setQuickOpen] = useState(false);
  const left = navItems.slice(0, 2);
  const right = navItems.slice(2);

  const item = ({ href, label, icon: Icon }: (typeof navItems)[number]) => {
    const active = pathname === href;
    return (
      <Link
        key={href}
        href={href}
        aria-label={label}
        title={label}
        aria-current={active ? 'page' : undefined}
        onClick={() => setQuickOpen(false)}
        className="relative z-10 flex h-full min-w-0 items-center justify-center"
      >
        <span className={`flex h-11 w-11 items-center justify-center border-2 border-transparent transition-all ${active ? 'pixel-active' : 'text-[#171513]'}`}>
          <Icon size={23} strokeWidth={2.4} />
        </span>
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
                className="absolute bottom-[calc(100%+18px)] left-1/2 flex -translate-x-1/2 gap-3"
              >
                <Link
                  href="/business/orders#new-order"
                  aria-label="Tạo đơn hàng từ hàng tồn"
                  title="Tạo đơn hàng từ hàng tồn"
                  className="quick-create-option btn-push-primary flex h-14 w-14 items-center justify-center"
                  onClick={() => setQuickOpen(false)}
                >
                  <ReceiptText size={25} />
                </Link>
                <Link
                  href="/business/pos"
                  aria-label="Bán tại quầy"
                  title="Bán tại quầy"
                  className="quick-create-option btn-push-primary flex h-14 w-14 items-center justify-center"
                  onClick={() => setQuickOpen(false)}
                >
                  <ShoppingCart size={25} />
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
          <motion.button
            type="button"
            aria-label={quickOpen ? 'Đóng lựa chọn tạo đơn' : 'Mở lựa chọn tạo đơn'}
            title={quickOpen ? 'Đóng' : 'Tạo đơn mới'}
            aria-expanded={quickOpen}
            animate={quickOpen ? { y: 16, scale: 0.86 } : { y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 420, damping: 27 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => setQuickOpen((open) => !open)}
            className="btn-push absolute -top-8 flex h-[62px] w-[62px] items-center justify-center bg-white"
          >
            {quickOpen ? <X size={27} /> : <Plus size={29} strokeWidth={3} />}
          </motion.button>
        </div>
        {right.map(item)}
      </nav>
    </>
  );
}
