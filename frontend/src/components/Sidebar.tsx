'use client';
import { usePathname } from 'next/navigation';
import { Library, LayoutDashboard, Bookmark, User, LogOut, Settings } from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();

  const menuItems = [
    { icon: <LayoutDashboard size={20} />, label: 'My Kindle Board', href: '/' },
    { icon: <Library size={20} />, label: 'Collections', href: '#' },
    { icon: <Bookmark size={20} />, label: 'Saved', href: '#' },
    { icon: <Settings size={20} />, label: 'Admin Dashboard', href: '/admin' },
  ];

  return (
    <div className="w-full h-16 fixed left-0 top-0 flex flex-row items-center justify-between bg-[#f8f7f4]/90 backdrop-blur-md border-b border-gray-200 px-4 z-50 md:w-64 md:h-screen md:flex-col md:justify-start md:border-r md:border-b-0 md:p-6 md:bg-[#f8f7f4]">
      {/* Logo */}
      <div className="flex items-center md:mb-10 flex-shrink-0">
        <h1 className="text-2xl md:text-3xl font-extrabold text-black">
          Kindle<span className="text-orange-500">.</span>
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

      {/* Navigation */}
      <nav className="flex-1 flex justify-end md:justify-start md:w-full overflow-x-auto no-scrollbar ml-4 md:ml-0">
        <ul className="flex flex-row items-center gap-1 md:flex-col md:space-y-2 md:w-full">
          {menuItems.map((item, index) => {
            const isActive = item.href === pathname || (item.href !== '/' && item.href !== '#' && pathname.startsWith(item.href));
            return (
              <li key={index} className="flex-shrink-0">
                <a 
                  href={item.href} 
                  className={`flex items-center justify-center md:justify-start gap-4 p-2 md:px-4 md:py-3 rounded-xl transition-colors font-medium text-sm ${
                    isActive 
                      ? 'bg-white text-orange-500 shadow-sm' 
                      : 'text-gray-500 hover:text-black hover:bg-white/50'
                  }`}
                  title={item.label}
                >
                  <span className="scale-110 md:scale-100">{item.icon}</span>
                  <span className="hidden md:block">{item.label}</span>
                </a>
              </li>
            );
          })}
          {/* Logout on Mobile */}
          <li className="flex-shrink-0 md:hidden ml-1">
             <a href="#" className="flex items-center justify-center p-2 text-gray-400 hover:text-red-500 rounded-xl hover:bg-white/50 transition-colors">
               <LogOut size={22} />
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
  );
}
