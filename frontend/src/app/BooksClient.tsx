'use client';
import { useState } from 'react';
import Bookshelf from '@/components/Bookshelf';
import Sidebar from '@/components/Sidebar';
import { Search } from 'lucide-react';

export default function BooksClient({ initialBooks }: { initialBooks: any[] }) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredBooks = initialBooks.filter((book: any) => 
    book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (book.author && book.author.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex bg-[#f8f7f4] min-h-screen font-sans selection:bg-orange-200">
      
      {/* Sidebar - Fixed Left */}
      <Sidebar />

      {/* Main Content Area - Shifted Right */}
      <div className="flex-1 ml-0 md:ml-64 pt-16 md:pt-0 flex flex-col min-h-screen">
        
        {/* Topbar */}
        <header className="sticky top-16 md:top-0 z-30 bg-[#f8f7f4]/80 backdrop-blur-md px-4 py-4 md:px-10 md:py-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-0">
          
          {/* Menu links on topbar */}
          <div className="flex items-center gap-6 md:gap-8 text-base md:text-sm font-bold text-gray-400 overflow-x-auto w-full md:w-auto no-scrollbar">
             <a href="#" className="text-black border-b-2 border-black pb-1 whitespace-nowrap">New Release</a>
             <a href="#" className="hover:text-black transition-colors pb-1 whitespace-nowrap">Featured</a>
          </div>

          {/* Search & Actions */}
          <div className="flex items-center w-full md:w-auto">
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
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 px-4 md:px-10 pt-4 pb-12">
          {initialBooks.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center bg-white rounded-3xl shadow-sm border border-gray-100">
              <p className="text-gray-500 font-medium mb-4">Bookshelf is currently empty.</p>
            </div>
          ) : (
            <Bookshelf books={filteredBooks} refresh={() => {}} />
          )}
        </main>

      </div>
    </div>
  );
}
