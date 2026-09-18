'use client';
import { useState, useEffect } from 'react';
import axios from 'axios';
import Sidebar from '@/components/Sidebar';
import AdminTabs from '@/components/AdminTabs';
import { Plus, Edit2, Trash2, Library, FolderOpen, Link as LinkIcon, X, Check } from 'lucide-react';
import { getCoverUrl } from '@/utils/image';
import BookCoverImage from '@/components/BookCoverImage';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';

interface Collection {
  id: string;
  name: string;
  description: string;
  created_at: string;
  book_count: number;
}

export default function AdminCollectionsPage() {
  const { user, token: authToken, logout, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthLoading && (!user || user.role !== 'admin')) {
      router.push('/');
    }
  }, [user, isAuthLoading, router]);

  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Create/Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Manage Books Modal
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [activeCollection, setActiveCollection] = useState<any>(null);
  const [allBooks, setAllBooks] = useState<any[]>([]);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;

  useEffect(() => {
    if (!isAuthLoading && user?.role === 'admin') {
      fetchCollections();
      fetchAllBooks();
    }
  }, [isAuthLoading, user]);

  const getHeaders = () => {
    const token = authToken || localStorage.getItem('access_token') || localStorage.getItem('token');
    return { Authorization: `Bearer ${token}` };
  };

  const fetchCollections = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${baseUrl}/api/collections`, {
        headers: getHeaders()
      });
      setCollections(res.data);
    } catch (error: any) {
      console.error(error);
      if (error.response?.status === 401) {
        logout();
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchAllBooks = async () => {
    try {
      const res = await axios.get(`${baseUrl}/api/books`);
      setAllBooks(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const openCreateModal = () => {
    setEditingCollection(null);
    setName('');
    setDescription('');
    setIsModalOpen(true);
  };

  const openEditModal = (c: Collection) => {
    setEditingCollection(c);
    setName(c.name);
    setDescription(c.description || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const headers = getHeaders();
      const payload = { name, description };
      
      if (editingCollection) {
        await axios.put(`${baseUrl}/api/collections/${editingCollection.id}`, payload, { headers });
      } else {
        await axios.post(`${baseUrl}/api/collections`, payload, { headers });
      }
      setIsModalOpen(false);
      fetchCollections();
    } catch (err: any) {
      console.error(err);
      if (err.response?.status === 401) {
        logout();
      } else {
        const msg = err.response?.data?.detail || "Đã có lỗi xảy ra khi lưu";
        setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
        setTimeout(() => setError(null), 3000);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa Tệp Sách này?')) return;
    try {
      await axios.delete(`${baseUrl}/api/collections/${id}`, {
        headers: getHeaders()
      });
      fetchCollections();
    } catch (err: any) {
      if (err.response?.status === 401) {
        logout();
      } else {
        setError("Lỗi khi xóa");
        setTimeout(() => setError(null), 3000);
      }
    }
  };

  const copyShareLink = (id: string) => {
    const url = `${window.location.origin}/share/collection/${id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openManageModal = async (collectionId: string) => {
    try {
      const res = await axios.get(`${baseUrl}/api/collections/${collectionId}`, {
        headers: getHeaders()
      });
      setActiveCollection(res.data);
      setIsManageModalOpen(true);
    } catch (err: any) {
      if (err.response?.status === 401) {
        logout();
      } else {
        setError("Lỗi khi tải chi tiết tệp");
        setTimeout(() => setError(null), 3000);
      }
    }
  };

  const toggleBookInCollection = async (bookId: string) => {
    if (!activeCollection) return;
    
    const isCurrentlyAdded = activeCollection.books.some((b: any) => b.id === bookId);
    const bookObj = allBooks.find(b => b.id === bookId);
    
    // Cập nhật giao diện lập tức (Optimistic Update)
    setActiveCollection((prev: any) => {
      if (!prev) return prev;
      const isAdded = prev.books.some((b: any) => b.id === bookId);
      if (isAdded) {
        return { ...prev, books: prev.books.filter((b: any) => b.id !== bookId) };
      } else {
        return { ...prev, books: [...prev.books, bookObj] };
      }
    });
    
    try {
      const headers = getHeaders();
      
      if (isCurrentlyAdded) {
        await axios.delete(`${baseUrl}/api/collections/${activeCollection.id}/books/${bookId}`, { headers });
      } else {
        await axios.post(`${baseUrl}/api/collections/${activeCollection.id}/books/${bookId}`, {}, { headers });
      }
      
      fetchCollections();
    } catch (err: any) {
      setActiveCollection((prev: any) => {
        if (!prev) return prev;
        if (isCurrentlyAdded) {
          return { ...prev, books: [...prev.books, bookObj] };
        } else {
          return { ...prev, books: prev.books.filter((b: any) => b.id !== bookId) };
        }
      });
      
      if (err.response?.status === 401) {
        logout();
      } else {
        setError("Lỗi thao tác");
        setTimeout(() => setError(null), 3000);
      }
    }
  };

  if (isAuthLoading || !user || user.role !== 'admin') {
    return <div className="min-h-screen bg-[#D8C9BB] flex items-center justify-center font-bold text-[#7A6F68]">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[#D8C9BB] text-[#2A2320] pt-[70px] pb-4 px-3 sm:p-5 md:p-6 lg:p-7 flex flex-col md:flex-row gap-4 sm:gap-5 font-sans selection:bg-[#E5DACD]">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col gap-4 sm:gap-5">
        {/* Top Header Card (Phần Header) */}
        <header className="bg-[#FBF8F4] rounded-[28px] md:rounded-[36px] p-4 sm:p-6 shadow-[0_12px_32px_rgba(120,100,85,0.1)] border border-[#EFE8DE] flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 w-full">
            <div>
              <div className="flex items-center gap-2.5 text-xl md:text-2xl font-black text-[#1C1917]">
                <Library size={22} className="text-[#1B2A4A]" />
                <span>Quản Lý Tệp Sách (Collections)</span>
              </div>
              <p className="text-xs text-[#57534E] font-medium mt-0.5">Tạo các bộ sưu tập chủ đề và chia sẻ nhóm sách</p>
            </div>
            <AdminTabs />
          </div>

          <div className="flex justify-end pt-3 border-t border-[#EFE8DE]">
            <button 
              onClick={openCreateModal}
              className="btn-gradient text-white rounded-full py-2 px-5 shadow-md flex items-center gap-1.5 font-bold text-xs hover:opacity-95 transition-all cursor-pointer border-none"
            >
              <Plus size={16} className="text-white stroke-[3]" /> <span>Tạo Tệp Mới</span>
            </button>
          </div>
        </header>

        {/* Main Content Card (Phần Trang Chính) */}
        <main className="flex-1 min-w-0 bg-[#FBF8F4] rounded-[28px] md:rounded-[36px] p-4 sm:p-6 md:p-8 shadow-[0_16px_40px_rgba(120,100,85,0.12)] border border-[#EFE8DE] flex flex-col">
          {/* Content */}
          <section className="flex-1">
          {error && (
            <div className="text-center bg-red-50 border border-red-200 text-red-600 p-4 rounded-2xl text-xs font-bold mb-6">
              {error}
            </div>
          )}
          {loading ? (
            <div className="flex justify-center mt-20">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#1B2A4A] border-t-transparent"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {collections.map(c => (
                <div key={c.id} className="bg-[#FAF6F0] rounded-3xl p-6 shadow-sm border border-[#ECE2D5] flex flex-col hover:border-[#1B2A4A] transition-all">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-bold text-[#1C1917]">{c.name}</h3>
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={() => copyShareLink(c.id)} className="p-2 text-[#57534E] hover:text-[#1C1917] hover:bg-white rounded-full transition-colors cursor-pointer border border-[#ECE2D5]" title="Copy Share Link">
                        {copiedId === c.id ? <Check size={16} className="text-emerald-600" /> : <LinkIcon size={16} />}
                      </button>
                      <button onClick={() => openEditModal(c)} className="p-2 text-[#57534E] hover:text-[#1C1917] hover:bg-white rounded-full transition-colors cursor-pointer border border-[#ECE2D5]">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(c.id)} className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors cursor-pointer border border-red-200">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <p className="text-[#57534E] text-xs mb-4 line-clamp-2 min-h-[36px] font-medium">
                    {c.description || 'Không có mô tả'}
                  </p>
                  
                  <div className="mt-auto pt-4 border-t border-[#EFE8DE] flex justify-between items-center">
                    <span className="text-xs font-bold text-[#57534E]">{c.book_count} cuốn sách</span>
                    <button 
                      onClick={() => openManageModal(c.id)}
                      className="text-xs font-bold px-4 py-2 rounded-full text-white btn-gradient shadow-sm hover:opacity-95 transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 border-none"
                    >
                      <span>Quản lý sách</span>
                    </button>
                  </div>
                </div>
              ))}
              
              {collections.length === 0 && (
                <div className="col-span-full text-center py-20 bg-[#FAF6F0] rounded-3xl border border-dashed border-[#D8C9BB]">
                  <Library size={48} className="text-[#A0958C] mx-auto mb-4" />
                  <p className="text-xs text-[#7A6F68] font-bold">Chưa có Tệp sách nào.</p>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
      </div>

      {/* Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
           <div className="bg-[#FBF8F4] text-[#1C1917] border border-[#ECE2D5] rounded-[36px] w-full max-w-md p-8 shadow-2xl relative">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-6 right-6 p-2 bg-[#EFE8DE] hover:bg-[#E5DACD] rounded-full text-[#57534E] hover:text-[#1C1917] transition-colors border border-[#ECE2D5] cursor-pointer"><X size={16}/></button>
              <h2 className="text-xl font-black text-[#1C1917] mb-6">{editingCollection ? 'Sửa Tệp Sách' : 'Tạo Tệp Sách Mới'}</h2>
              <form onSubmit={handleSave} className="flex flex-col gap-4">
                 <div>
                   <label className="block text-xs font-bold text-[#57534E] mb-2">Tên Tệp</label>
                   <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full bg-[#FAF6F0] border border-[#E5DACD] text-[#1C1917] text-xs rounded-xl focus:border-[#1B2A4A] block p-3.5 outline-none transition-all placeholder-[#57534E]" placeholder="Nhập tên tệp..." />
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-[#57534E] mb-2">Mô tả (Tùy chọn)</label>
                   <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-[#FAF6F0] border border-[#E5DACD] text-[#1C1917] text-xs rounded-xl focus:border-[#1B2A4A] block p-3.5 outline-none transition-all h-24 placeholder-[#57534E]" placeholder="Nhập mô tả..." />
                 </div>
                 <button type="submit" className="w-full btn-gradient text-white rounded-full py-3 text-xs font-black shadow-md cursor-pointer border-none mt-2 hover:opacity-95">
                   {editingCollection ? 'Lưu Thay Đổi' : 'Tạo Tệp Sách'}
                 </button>
              </form>
           </div>
        </div>
      )}

      {/* Manage Books Modal */}
      {isManageModalOpen && activeCollection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
           <div className="bg-[#FBF8F4] text-[#1C1917] border border-[#ECE2D5] rounded-[36px] w-full max-w-4xl p-6 md:p-8 shadow-2xl relative h-[90vh] flex flex-col">
              <button onClick={() => setIsManageModalOpen(false)} className="absolute top-6 right-6 p-2 bg-[#EFE8DE] hover:bg-[#E5DACD] rounded-full text-[#57534E] hover:text-[#1C1917] transition-colors border border-[#ECE2D5] z-10 cursor-pointer"><X size={16}/></button>
              <h2 className="text-xl md:text-2xl font-black text-[#1C1917] mb-1 pr-10">Thêm sách vào: {activeCollection.name}</h2>
              <p className="text-[#57534E] mb-6 text-xs font-medium">Bấm vào sách để thêm hoặc xóa khỏi tệp.</p>
              
              <div className="flex-1 overflow-y-auto pr-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {allBooks.map(book => {
                    const isAdded = activeCollection.books.some((b: any) => b.id === book.id);
                    return (
                      <div 
                        key={book.id} 
                        onClick={() => toggleBookInCollection(book.id)}
                        className={`cursor-pointer group relative rounded-2xl overflow-hidden border-2 transition-all duration-300 ${isAdded ? 'border-[#1B2A4A] shadow-md ring-2 ring-[#1B2A4A]/30' : 'border-[#ECE2D5] hover:border-[#D8C9BB]'}`}
                      >
                         <div className="w-full aspect-[2/3] relative">
                            <BookCoverImage 
                              coverUrl={book.cover_url}
                              bookId={book.id}
                              title={book.title}
                              author={book.author}
                              className={`w-full h-full object-cover transition-all ${isAdded ? 'brightness-105' : 'brightness-90 group-hover:brightness-100'}`}
                            />
                           
                            {/* Checkmark overlay */}
                            {isAdded && (
                              <div className="absolute inset-0 bg-[#1B2A4A]/20 flex items-center justify-center">
                                <div className="btn-gradient text-white rounded-full p-2 shadow-lg">
                                  <Check size={20} strokeWidth={3} />
                                </div>
                              </div>
                            )}
                         </div>
                         <div className="p-2.5 bg-white border-t border-[#ECE2D5]">
                           <h3 className="text-xs font-bold text-[#1C1917] line-clamp-1">{book.title}</h3>
                         </div>
                      </div>
                    )
                  })}
                </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
