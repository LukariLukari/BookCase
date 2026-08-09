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
  const [editForm, setEditForm] = useState({ title: '', author: '', genre: '', summary: '', cover_url: '' });
  
  // Add State (Bulk Upload)
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);

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

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa cuốn sách này?')) return;
    try {
      await axios.delete(`http://localhost:8000/api/books/${id}`);
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
      cover_url: book.cover_url || ''
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editingBook) return;
    try {
      await axios.put(`http://localhost:8000/api/books/${editingBook.id}`, editForm);
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
        await axios.post('http://localhost:8000/api/books/upload', formData, {
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
    <div className="flex bg-[#f8f7f4] min-h-screen font-sans selection:bg-orange-200">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 bg-[#f8f7f4]/80 backdrop-blur-md px-10 py-6 flex justify-between items-center border-b border-gray-200">
          <div className="flex items-center gap-8 text-sm font-bold text-gray-400">
             <span className="text-black border-b-2 border-black pb-1 text-xl">Admin Dashboard</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Search books..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-72 bg-white rounded-full py-2.5 pl-12 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/50 shadow-sm transition-all text-black placeholder-gray-400"
              />
            </div>
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2.5 bg-black text-white rounded-full hover:bg-gray-800 transition-all shadow-md flex items-center justify-center gap-2 text-sm font-bold"
            >
              <Plus size={16} /> Add Books
            </button>
          </div>
        </header>

        <main className="flex-1 p-10">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Book</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Author</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Genre</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Source</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredBooks.map((book) => (
                  <tr key={book.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-14 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                           {book.cover_url ? (
                             <img 
                               src={book.cover_url} 
                               className="w-full h-full object-cover" 
                               alt="cover"
                               onError={(e) => {
                                 e.currentTarget.onerror = null;
                                 e.currentTarget.src = 'https://placehold.co/400x600/e2e8f0/64748b?text=No+Cover';
                               }}
                             />
                           ) : (
                             <div className="w-full h-full flex items-center justify-center bg-gray-300 text-[8px] text-gray-500 text-center p-1 font-bold">{book.title}</div>
                           )}
                        </div>
                        <span className="font-bold text-sm text-black max-w-[200px] truncate">{book.title}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{book.author || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {book.genre ? <span className="bg-gray-100 px-2 py-1 rounded text-xs">{book.genre}</span> : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                       {book.external_url ? (
                         <span className="flex items-center gap-1 text-orange-600 font-medium bg-orange-50 px-2 py-1 rounded text-xs w-max" title={book.external_url}>
                           <LinkIcon size={12} /> Drive Link
                         </span>
                       ) : (
                         <span className="flex items-center gap-1 text-gray-600 font-medium bg-gray-100 px-2 py-1 rounded text-xs w-max">
                           <Upload size={12} /> Local File
                         </span>
                       )}
                    </td>
                    <td className="px-6 py-4 text-right">
                       <button onClick={() => openEditModal(book)} className="p-2 text-gray-400 hover:text-orange-500 transition-colors">
                         <Edit2 size={16} />
                       </button>
                       <button onClick={() => handleDelete(book.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors ml-2">
                         <Trash2 size={16} />
                       </button>
                    </td>
                  </tr>
                ))}
                {filteredBooks.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500 text-sm">No books found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
           <div className="bg-white rounded-3xl w-full max-w-lg p-8 shadow-2xl relative">
              <button onClick={() => setIsEditModalOpen(false)} className="absolute top-6 right-6 p-2 bg-gray-100 rounded-full text-gray-500 hover:text-black"><X size={16}/></button>
              <h3 className="text-xl font-bold mb-6 text-black">Edit Book</h3>
              <div className="space-y-4">
                <div><label className="text-title text-sm block mb-1">Title</label><input type="text" className="input-primary" value={editForm.title} onChange={e=>setEditForm({...editForm, title: e.target.value})} /></div>
                <div><label className="text-title text-sm block mb-1">Author</label><input type="text" className="input-primary" value={editForm.author} onChange={e=>setEditForm({...editForm, author: e.target.value})} /></div>
                <div><label className="text-title text-sm block mb-1">Genre</label><input type="text" className="input-primary" value={editForm.genre} onChange={e=>setEditForm({...editForm, genre: e.target.value})} /></div>
                <div>
                  <label className="text-title text-sm block mb-1">Cover Image</label>
                  <div className="flex gap-2">
                    <input type="text" className="input-primary flex-1 text-xs" value={editForm.cover_url} placeholder="Paste Link OR Upload Image ->" onChange={e=>setEditForm({...editForm, cover_url: e.target.value})} />
                    <label className="btn-secondary !py-2 !px-4 text-xs cursor-pointer whitespace-nowrap">
                      Upload
                      <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
                    </label>
                  </div>
                  {editForm.cover_url && (
                    <img src={editForm.cover_url} className="h-24 mt-3 rounded-lg object-cover border border-gray-200 shadow-sm" alt="cover preview" 
                         onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://placehold.co/400x600/e2e8f0/64748b?text=Broken+Link'; }} />
                  )}
                </div>
                <div><label className="text-title text-sm block mb-1">Summary</label><textarea className="input-primary h-24 resize-none" value={editForm.summary} onChange={e=>setEditForm({...editForm, summary: e.target.value})} /></div>
                <button onClick={handleEditSubmit} className="btn-primary w-full mt-4">Save Changes</button>
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
