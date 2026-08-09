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
    <div className="w-64 h-screen fixed left-0 top-0 flex flex-col bg-[#f8f7f4] border-r border-gray-200 p-6 z-10">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-10">
        <h1 className="text-3xl font-extrabold text-black">
          Kindle<span className="text-orange-500">.</span>
        </h1>
      </div>

      {/* User Profile Card */}
      <div className="bg-gradient-to-br from-[#e8e4db] to-[#dcd8ce] p-5 rounded-2xl mb-10 shadow-sm">
        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-3 shadow-sm overflow-hidden">
           <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah" alt="Avatar" className="w-full h-full object-cover" />
        </div>
        <p className="text-xs text-gray-500 font-medium mb-1">Welcome Back</p>
        <p className="text-lg font-bold text-black">Sarah</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1">
        <ul className="space-y-2">
          {menuItems.map((item, index) => {
            const isActive = item.href === pathname || (item.href !== '/' && item.href !== '#' && pathname.startsWith(item.href));
            return (
              <li key={index}>
                <a 
                  href={item.href} 
                  className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-colors font-medium text-sm ${
                    isActive 
                      ? 'bg-white text-orange-500 shadow-sm' 
                      : 'text-gray-500 hover:text-black hover:bg-white/50'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Logout */}
      <div className="mt-auto pt-6 border-t border-gray-200">
        <a href="#" className="flex items-center gap-4 px-4 py-2 text-gray-500 hover:text-red-500 transition-colors font-medium text-sm">
          <LogOut size={20} />
          <span>Logout</span>
        </a>
      </div>
    </div>
  );
}
