'use client';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Library, LayoutDashboard, Bookmark, User, LogOut, Settings, Menu, X } from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const menuItems = [
    { icon: <LayoutDashboard size={20} />, label: 'My BookCase Board', href: '/' },
    { icon: <Library size={20} />, label: 'Collections', href: '#' },
    { icon: <Bookmark size={20} />, label: 'Saved', href: '#' },
    { icon: <Settings size={20} />, label: 'Admin Dashboard', href: '/admin' },
  ];

  return (
    <>
      <div className="w-full h-16 fixed left-0 top-0 flex flex-row items-center justify-between bg-[#f8f7f4]/90 backdrop-blur-md border-b border-gray-200 px-4 z-50 md:w-64 md:h-screen md:flex-col md:justify-start md:border-r md:border-b-0 md:p-6 md:bg-[#f8f7f4]">
        {/* Logo */}
        <div className="flex items-center md:mb-10 flex-shrink-0 z-50">
          <h1 className="text-2xl md:text-3xl font-extrabold text-black">
            BookCase<span className="text-orange-500">.</span>
          </h1>
        </div>

        {/* User Profile Card - Hide on Mobile */}
        <div className="hidden md:block bg-gradient-to-br from-[#e8e4db] to-[#dcd8ce] p-5 rounded-2xl mb-10 shadow-sm w-full">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-3 shadow-sm overflow-hidden">
             <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah" alt="Avatar" className="w-full h-full object-cover" />
          </div>
          <p className="text-xs text-gray-500 font-medium mb-1">Welcome Back</p>
          <p className="text-lg font-bold text-black">Sarah</p>
        </div>

        {/* Mobile Hamburger Button */}
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden p-2 text-gray-600 hover:text-black rounded-lg hover:bg-white/50 transition-colors z-50"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        {/* Navigation */}
        <nav className={`absolute md:static top-16 left-0 w-full md:w-full bg-[#f8f7f4] md:bg-transparent border-b md:border-0 border-gray-200 shadow-lg md:shadow-none transition-all duration-300 origin-top flex-1 md:flex justify-start ${isMobileMenuOpen ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0 md:scale-y-100 md:opacity-100'} overflow-hidden md:overflow-visible`}>
          <ul className="flex flex-col p-4 md:p-0 md:space-y-2 md:w-full w-full gap-2 md:gap-0">
            {menuItems.map((item, index) => {
              const isActive = item.href === pathname || (item.href !== '/' && item.href !== '#' && pathname.startsWith(item.href));
              return (
                <li key={index} className="w-full">
                  <a 
                    href={item.href} 
                    className={`flex items-center justify-start gap-4 p-3 md:px-4 md:py-3 rounded-xl transition-colors font-medium text-sm w-full ${
                      isActive 
                        ? 'bg-white text-orange-500 shadow-sm' 
                        : 'text-gray-500 hover:text-black hover:bg-white/50'
                    }`}
                    title={item.label}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </a>
                </li>
              );
            })}
            
            {/* Mobile User Info & Logout (inside menu) */}
            <li className="md:hidden mt-4 pt-4 border-t border-gray-200 w-full">
               <div className="flex items-center gap-3 mb-4 px-2">
                 <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm overflow-hidden">
                   <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah" alt="Avatar" className="w-full h-full object-cover" />
                 </div>
                 <div>
                   <p className="text-xs text-gray-500 font-medium leading-tight">Welcome Back</p>
                   <p className="text-sm font-bold text-black leading-tight">Sarah</p>
                 </div>
               </div>
               <a href="#" className="flex items-center gap-4 p-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors font-medium text-sm w-full">
                 <LogOut size={20} />
                 <span>Logout</span>
               </a>
            </li>
          </ul>
        </nav>

        {/* Logout - Desktop */}
        <div className="hidden md:flex mt-auto pt-6 border-t border-gray-200 w-full">
          <a href="#" className="flex items-center gap-4 px-4 py-2 text-gray-500 hover:text-red-500 transition-colors font-medium text-sm w-full">
            <LogOut size={20} />
            <span>Logout</span>
          </a>
        </div>
      </div>
      
      {/* Mobile Overlay (to close menu when clicking outside) */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden top-16" 
          onClick={() => setIsMobileMenuOpen(false)} 
        />
      )}
    </>
  );
}
