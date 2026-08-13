'use client';
import { useState, useEffect } from 'react';
import axios from 'axios';
import Sidebar from '@/components/Sidebar';
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
    return <div className="min-h-screen bg-[#1F1D20] flex items-center justify-center font-bold text-[#D7C9B2]">Loading...</div>;
  }

  return (
    <div className="flex bg-[#1F1D20] text-[#F5ECDC] min-h-screen font-sans selection:bg-orange-950/60 overflow-x-hidden">
      <Sidebar />
      <div className="flex-1 ml-0 md:ml-64 pt-16 md:pt-0 flex flex-col min-h-screen w-full max-w-full">
        
        {/* Header */}
        <header className="sticky top-16 md:top-0 z-30 bg-[#1F1D20]/90 backdrop-blur-md px-4 py-4 md:px-10 md:py-6 flex justify-between items-center border-b border-[#4D4845]/40">
          <div className="flex items-center gap-3 text-xl font-bold">
            <Library size={24} className="text-orange-500" />
            <span className="text-[#F5ECDC]">Quản Lý Tệp Sách (Collections)</span>
          </div>
          <button 
            onClick={openCreateModal}
            className="btn-primary !rounded-full !py-2.5 md:!py-3 !px-5 md:!px-6 shadow-md flex items-center gap-2"
          >
            <Plus size={18} /> <span>Tạo Tệp Mới</span>
          </button>
        </header>

        {/* Content */}
        <main className="flex-1 px-4 md:px-10 pt-8 pb-12">
          {error && (
            <div className="text-center bg-red-950/40 border border-red-500/40 text-red-400 p-4 rounded-xl text-sm font-bold mb-6">
              {error}
            </div>
          )}
          {loading ? (
            <div className="flex justify-center mt-20">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-orange-500 border-t-transparent"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {collections.map(c => (
                <div key={c.id} className="bg-[#2A272A] rounded-3xl p-6 shadow-md border border-[#4D4845]/50 flex flex-col hover:border-[#F97316]/50 transition-all">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-xl font-bold text-[#F5ECDC]">{c.name}</h3>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => copyShareLink(c.id)} className="p-2 text-[#D7C9B2] hover:text-green-400 hover:bg-[#1F1D20] rounded-full transition-colors" title="Copy Share Link">
                        {copiedId === c.id ? <Check size={18} className="text-green-400" /> : <LinkIcon size={18} />}
                      </button>
                      <button onClick={() => openEditModal(c)} className="p-2 text-[#D7C9B2] hover:text-orange-400 hover:bg-[#1F1D20] rounded-full transition-colors">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => handleDelete(c.id)} className="p-2 text-[#D7C9B2] hover:text-red-400 hover:bg-[#1F1D20] rounded-full transition-colors">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                  <p className="text-[#D7C9B2] text-sm mb-4 line-clamp-2 min-h-[40px]">
                    {c.description || 'Không có mô tả'}
                  </p>
                  
                  <div className="mt-auto pt-4 border-t border-[#4D4845]/40 flex justify-between items-center">
                    <span className="text-sm font-bold text-[#7B7369]">{c.book_count} cuốn sách</span>
                    <button 
                      onClick={() => openManageModal(c.id)}
                      className="text-xs md:text-sm font-bold px-4 py-2 rounded-full text-[#1F1D20] bg-orange-500 hover:bg-orange-600 shadow-md transition-all duration-200 cursor-pointer active:scale-95 flex items-center gap-1.5"
                    >
                      <span>Quản lý sách</span>
                    </button>
                  </div>
                </div>
              ))}
              
              {collections.length === 0 && (
                <div className="col-span-full text-center py-20 bg-[#2A272A] rounded-3xl border border-dashed border-[#4D4845]/60">
                  <Library size={48} className="text-[#7B7369] mx-auto mb-4" />
                  <p className="text-[#D7C9B2]">Chưa có Tệp sách nào.</p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
           <div className="bg-[#1F1D20] text-[#F5ECDC] border border-[#4D4845]/60 rounded-3xl w-full max-w-md p-8 shadow-2xl relative">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-6 right-6 p-2 bg-[#2A272A] rounded-full text-[#D7C9B2] hover:text-[#F5ECDC] transition-colors border border-[#4D4845]/40"><X size={16}/></button>
              <h2 className="text-2xl font-black text-[#F5ECDC] mb-6">{editingCollection ? 'Sửa Tệp Sách' : 'Tạo Tệp Sách Mới'}</h2>
              <form onSubmit={handleSave} className="flex flex-col gap-4">
                 <div>
                   <label className="block text-sm font-bold text-[#D7C9B2] mb-2">Tên Tệp</label>
                   <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full bg-[#2A272A] border border-[#4D4845] text-[#F5ECDC] text-sm rounded-2xl focus:ring-orange-500 focus:border-orange-500 block p-4 outline-none transition-all placeholder-[#7B7369]" placeholder="Nhập tên tệp..." />
                 </div>
                 <div>
                   <label className="block text-sm font-bold text-[#D7C9B2] mb-2">Mô tả (Tùy chọn)</label>
                   <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-[#2A272A] border border-[#4D4845] text-[#F5ECDC] text-sm rounded-2xl focus:ring-orange-500 focus:border-orange-500 block p-4 outline-none transition-all h-24 placeholder-[#7B7369]" placeholder="Nhập mô tả..." />
                 </div>
                 <button type="submit" className="w-full btn-primary mt-2">
                   {editingCollection ? 'Lưu Thay Đổi' : 'Tạo Tệp Sách'}
                 </button>
              </form>
           </div>
        </div>
      )}

      {/* Manage Books Modal */}
      {isManageModalOpen && activeCollection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
           <div className="bg-[#1F1D20] text-[#F5ECDC] border border-[#4D4845]/60 rounded-3xl w-full max-w-4xl p-6 md:p-8 shadow-2xl relative h-[90vh] flex flex-col">
              <button onClick={() => setIsManageModalOpen(false)} className="absolute top-6 right-6 p-2 bg-[#2A272A] rounded-full text-[#D7C9B2] hover:text-[#F5ECDC] transition-colors border border-[#4D4845]/40 z-10"><X size={16}/></button>
              <h2 className="text-2xl font-black text-[#F5ECDC] mb-2 pr-10">Thêm sách vào: {activeCollection.name}</h2>
              <p className="text-[#D7C9B2] mb-6 text-sm">Bấm vào sách để thêm hoặc xóa khỏi tệp.</p>
              
              <div className="flex-1 overflow-y-auto pr-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {allBooks.map(book => {
                    const isAdded = activeCollection.books.some((b: any) => b.id === book.id);
                    return (
                      <div 
                        key={book.id} 
                        onClick={() => toggleBookInCollection(book.id)}
                        className={`cursor-pointer group relative rounded-2xl overflow-hidden border-2 transition-all duration-300 ${isAdded ? 'border-orange-500 shadow-md ring-2 ring-orange-500/30' : 'border-[#4D4845]/40 hover:border-gray-500'}`}
                      >
                         <div className="w-full aspect-[2/3] relative">
                            <BookCoverImage 
                              coverUrl={book.cover_url}
                              bookId={book.id}
                              title={book.title}
                              author={book.author}
                              className={`w-full h-full object-cover transition-all ${isAdded ? 'brightness-110' : 'brightness-75 group-hover:brightness-100'}`}
                            />
                           
                            {/* Checkmark overlay */}
                            {isAdded && (
                              <div className="absolute inset-0 bg-orange-500/30 flex items-center justify-center">
                                <div className="bg-orange-500 text-[#1F1D20] rounded-full p-2 shadow-lg">
                                  <Check size={24} strokeWidth={3} />
                                </div>
                              </div>
                            )}
                         </div>
                         <div className="p-2 bg-[#2A272A]">
                           <h3 className="text-xs font-bold text-[#F5ECDC] line-clamp-1">{book.title}</h3>
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
