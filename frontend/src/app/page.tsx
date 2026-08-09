'use client';
import { useState, useEffect } from 'react';
import axios from 'axios';
import Bookshelf from '@/components/Bookshelf';
import Sidebar from '@/components/Sidebar';
import { Search, Bell } from 'lucide-react';

export default function Home() {
  const [books, setBooks] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchBooks = async () => {
    try {
      const response = await axios.get('http://localhost:8000/api/books');
      setBooks(response.data);
    } catch (error) {
      console.error('Lỗi lấy dữ liệu sách:', error);
    }
  };

  useEffect(() => {
    fetchBooks();
  }, []);

  const filteredBooks = books.filter((book: any) => 
    book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (book.author && book.author.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex bg-[#f8f7f4] min-h-screen font-sans selection:bg-orange-200">
      
      {/* Sidebar - Fixed Left */}
      <Sidebar />

      {/* Main Content Area - Shifted Right */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        
        {/* Topbar */}
        <header className="sticky top-0 z-30 bg-[#f8f7f4]/80 backdrop-blur-md px-10 py-6 flex justify-between items-center">
          
          {/* Menu links on topbar */}
          <div className="flex items-center gap-8 text-sm font-bold text-gray-400">
             <a href="#" className="text-black border-b-2 border-black pb-1">New Release</a>
             <a href="#" className="hover:text-black transition-colors pb-1">Featured</a>
          </div>

          {/* Search & Actions */}
          <div className="flex items-center gap-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Search your books"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-72 bg-white rounded-full py-2.5 pl-12 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/50 shadow-sm transition-all text-black placeholder-gray-400"
              />
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 px-10 pt-4 pb-12">
          {books.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center bg-white rounded-3xl shadow-sm border border-gray-100">
              <p className="text-gray-500 font-medium mb-4">Bookshelf is currently empty.</p>
            </div>
          ) : (
            <Bookshelf books={filteredBooks} refresh={fetchBooks} />
          )}
        </main>

      </div>
    </div>
  );
}
