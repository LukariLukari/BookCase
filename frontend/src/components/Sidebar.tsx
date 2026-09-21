'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutGrid, 
  Sparkles, 
  Heart, 
  BookOpen, 
  Bookmark, 
  Settings, 
  Bell, 
  LogOut, 
  LogIn, 
  Loader2,
  Menu,
  X,
  WalletCards
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
    { 
      icon: <LayoutGrid size={20} />, 
      label: 'Kệ sách chính', 
      href: '/',
    },
    { 
      icon: <Sparkles size={20} />, 
      label: 'Không gian đọc', 
      href: '/reader',
    },
    { 
      icon: <Bookmark size={20} />, 
      label: 'Sách cá nhân', 
      href: '/my-books',
    },
    { 
      icon: <Heart size={20} />, 
      label: 'Trích dẫn hay', 
      href: '/quotes',
    },
    { 
      icon: <WalletCards size={20} />, 
      label: 'Thu chi shop', 
      href: '/business',
    },
  ];

  if (user?.role === 'admin') {
    navItems.push({
      icon: <Settings size={20} />,
      label: 'Admin Dashboard',
      href: '/admin',
    });
  }

  const isItemActive = (href: string) => {
    if (href === '/') return pathname === '/';
    if (href === '/admin') return pathname === '/admin' || pathname.startsWith('/admin/');
    return pathname === href || (href !== '/' && pathname.startsWith(href));
  };

  return (
    <>
      {/* DESKTOP FLOATING PILL DOCK */}
      <aside className="hidden md:flex flex-col items-center justify-between w-20 py-7 px-2.5 bg-[#FAF6F0] rounded-[36px] shadow-[0_16px_40px_rgba(120,100,85,0.14)] border border-[#ECE2D5] flex-shrink-0 self-start sticky top-6 h-[calc(100vh-48px)] z-40 transition-all">
        {/* Top: Avatar */}
        <div className="flex flex-col items-center gap-2">
          <Link href={user ? "/my-books" : "/login"} title={user ? user.username : "Đăng nhập"}>
            <div className="w-12 h-12 rounded-full bg-[#EFE8DE] p-0.5 border-2 border-[#E5DACD] shadow-sm hover:scale-105 transition-transform overflow-hidden cursor-pointer flex items-center justify-center">
              {user ? (
                <img 
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} 
                  alt={user.username} 
                  className="w-full h-full object-cover" 
                />
              ) : (
                <LogIn size={18} className="text-[#7A6F68]" />
              )}
            </div>
          </Link>
        </div>

        {/* Center: Navigation Squircle Icons */}
        <nav className="flex flex-col items-center gap-4 my-auto">
          {navItems.map((item) => {
            const active = isItemActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => {
                  if (item.href !== pathname) setNavigatingTo(item.href);
                }}
                title={item.label}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer relative group ${
                  active
                    ? 'bg-[#1B2A4A] text-white shadow-md scale-105 border border-[#1B2A4A]'
                    : 'bg-[#FAF6F0] hover:bg-[#EFE8DE] text-[#1C1917] hover:scale-105 shadow-sm border border-[#F0E7DC]'
                }`}
              >
                {navigatingTo === item.href ? (
                  <Loader2 size={20} className="animate-spin text-[#57534E]" />
                ) : (
                  item.icon
                )}

                {/* Tooltip on hover */}
                <span className="absolute left-16 px-3 py-1.5 bg-[#1C1917] text-[#FAF6F0] text-xs font-bold rounded-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-lg z-50">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom: Subscribe / Status Dark Pill */}
        <div className="flex flex-col items-center gap-3">
          {user && (
            <button
              onClick={logout}
              title="Đăng xuất"
              className="w-10 h-10 rounded-xl bg-[#EFE8DE] hover:bg-[#E5DACD] text-[#57534E] hover:text-[#1C1917] flex items-center justify-center transition-all cursor-pointer"
            >
              <LogOut size={16} />
            </button>
          )}

          <div 
            className="w-12 py-3 bg-[#1B2A4A] text-white rounded-2xl flex flex-col items-center justify-center gap-1 shadow-md cursor-pointer hover:bg-[#131E33] transition-colors"
            title="BookCase Library"
          >
            <Bell size={15} className="text-white" />
            <span className="text-[9px] font-black tracking-tighter uppercase [writing-mode:vertical-lr] rotate-180 opacity-90 mt-1">
              BookCase
            </span>
          </div>
        </div>
      </aside>

      {/* MOBILE TOP BAR & SLIDE-OUT MENU */}
      <header className="md:hidden fixed top-2 left-2 right-2 h-12 bg-[#FAF6F0]/95 backdrop-blur-md rounded-2xl border border-[#ECE2D5] px-3.5 flex items-center justify-between z-50 shadow-sm touch-none select-none">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#1B2A4A] flex items-center justify-center text-white shadow-sm">
            <BookOpen size={14} />
          </div>
          <span className="font-extrabold text-base text-[#1C1917] tracking-tight">BOOKCASE.</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-1.5 rounded-lg bg-[#EFE8DE] text-[#1C1917] transition-colors cursor-pointer"
          >
            {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      {/* MOBILE DROPDOWN MENU */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-x-2 top-[62px] bg-[#FAF6F0] border border-[#ECE2D5] rounded-2xl p-4 shadow-2xl z-50 space-y-3 animate-in fade-in slide-in-from-top-2">
          {user && (
            <div className="flex items-center gap-3 p-3 bg-[#EFE8DE] rounded-2xl mb-2">
              <img 
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} 
                alt="Avatar" 
                className="w-10 h-10 rounded-full bg-white p-0.5" 
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-[#57534E]">Xin chào,</p>
                <p className="text-sm font-bold text-[#1C1917] truncate">{user.username}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {navItems.map((item) => {
              const active = isItemActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-2.5 p-3 rounded-2xl font-bold text-xs transition-all ${
                    active ? 'bg-[#1B2A4A] text-white shadow-md' : 'bg-[#EFE8DE] text-[#1C1917]'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="pt-2 border-t border-[#EBE2D5] flex justify-between items-center text-xs">
            {user ? (
              <button 
                onClick={() => { logout(); setIsMobileMenuOpen(false); }} 
                className="text-[#1C1917] font-bold flex items-center gap-1.5 py-2 cursor-pointer"
              >
                <LogOut size={14} /> Đăng xuất
              </button>
            ) : (
              <Link 
                href="/login" 
                onClick={() => setIsMobileMenuOpen(false)} 
                className="text-[#1C1917] font-bold flex items-center gap-1.5 py-2"
              >
                <LogIn size={14} /> Đăng nhập
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
