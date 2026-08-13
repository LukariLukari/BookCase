'use client';
import { useState, useEffect } from 'react';
import Bookshelf from '@/components/Bookshelf';
import Sidebar from '@/components/Sidebar';
import { Search } from 'lucide-react';
import { useAuth } from '@/app/contexts/AuthContext';
import { useRouter } from 'next/navigation';

import axios from 'axios';

export default function BooksClient({ initialBooks }: { initialBooks: any[] }) {
  const [books, setBooks] = useState<any[]>(initialBooks || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const refreshBooks = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/books`);
      if (res.data && Array.isArray(res.data)) {
        setBooks(res.data);
      }
    } catch (err) {
      console.error('Lỗi sync danh sách sách client:', err);
    }
  };

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
    if (user) {
      refreshBooks();
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return <div className="min-h-screen bg-[#f8f7f4] flex items-center justify-center font-bold text-gray-500">Đang tải...</div>;
  }

  let filteredBooks = books.filter((book: any) => 
    book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (book.author && book.author.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  filteredBooks = [...filteredBooks].sort((a: any, b: any) => {
    if (sortBy === 'a-z') return a.title.localeCompare(b.title);
    if (sortBy === 'z-a') return b.title.localeCompare(a.title);
    if (sortBy === 'author') return (a.author || '').localeCompare(b.author || '');
    return 0;
  });

  return (
    <div className="flex bg-[#f8f7f4] min-h-screen font-sans selection:bg-orange-200 overflow-x-hidden">
      
      {/* Sidebar - Fixed Left */}
      <Sidebar />

      {/* Main Content Area - Shifted Right */}
      <div className="flex-1 ml-0 md:ml-64 pt-16 md:pt-0 flex flex-col min-h-screen w-full max-w-full">
        
        {/* Topbar */}
        <header className="sticky top-16 md:top-0 z-30 bg-[#f8f7f4]/80 backdrop-blur-md px-4 py-4 md:px-10 md:py-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-0">
          
          {/* Menu links on topbar */}
          <div className="flex items-center gap-6 md:gap-8 text-base md:text-sm font-bold text-gray-400 overflow-x-auto w-full md:w-auto no-scrollbar">
             <a href="#" className="text-black border-b-2 border-black pb-1 whitespace-nowrap">New Release</a>
             <a href="#" className="hover:text-black transition-colors pb-1 whitespace-nowrap">Featured</a>
          </div>

          {/* Search & Actions */}
          <div className="flex flex-col md:flex-row items-center w-full md:w-auto gap-3">
            <div className="relative w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Search your books"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full md:w-72 bg-white rounded-full py-3.5 md:py-2.5 pl-12 pr-4 text-sm md:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/50 shadow-sm transition-all text-black placeholder-gray-400"
              />
            </div>
            
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full md:w-auto bg-white rounded-full py-3.5 md:py-2.5 px-5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/50 shadow-sm transition-all text-gray-700 border-none cursor-pointer appearance-none pr-10"
              style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23131313%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem top 50%', backgroundSize: '0.65rem auto' }}
            >
              <option value="newest">Sắp xếp: Mới nhất</option>
              <option value="a-z">Tên sách: A ➔ Z</option>
              <option value="z-a">Tên sách: Z ➔ A</option>
              <option value="author">Theo tác giả</option>
            </select>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 px-4 md:px-10 pt-4 pb-12">
          {books.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center bg-white rounded-3xl shadow-sm border border-gray-100">
              <p className="text-gray-500 font-medium mb-4">Bookshelf is currently empty.</p>
            </div>
          ) : (
            <Bookshelf books={filteredBooks} refresh={refreshBooks} sortBy={sortBy} />
          )}
        </main>

      </div>
    </div>
  );
}
