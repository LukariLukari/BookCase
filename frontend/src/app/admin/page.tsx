'use client';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import Sidebar from '@/components/Sidebar';
import { Search, Plus, Edit2, Trash2, Link as LinkIcon, Upload, X, Share2 } from 'lucide-react';

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
  
  const { user, token, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'admin')) {
      router.push('/');
    }
  }, [user, isLoading, router]);
  
  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // Edit State
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [editForm, setEditForm] = useState({ title: '', author: '', genre: '', summary: '', cover_url: '', external_url: '' });
  
  // Add State (Bulk Upload)
  const [addMode, setAddMode] = useState<'upload' | 'link'>('upload');
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [smartPasteText, setSmartPasteText] = useState('');
  
  // Add State (Direct Link)
  const [linkForm, setLinkForm] = useState({ title: '', author: '', genre: '', cover_url: '', external_url: '' });

  const handleSmartPaste = () => {
    if (!smartPasteText) return;
    
    const lines = smartPasteText.split('\n');
    const extractedLinks: {name: string, url: string}[] = [];
    
    for (const line of lines) {
      const driveRegex = /(?:https?:\/\/)?drive\.google\.com\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/;
      const match = driveRegex.exec(line);
      if (match) {
         const beforeLink = line.substring(0, match.index).trim();
         const cleanName = beforeLink.replace(/^[-:.*]+|[-:.*]+$/g, '').trim();
         
         extractedLinks.push({
           name: cleanName,
           url: `https://drive.google.com/file/d/${match[1]}/view`
         });
      }
    }
    
    if (extractedLinks.length === 0) {
      alert('Không tìm thấy link Google Drive hợp lệ trong đoạn text.');
      return;
    }

    setUploadItems(prev => {
      const newItems = [...prev];
      let filledCount = 0;
      const unassignedLinks: string[] = [];
      
      // Bước 1: Thử match theo tên file (nếu có tên đi kèm link)
      for (const link of extractedLinks) {
         if (link.name) {
            const targetIndex = newItems.findIndex(item => !item.external_url && item.file.name.toLowerCase().includes(link.name.toLowerCase()));
            if (targetIndex !== -1) {
               newItems[targetIndex].external_url = link.url;
               filledCount++;
            } else {
               unassignedLinks.push(link.url);
            }
         } else {
            unassignedLinks.push(link.url);
         }
      }
      
      // Bước 2: Điền tuần tự các link chưa được assign vào các file còn trống
      let linkIndex = 0;
      for (let i = 0; i < newItems.length; i++) {
        if (!newItems[i].external_url && linkIndex < unassignedLinks.length) {
          newItems[i].external_url = unassignedLinks[linkIndex];
          linkIndex++;
          filledCount++;
        }
      }
      
      setTimeout(() => alert(`Đã tự động ghép nối thành công ${filledCount} links!`), 100);
      return newItems;
    });
    
    setSmartPasteText('');
  };

  const [error, setError] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;

  const fetchBooks = async () => {
    try {
      const response = await axios.get(`${baseUrl}/api/books`);
      setBooks(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Lỗi lấy dữ liệu sách:', err);
      setError(err.message || 'Lỗi kết nối API');
    }
  };

  useEffect(() => {
    fetchBooks();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa cuốn sách này?')) return;
    try {
      await axios.delete(`${API_URL}/api/books/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
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
      await axios.put(`${API_URL}/api/books/${editingBook.id}`, editForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
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


  const handleBulkUploadSubmit = async () => {
    setIsUploading(true);
    let uploadedCount = 0;
    
    for (const item of uploadItems) {
      try {
        const formData = new FormData();
        formData.append('file', item.file);
        // Lấy tên sách từ tên file (bỏ đuôi .pdf, .epub)
        const title = item.file.name.replace(/\.[^/.]+$/, "");
        formData.append('title', title);
        if (item.external_url) {
          formData.append('external_url', item.external_url);
        }
        
        await axios.post(`${API_URL}/api/books/upload`, formData, {
          headers: { 
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${token}`
          }
        });
        uploadedCount++;
      } catch (err) {
        console.error(`Lỗi tải lên file ${item.file.name}:`, err);
      }
    }
    
    setIsUploading(false);
    setIsAddModalOpen(false);
    setUploadItems([]);
    fetchBooks();
    if (uploadedCount > 0) alert(`Đã tải lên thành công ${uploadedCount} sách!`);
  };

  const handleAddByLinkSubmit = async () => {
    if (!linkForm.title || !linkForm.external_url) {
       alert("Vui lòng nhập tối thiểu Tên sách và Link Drive!");
       return;
    }
    setIsUploading(true);
    try {
       await axios.post(`${API_URL}/api/books/link`, linkForm, {
         headers: { Authorization: `Bearer ${token}` }
       });
       setIsUploading(false);
       setIsAddModalOpen(false);
       setLinkForm({ title: '', author: '', genre: '', cover_url: '', external_url: '' });
       fetchBooks();
       alert("Đã thêm sách thành công!");
    } catch(err) {
       setIsUploading(false);
       alert("Lỗi khi thêm sách bằng Link!");
    }
  };

  const copyShareLink = (id: string) => {
    const url = `${window.location.origin}/share/book/${id}`;
    navigator.clipboard.writeText(url);
    alert('Đã copy link chia sẻ sách vào Clipboard!');
  };

  const filteredBooks = books.filter(book => 
    book.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading || !user || user.role !== 'admin') {
    return <div className="min-h-screen bg-[#f8f7f4] flex items-center justify-center font-bold text-gray-500">Loading...</div>;
  }

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

                   {/* Overlay Actions (Edit/Delete/Share) - Hiện trên Mobile luôn, ẩn trên Desktop cho đến khi hover */}
                   <div className="absolute inset-0 bg-black/40 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity flex flex-wrap items-center justify-center gap-2 md:gap-3 z-20 backdrop-blur-[2px] p-2">
                       <button onClick={() => copyShareLink(book.id)} className="p-2 md:p-2.5 bg-white text-black hover:text-green-500 rounded-full shadow-lg transition-transform hover:scale-110" title="Copy Share Link">
                         <Share2 size={16} />
                       </button>
                       <button onClick={() => openEditModal(book)} className="p-2 md:p-2.5 bg-white text-black hover:text-orange-500 rounded-full shadow-lg transition-transform hover:scale-110">
                         <Edit2 size={16} />
                       </button>
                       <button onClick={() => handleDelete(book.id)} className="p-2 md:p-2.5 bg-white text-black hover:text-red-500 rounded-full shadow-lg transition-transform hover:scale-110">
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

          {error && (
            <div className="text-center bg-red-50 text-red-500 p-4 rounded-xl text-sm font-bold mt-10">
              {error}
            </div>
          )}

          {filteredBooks.length === 0 && !error && (
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
              <button onClick={() => {setIsAddModalOpen(false); setUploadItems([]); setAddMode('upload');}} className="absolute top-6 right-6 p-2 bg-gray-100 rounded-full text-gray-500 hover:text-black"><X size={16}/></button>
              
              <div className="flex gap-4 mb-6 border-b">
                 <button 
                    className={`pb-3 text-lg font-bold px-2 ${addMode === 'upload' ? 'text-black border-b-2 border-black' : 'text-gray-400'}`}
                    onClick={() => setAddMode('upload')}
                 >
                    Upload Sách (PDF/EPUB)
                 </button>
                 <button 
                    className={`pb-3 text-lg font-bold px-2 ${addMode === 'link' ? 'text-black border-b-2 border-black' : 'text-gray-400'}`}
                    onClick={() => setAddMode('link')}
                 >
                    Thêm Nhanh (Bằng Link)
                 </button>
              </div>
              
              <div className="flex-1 overflow-y-auto pr-2 space-y-4 min-h-[200px]">
                {addMode === 'upload' ? (
                  <>
                    {/* Khu vực chọn file */}
                    <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:bg-gray-50 transition-colors relative">
                      <input type="file" multiple accept=".pdf,.epub" className="absolute opacity-0 cursor-pointer inset-0 z-10" onChange={handleFileSelect} />
                      <Upload size={32} className="mx-auto text-gray-400 mb-2" />
                      <p className="text-sm font-bold text-black">Click or Drag to Select Multiple PDF/EPUB Files</p>
                    </div>

                    {/* Smart Paste Block */}
                    {uploadItems.length > 0 && uploadItems.some(item => !item.external_url) && (
                      <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl mt-4">
                        <h4 className="text-sm font-bold text-orange-600 mb-2">Smart Auto-Match</h4>
                        <p className="text-xs text-orange-500/80 mb-3">Dán danh sách theo định dạng <b>Tên Sách - Link Drive</b>, hệ thống sẽ tự động ghép đúng link vào đúng sách bất chấp thứ tự!</p>
                        <div className="flex flex-col gap-2">
                          <textarea 
                            placeholder="Tên Sách 1 - https://drive...&#10;Tên Sách 2 - https://drive..." 
                            className="input-primary w-full !text-xs !bg-white min-h-[100px] resize-y leading-relaxed"
                            value={smartPasteText}
                            onChange={(e) => setSmartPasteText(e.target.value)}
                            onPaste={(e) => {
                              setTimeout(() => {
                                setSmartPasteText(prev => prev.endsWith('\n') ? prev : prev + '\n');
                              }, 10);
                            }}
                          />
                          <div className="flex gap-2 justify-end">
                            <button 
                              onClick={async () => {
                                try {
                                  const text = await navigator.clipboard.readText();
                                  setSmartPasteText(prev => prev + (prev && !prev.endsWith('\n') ? '\n' : '') + text + '\n');
                                } catch(err) {
                                  alert("Trình duyệt chặn quyền Clipboard. Vui lòng dán thủ công bằng Ctrl+V");
                                }
                              }}
                              className="btn-secondary !py-2 !px-4 text-xs whitespace-nowrap bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-1"
                            >
                              Dán (Paste)
                            </button>
                            <button 
                              onClick={handleSmartPaste}
                              disabled={!smartPasteText}
                              className="btn-primary !py-2 !px-4 text-xs disabled:opacity-50 whitespace-nowrap"
                            >
                              Auto Match Links
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Danh sách file đã chọn */}
                    {uploadItems.length > 0 && (
                      <div className="mt-6 space-y-3">
                        <h4 className="text-sm font-bold text-black border-b pb-2">Selected Files ({uploadItems.length})</h4>
                        {uploadItems.map((item, index) => (
                          <div key={index} className="flex flex-col gap-2 p-4 bg-gray-50 rounded-xl border border-gray-100 relative group">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-sm text-black truncate pr-4">{item.file.name}</span>
                              <button onClick={() => setUploadItems(items => items.filter((_, i) => i !== index))} className="text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>
                            </div>
                            <div className="flex items-center gap-2">
                              <LinkIcon size={14} className="text-gray-400 shrink-0"/>
                              <input 
                                type="text" 
                                placeholder="Paste Google Drive Link here..." 
                                className="input-primary flex-1 !text-xs !py-1.5"
                                value={item.external_url}
                                onChange={(e) => {
                                  const newItems = [...uploadItems];
                                  newItems[index].external_url = e.target.value;
                                  setUploadItems(newItems);
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-4">
                    <p className="text-xs text-gray-500 mb-4 bg-blue-50 p-3 rounded-lg border border-blue-100 text-blue-800">
                      Thêm sách nhanh chóng không cần Upload file EPUB/PDF. Giúp tiết kiệm 100% băng thông tải lên và tự động lấy ảnh bìa từ đường link bạn cung cấp!
                    </p>
                    <div><label className="text-title text-sm block mb-1.5">Tên Sách <span className="text-red-500">*</span></label><input type="text" className="input-primary" value={linkForm.title} onChange={e=>setLinkForm({...linkForm, title: e.target.value})} /></div>
                    <div><label className="text-title text-sm block mb-1.5">Tác Giả</label><input type="text" className="input-primary" value={linkForm.author} onChange={e=>setLinkForm({...linkForm, author: e.target.value})} /></div>
                    <div><label className="text-title text-sm block mb-1.5">Thể Loại</label><input type="text" className="input-primary" value={linkForm.genre} onChange={e=>setLinkForm({...linkForm, genre: e.target.value})} /></div>
                    <div><label className="text-title text-sm block mb-1.5">Link Google Drive <span className="text-red-500">*</span></label><input type="text" className="input-primary border-orange-200" placeholder="https://drive.google.com/..." value={linkForm.external_url} onChange={e=>setLinkForm({...linkForm, external_url: e.target.value})} /></div>
                    <div><label className="text-title text-sm block mb-1.5">Link Ảnh Bìa (Cover URL)</label><input type="text" className="input-primary" placeholder="https://..." value={linkForm.cover_url} onChange={e=>setLinkForm({...linkForm, cover_url: e.target.value})} /></div>
                  </div>
                )}
              </div>
              
              <div className="mt-6 pt-4 border-t border-gray-100 shrink-0">
                 {addMode === 'upload' ? (
                   <button 
                     onClick={handleBulkUploadSubmit} 
                     disabled={isUploading || uploadItems.length === 0}
                     className="btn-primary w-full !py-3"
                   >
                     {isUploading ? 'Uploading...' : `Upload All ${uploadItems.length} Books`}
                   </button>
                 ) : (
                   <button 
                     onClick={handleAddByLinkSubmit} 
                     disabled={isUploading || !linkForm.title || !linkForm.external_url}
                     className="btn-primary w-full !py-3"
                   >
                     {isUploading ? 'Đang thêm...' : 'Thêm Sách Nhanh'}
                   </button>
                 )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
