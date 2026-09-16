'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, 
  BookOpen, 
  Clock, 
  Bookmark, 
  Settings, 
  AlignLeft, 
  X, 
  LogOut, 
  LogIn, 
  Loader2, 
  Sparkles,
  Quote as QuoteIcon,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '@/app/contexts/AuthContext';

export default function Sidebar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const { user, logout } = useAuth();
  
  useEffect(() => {
    setNavigatingTo(null);
  }, [pathname]);

  const navItems = [
    { id: 'home', icon: Home, label: 'Trang chủ', href: '/' },
    { id: 'reader', icon: BookOpen, label: 'Không gian đọc', href: '/reader' },
    { id: 'timer', icon: Clock, label: 'Ghi chú & Trích dẫn', href: '/quotes' },
    { id: 'bookmark', icon: Bookmark, label: 'Sách cá nhân', href: '/my-books' },
    ...(user?.role === 'admin' 
      ? [{ id: 'admin', icon: Settings, label: 'Quản trị hệ thống', href: '/admin' }]
      : [{ id: 'settings', icon: Settings, label: 'Cài đặt', href: '/my-books' }])
  ];

  const isItemActive = (href: string) => {
    if (href === '/') return pathname === '/';
    if (href === '/admin') return pathname === '/admin' || pathname.startsWith('/admin/');
    return pathname === href || (href !== '/' && pathname.startsWith(href));
  };

  return (
    <>
      {/* Desktop Vertical Navigation Rail (Slim ~76px) */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-20 flex-col items-center justify-between py-7 bg-[#FAF7F2] border-r border-[#E5DFD7]/80 z-40 select-none shadow-[2px_0_12px_rgba(0,0,0,0.02)]">
        {/* Brand Icon (Stylized Book Wave Logo) */}
        <Link 
          href="/" 
          className="w-11 h-11 flex items-center justify-center text-[#1D1C1A] hover:scale-105 transition-transform"
          title="BookCase - Thư viện cá nhân"
        >
          <svg width="30" height="30" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="stroke-[#1D1C1A] stroke-[2.2] stroke-linecap-round stroke-linejoin-round">
            <path d="M7 17C8.5 14 11 12 14 14C17 16 19.5 14 21 11" />
            <path d="M6 21C8 18 11 16 14 18C17 20 20 18 22 15" />
            <path d="M12 5C10 5 8 7 8 10V25C8 26.1 8.9 27 10 27H23C24.1 27 25 26.1 25 25V10C25 7 23 5 21 5H12Z" />
          </svg>
        </Link>

        {/* Center Nav Icons */}
        <nav className="flex flex-col items-center gap-4 my-auto">
          {navItems.map((item) => {
            const active = isItemActive(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => {
                  if (item.href !== pathname) setNavigatingTo(item.href);
                }}
                className={`relative group w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 ${
                  active 
                    ? 'bg-[#DE5448] text-white shadow-md shadow-[#DE5448]/30 scale-105' 
                    : 'text-[#66615E] hover:text-[#1D1C1A] hover:bg-[#EFEAE4]'
                }`}
                title={item.label}
              >
                {navigatingTo === item.href ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Icon size={20} className={active ? 'stroke-[2.5]' : 'stroke-[1.8]'} />
                )}

                {/* Subtle Hover Tooltip */}
                <div className="absolute left-14 px-2.5 py-1 bg-[#1D1C1A] text-white text-[11px] font-bold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg z-50">
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Menu / Collapse & Logout Button */}
        <div className="flex flex-col items-center gap-3">
          {user && (
            <button
              onClick={logout}
              className="w-10 h-10 rounded-full flex items-center justify-center text-[#9E9791] hover:text-[#DE5448] hover:bg-[#EFEAE4] transition-colors cursor-pointer"
              title="Đăng xuất"
            >
              <LogOut size={18} />
            </button>
          )}

          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center text-[#66615E] hover:bg-[#EFEAE4] transition-colors cursor-pointer"
            title="Tùy chọn menu"
          >
            <AlignLeft size={20} />
          </div>
        </div>
      </aside>

      {/* Mobile Topbar & Slide Menu */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-[#FAF7F2]/95 backdrop-blur-md border-b border-[#E5DFD7] px-4 flex items-center justify-between z-50">
        <Link href="/" className="flex items-center gap-2">
          <span className="font-extrabold text-lg text-[#1D1C1A] tracking-tight">BOOKCASE.</span>
        </Link>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-[#1D1C1A] hover:bg-[#EFEAE4] rounded-lg transition-colors"
        >
          {isMobileMenuOpen ? <X size={22} /> : <AlignLeft size={22} />}
        </button>
      </div>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm pt-14" onClick={() => setIsMobileMenuOpen(false)}>
          <div 
            className="bg-[#FAF7F2] w-64 h-full p-6 flex flex-col justify-between border-r border-[#E5DFD7]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-4">
              <div className="text-xs font-bold uppercase tracking-wider text-[#9E9791] mb-2">Menu</div>
              <div className="flex flex-col gap-1.5">
                {navItems.map((item) => {
                  const active = isItemActive(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                        active 
                          ? 'bg-[#DE5448] text-white shadow-sm' 
                          : 'text-[#66615E] hover:text-[#1D1C1A] hover:bg-[#EFEAE4]'
                      }`}
                    >
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {user ? (
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  logout();
                }}
                className="flex items-center gap-2 text-sm font-bold text-[#DE5448] p-2 hover:bg-[#DE5448]/10 rounded-xl transition-colors w-full"
              >
                <LogOut size={18} />
                <span>Đăng xuất ({user.username})</span>
              </button>
            ) : (
              <Link
                href="/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 bg-[#1D1C1A] text-white py-2.5 rounded-xl font-bold text-sm shadow"
              >
                <LogIn size={18} />
                <span>Đăng nhập</span>
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}

