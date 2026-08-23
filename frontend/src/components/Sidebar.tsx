'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Library, LayoutDashboard, Bookmark, User, LogOut, Settings, Menu, X, LogIn, Loader2, KeyRound } from 'lucide-react';
import { useAuth } from '@/app/contexts/AuthContext';

export default function Sidebar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const { user, logout } = useAuth();
  
  useEffect(() => {
    setNavigatingTo(null);
  }, [pathname]);

  const menuItems = [
    { icon: <LayoutDashboard size={20} />, label: 'My BookCase Board', href: '/' },
    { icon: <Library size={20} />, label: 'Collections', href: '#' },
    { icon: <Bookmark size={20} />, label: 'Sách Cá Nhân', href: '/my-books' },
  ];

  if (user?.role === 'admin') {
    menuItems.splice(1, 1, { icon: <Library size={20} />, label: 'Collections', href: '/admin/collections' });
    menuItems.push({ icon: <KeyRound size={20} />, label: 'Mã Đăng Ký', href: '/admin/registration-codes' });
    menuItems.push({ icon: <Settings size={20} />, label: 'Admin Dashboard', href: '/admin' });
  }

  return (
    <>
      <div className="w-full h-16 fixed left-0 top-0 flex flex-row items-center justify-between bg-[#1F1D20]/90 backdrop-blur-md border-b border-[#4D4845]/40 px-4 z-50 md:w-64 md:h-screen md:flex-col md:justify-start md:border-r md:border-b-0 md:p-6 md:bg-[#181618]">
        {/* Logo */}
        <div className="flex items-center md:mb-10 flex-shrink-0 z-50">
          <Link href="/">
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#F5ECDC] cursor-pointer hover:opacity-80 transition-opacity">
              BOOKCASE<span className="text-[#F5ECDC]">.</span>
            </h1>
          </Link>
        </div>

        {/* User Profile Card - Hide on Mobile */}
        {user ? (
          <div className="hidden md:block bg-[#2A272A] p-5 rounded-2xl mb-10 shadow-md border border-[#4D4845]/40 w-full">
            <div className="w-12 h-12 bg-[#4D4845] rounded-full flex items-center justify-center mb-3 shadow-inner overflow-hidden border border-[#7B7369]/40">
               <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} alt="Avatar" className="w-full h-full object-cover" />
            </div>
            <p className="text-xs text-[#D7C9B2] font-medium mb-0.5">Welcome Back</p>
            <p className="text-lg font-bold text-[#F5ECDC] truncate">{user.username}</p>
          </div>
        ) : (
          <div className="hidden md:block mb-10 w-full">
            <Link href="/login" className="btn-primary w-full flex items-center justify-center gap-2">
              <LogIn size={18} />
              <span>Login</span>
            </Link>
          </div>
        )}

        {/* Mobile Hamburger Button */}
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden p-2 text-[#D7C9B2] hover:text-[#F5ECDC] rounded-lg hover:bg-[#2A272A] transition-colors z-50"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        {/* Navigation */}
        <nav className={`absolute md:static top-16 left-0 w-full md:w-full bg-[#181618] md:bg-transparent border-b md:border-0 border-[#4D4845]/40 shadow-xl md:shadow-none transition-all duration-300 origin-top flex-1 md:flex justify-start ${isMobileMenuOpen ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0 md:scale-y-100 md:opacity-100'} overflow-hidden md:overflow-visible`}>
          <ul className="flex flex-col p-4 md:p-0 md:space-y-2 md:w-full w-full gap-2 md:gap-0">
            {menuItems.map((item, index) => {
              const isActive = item.href === '/admin' 
                ? pathname === '/admin' 
                : (item.href === pathname || (item.href !== '/' && item.href !== '#' && pathname.startsWith(item.href)));
              return (
                <li key={index} className="w-full">
                  <Link 
                    href={item.href} 
                    className={`flex items-center justify-start gap-4 p-3 md:px-4 md:py-3 rounded-xl transition-all font-extrabold text-sm w-full ${
                      isActive 
                        ? 'bg-[#F5ECDC] text-black shadow-md' 
                        : 'text-[#D7C9B2] hover:text-[#F5ECDC] hover:bg-[#2A272A]'
                    }`}
                    title={item.label}
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      if (item.href !== pathname && item.href !== '#') {
                        setNavigatingTo(item.href);
                      }
                    }}
                  >
                    <span>{navigatingTo === item.href ? <Loader2 size={20} className="animate-spin" /> : item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
            
            {/* Mobile User Info & Logout/Login (inside menu) */}
            <li className="md:hidden mt-4 pt-4 border-t border-[#4D4845]/40 w-full">
               {user ? (
                 <>
                   <div className="flex items-center gap-3 mb-4 px-2">
                     <div className="w-10 h-10 bg-[#4D4845] rounded-full flex items-center justify-center shadow-inner overflow-hidden border border-[#7B7369]/40">
                       <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} alt="Avatar" className="w-full h-full object-cover" />
                     </div>
                     <div>
                       <p className="text-xs text-[#D7C9B2] font-medium leading-tight">Welcome Back</p>
                       <p className="text-sm font-bold text-[#F5ECDC] leading-tight truncate max-w-[200px]">{user.username}</p>
                     </div>
                   </div>
                   <button onClick={logout} className="flex items-center gap-4 p-3 text-red-400 hover:bg-red-950/30 rounded-xl transition-colors font-medium text-sm w-full">
                     <LogOut size={20} />
                     <span>Logout</span>
                   </button>
                 </>
               ) : (
                 <Link href="/login" className="flex items-center gap-4 p-3 text-[#F5ECDC] hover:bg-[#2A272A] rounded-xl transition-colors font-medium text-sm w-full">
                   <LogIn size={20} />
                   <span>Login</span>
                 </Link>
               )}
            </li>
          </ul>
        </nav>

        {/* Logout - Desktop */}
        {user && (
          <div className="hidden md:flex mt-auto pt-6 border-t border-[#4D4845]/40 w-full">
            <button onClick={logout} className="flex items-center gap-4 px-4 py-2 text-[#D7C9B2] hover:text-red-400 transition-colors font-medium text-sm w-full">
              <LogOut size={20} />
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>
      
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden top-16" 
          onClick={() => setIsMobileMenuOpen(false)} 
        />
      )}
    </>
  );
}
