'use client';
import { useState, useEffect } from 'react';
import axios from 'axios';
import Sidebar from '@/components/Sidebar';
import { Search, Plus, Edit2, Trash2, Link as LinkIcon, Upload, X } from 'lucide-react';

interface Book {
  id: string;
  title: string;
  author: string;
  genre: string;
  summary: string;
  cover_url: string;
  external_url: string;
  created_at: string;
}

interface UploadItem {
  file: File;
  external_url: string;
}

export default function AdminPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // Edit State
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [editForm, setEditForm] = useState({ title: '', author: '', genre: '', summary: '', cover_url: '', external_url: '' });
  
  // Add State (Bulk Upload)
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const fetchBooks = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/books`);
      setBooks(response.data);
    } catch (error) {
      console.error('Lỗi lấy dữ liệu sách:', error);
    }
  };

  useEffect(() => {
    fetchBooks();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa cuốn sách này?')) return;
    try {
      await axios.delete(`${API_URL}/api/books/${id}`);
      fetchBooks();
    } catch (err) {
      alert('Lỗi khi xóa sách!');
    }
  };

  const openEditModal = (book: Book) => {
    setEditingBook(book);
    setEditForm({ 
      title: book.title, 
      author: book.author || '', 
      genre: book.genre || '', 
      summary: book.summary || '',
      cover_url: book.cover_url || '',
      external_url: book.external_url || ''
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editingBook) return;
    try {
      await axios.put(`${API_URL}/api/books/${editingBook.id}`, editForm);
      setIsEditModalOpen(false);
      fetchBooks();
    } catch (err) {
      alert('Lỗi khi cập nhật sách!');
    }
  };

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditForm({...editForm, cover_url: reader.result as string});
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const newItems = files.map(file => ({ file, external_url: '' }));
      setUploadItems([...uploadItems, ...newItems]);
    }
  };

  const updateItemLink = (index: number, url: string) => {
    const newItems = [...uploadItems];
    newItems[index].external_url = url;
    setUploadItems(newItems);
  };
  
  const removeItem = (index: number) => {
    const newItems = [...uploadItems];
    newItems.splice(index, 1);
    setUploadItems(newItems);
  };

  const handleBulkUploadSubmit = async () => {
    if (uploadItems.length === 0) return;
    setIsUploading(true);
    for (const item of uploadItems) {
      const formData = new FormData();
      formData.append('file', item.file);
      formData.append('title', item.file.name.replace(/\.[^/.]+$/, ""));
      if (item.external_url) {
        formData.append('external_url', item.external_url);
      }
      try {
        await axios.post(`${API_URL}/api/books/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } catch (err) {
        console.error('Lỗi khi tải file lên:', err);
      }
    }
    setIsUploading(false);
    setIsAddModalOpen(false);
    setUploadItems([]);
    fetchBooks();
  };

  const filteredBooks = books.filter((book) => 
    book.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex bg-[#f8f7f4] min-h-screen font-sans selection:bg-orange-200 overflow-x-hidden">
      <Sidebar />
      <div className="flex-1 ml-0 md:ml-64 pt-16 md:pt-0 flex flex-col min-h-screen w-full max-w-full">
        <header className="sticky top-16 md:top-0 z-30 bg-[#f8f7f4]/80 backdrop-blur-md px-4 py-4 md:px-10 md:py-6 flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-200 gap-4 md:gap-0">
          <div className="flex items-center gap-8 text-sm font-bold text-gray-400">
             <span className="text-black border-b-2 border-black pb-1 text-xl whitespace-nowrap">Admin Dashboard</span>
          </div>
          <div className="flex items-center w-full md:w-auto gap-4">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Search books..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white rounded-full py-3.5 md:py-2.5 pl-12 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/50 shadow-sm transition-all text-black placeholder-gray-400"
              />
            </div>
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="btn-primary !rounded-full !py-3.5 md:!py-2.5 !px-6 md:!px-5 text-sm whitespace-nowrap"
            >
              <Plus size={16} /> <span className="hidden sm:inline">Add Books</span>
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 md:px-10 pt-8 pb-12">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-x-4 md:gap-x-6 gap-y-8 md:gap-y-10">
            {filteredBooks.map((book) => (
              <div key={book.id} className="flex flex-col group relative">
                {/* Ảnh bìa */}
                <div className="w-full aspect-[2/3] relative z-10 mb-3 rounded-2xl overflow-hidden shadow-sm border border-gray-100 group-hover:shadow-xl transition-all duration-300">
                   {book.cover_url ? (
                     <img 
                        src={book.cover_url} 
                        className="w-full h-full object-cover" 
                        alt={book.title} 
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = 'https://placehold.co/400x600/e2e8f0/64748b?text=No+Cover';
                        }}
                      />
                   ) : (
                     <div className="w-full h-full bg-slate-100 flex items-center justify-center p-4 text-center">
                        <span className="font-bold text-gray-400 text-xs">{book.title}</span>
                     </div>
                   )}
                   
                   {/* Tag Nguồn (Source) */}
                   <div className="absolute top-2 left-2 z-20">
                     {book.external_url ? (
                       <span className="flex items-center gap-1 text-orange-600 font-bold bg-orange-50/90 backdrop-blur px-2 py-1 rounded-lg text-[10px] shadow-sm border border-orange-100" title={book.external_url}>
                         <LinkIcon size={12} /> Drive
                       </span>
                     ) : (
                       <span className="flex items-center gap-1 text-gray-700 font-bold bg-white/90 backdrop-blur px-2 py-1 rounded-lg text-[10px] shadow-sm border border-gray-100">
                         <Upload size={12} /> Local
                       </span>
                     )}
                   </div>

                   {/* Overlay Actions (Edit/Delete) - Hiện trên Mobile luôn, ẩn trên Desktop cho đến khi hover */}
                   <div className="absolute inset-0 bg-black/40 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 md:gap-4 z-20 backdrop-blur-[2px]">
                       <button onClick={() => openEditModal(book)} className="p-2.5 md:p-3 bg-white text-black hover:text-orange-500 rounded-full shadow-lg transition-transform hover:scale-110">
                         <Edit2 size={16} />
                       </button>
                       <button onClick={() => handleDelete(book.id)} className="p-2.5 md:p-3 bg-white text-black hover:text-red-500 rounded-full shadow-lg transition-transform hover:scale-110">
                         <Trash2 size={16} />
                       </button>
                   </div>
                </div>
                
                {/* Thông tin Text */}
                <div className="px-1">
                  <h3 className="text-sm font-bold text-black leading-tight line-clamp-2">{book.title}</h3>
                </div>
              </div>
            ))}
          </div>

          {filteredBooks.length === 0 && (
            <div className="text-center text-gray-500 text-sm mt-10">No books found.</div>
          )}
        </main>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
           <div className="bg-white rounded-3xl w-full max-w-4xl p-6 md:p-8 shadow-2xl relative max-h-[90vh] flex flex-col">
              <button onClick={() => setIsEditModalOpen(false)} className="absolute top-4 right-4 md:top-6 md:right-6 p-2 bg-gray-100 rounded-full text-gray-500 hover:text-black transition-colors"><X size={16}/></button>
              <h3 className="text-xl md:text-2xl font-extrabold mb-4 md:mb-8 text-black shrink-0">Edit Book</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 overflow-y-auto flex-1 pr-2">
                {/* Left Column - Details */}
                <div className="space-y-4 md:space-y-5">
                  <div><label className="text-title text-sm block mb-1.5">Title</label><input type="text" className="input-primary" value={editForm.title} onChange={e=>setEditForm({...editForm, title: e.target.value})} /></div>
                  <div><label className="text-title text-sm block mb-1.5">Author</label><input type="text" className="input-primary" value={editForm.author} onChange={e=>setEditForm({...editForm, author: e.target.value})} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-title text-sm block mb-1.5">Genre</label><input type="text" className="input-primary" value={editForm.genre} onChange={e=>setEditForm({...editForm, genre: e.target.value})} /></div>
                    <div><label className="text-title text-sm block mb-1.5 text-orange-500">Google Drive Link</label><input type="text" className="input-primary border-orange-200" placeholder="Optional URL" value={editForm.external_url} onChange={e=>setEditForm({...editForm, external_url: e.target.value})} /></div>
                  </div>
                  <div><label className="text-title text-sm block mb-1.5">Summary</label><textarea className="input-primary h-32 md:h-36 resize-none" value={editForm.summary} onChange={e=>setEditForm({...editForm, summary: e.target.value})} /></div>
                </div>

                {/* Right Column - Cover */}
                <div className="flex flex-col">
                  <label className="text-title text-sm block mb-1.5">Cover Image</label>
                  <div className="flex gap-2 mb-4">
                    <input type="text" className="input-primary flex-1 text-xs" value={editForm.cover_url} placeholder="Paste Link OR Upload Image ->" onChange={e=>setEditForm({...editForm, cover_url: e.target.value})} />
                    <label className="btn-secondary !py-2 !px-4 text-xs cursor-pointer whitespace-nowrap">
                      Upload
                      <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
                    </label>
                  </div>
                  <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center flex-1 min-h-[200px] md:min-h-[280px] p-4">
                    {editForm.cover_url ? (
                      <img src={editForm.cover_url} className="max-h-[200px] md:max-h-[260px] rounded-lg object-contain shadow-sm" alt="cover preview" 
                           onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://placehold.co/400x600/e2e8f0/64748b?text=Broken+Link'; }} />
                    ) : (
                      <span className="text-gray-400 text-sm font-medium">No Cover Provided</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 md:mt-10 pt-4 md:pt-6 border-t border-gray-100 flex justify-end gap-3 shrink-0">
                 <button onClick={() => setIsEditModalOpen(false)} className="btn-outline !py-3 !px-6 text-sm">Cancel</button>
                 <button onClick={handleEditSubmit} className="btn-primary !py-3 !px-8 text-sm">Save Changes</button>
              </div>
           </div>
        </div>
      )}

      {/* Add Modal (Bulk Upload + Links) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
           <div className="bg-white rounded-3xl w-full max-w-2xl p-8 shadow-2xl relative max-h-[90vh] flex flex-col">
              <button onClick={() => {setIsAddModalOpen(false); setUploadItems([]);}} className="absolute top-6 right-6 p-2 bg-gray-100 rounded-full text-gray-500 hover:text-black"><X size={16}/></button>
              <h3 className="text-xl font-bold mb-6 text-black">Upload Books</h3>
              
              <div className="flex-1 overflow-y-auto pr-2 space-y-4 min-h-[200px]">
                {/* Khu vực chọn file */}
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:bg-gray-50 transition-colors relative">
                  <input type="file" multiple accept=".pdf,.epub" className="absolute opacity-0 cursor-pointer inset-0 z-10" onChange={handleFileSelect} />
                  <Upload size={32} className="mx-auto text-gray-400 mb-2" />
                  <p className="text-sm font-bold text-black">Click or Drag to Select Multiple PDF/EPUB Files</p>
                </div>

                {/* Danh sách file đã chọn */}
                {uploadItems.length > 0 && (
                  <div className="mt-6 space-y-3">
                    <h4 className="text-sm font-bold text-black border-b pb-2">Selected Files ({uploadItems.length})</h4>
                    {uploadItems.map((item, index) => (
                      <div key={index} className="flex flex-col gap-2 p-4 bg-gray-50 rounded-xl border border-gray-100 relative group">
                         <button onClick={() => removeItem(index)} className="absolute top-2 right-2 p-1.5 bg-white text-gray-400 hover:text-red-500 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                           <X size={14} />
                         </button>
                         <div className="flex items-center gap-2 text-black font-bold text-sm pr-8 truncate">
                           <Upload size={16} className="text-orange-500 flex-shrink-0" />
                           <span className="truncate">{item.file.name}</span>
                         </div>
                         <div className="flex items-center gap-2 mt-1">
                           <LinkIcon size={14} className="text-gray-400 flex-shrink-0" />
                           <input 
                             type="text" 
                             placeholder="Paste Google Drive Link (Optional)" 
                             className="input-primary !py-2 !px-3 !text-xs"
                             value={item.external_url}
                             onChange={(e) => updateItemLink(index, e.target.value)}
                           />
                         </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {uploadItems.length > 0 && (
                <div className="pt-6 mt-2 border-t border-gray-100">
                  <button 
                    onClick={handleBulkUploadSubmit} 
                    disabled={isUploading}
                    className="btn-primary w-full"
                  >
                    {isUploading ? 'Uploading...' : `Upload All ${uploadItems.length} Books`}
                  </button>
                </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
}
