'use client';
import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/contexts/AuthContext';
import Sidebar from '@/components/Sidebar';
import AdminTabs from '@/components/AdminTabs';
import { Search, Plus, Edit2, Trash2, Link as LinkIcon, Upload, X, Share2, Check, Loader2, Settings, Download, GripVertical, Save, Link2, Copy, Unlink2, AlertTriangle } from 'lucide-react';

import { getCoverUrl, DEFAULT_COVER_SVG } from '@/utils/image';
import BookCoverImage from '@/components/BookCoverImage';
import CheckFileLinksModal from '@/components/CheckFileLinksModal';
import SearchOnlineModal from '@/components/SearchOnlineModal';

import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * Chuẩn hóa tên tác giả:
 * - Chữ thường, bỏ dấu câu và ký tự lạ
 * - Bỏ dấu tiếng Việt (đ -> d, é -> e)
 * - Tách thành mảng từ đơn, sắp xếp theo thứ tự chữ cái rồi nối lại
 * Giúp "Higashino Keigo" và "Keigo Higashino " có cùng một chuỗi chuẩn hóa: "higashino keigo"
 */
export function normalizeAuthor(author: string | null | undefined): string {
  if (!author) return '';
  let str = author.toLowerCase().trim();
  str = str.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()\[\]"'`]/g, ' ');
  str = str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd');
  const tokens = Array.from(new Set(str.split(/\s+/).filter(Boolean)));
  tokens.sort();
  return tokens.join(' ');
}

/**
 * Chuẩn hóa tên sách:
 * - Chữ thường, bỏ dấu câu và dấu tiếng Việt
 * Giúp nhận diện chính xác sách trùng lặp
 */
export function normalizeTitle(title: string | null | undefined): string {
  if (!title) return '';
  let str = title.toLowerCase().trim();
  str = str.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()\[\]"'`]/g, ' ');
  str = str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
  return str;
}

function SortableBookItem({ book, isSortMode, selectedBooks, toggleBookSelection, setDownloadingId, downloadingId, baseUrl, copyShareLink, copiedId, openEditModal, handleDelete, duplicateInfo }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: book.id, disabled: !isSortMode });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={`flex flex-col group relative ${isSortMode ? 'cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-[#1B2A4A] rounded-2xl' : ''}`}>
      {isSortMode && (
         <div {...attributes} {...listeners} className="absolute top-2 left-2 z-40 bg-[#2A2320]/80 p-1.5 rounded-lg text-white hover:bg-black transition-colors backdrop-blur-sm cursor-grab">
           <GripVertical size={16} />
         </div>
      )}
      <div className={`w-full aspect-[2/3] relative z-10 mb-2.5 rounded-2xl overflow-hidden shadow-sm border ${
        duplicateInfo && duplicateInfo.isRedundant 
          ? 'border-red-400 shadow-red-200' 
          : 'border-[#E5DACD]'
      } transition-all duration-300 ${!isSortMode ? 'group-hover:shadow-md group-hover:-translate-y-1' : ''}`}>
         <BookCoverImage 
           coverUrl={book.cover_url}
           bookId={book.id}
           title={book.title}
           author={book.author}
           className="w-full h-full object-cover"
         />
         
         {!isSortMode && (
           <>
             <div className="absolute top-2 right-2 z-30" onClick={(e) => e.stopPropagation()}>
               <input 
                 type="checkbox" 
                 checked={selectedBooks.includes(book.id)}
                 onChange={() => toggleBookSelection(book.id)}
                 className="w-5 h-5 rounded-md border-2 border-[#E5DACD] bg-white checked:bg-[#2A2320] checked:border-[#2A2320] cursor-pointer shadow-sm focus:ring-0 transition-colors"
               />
             </div>

             {duplicateInfo && (
               <div className="absolute top-2 right-9 z-20">
                 <span className={`text-[10px] font-black px-2 py-0.5 rounded-md backdrop-blur-md shadow-sm border ${
                   duplicateInfo.isRedundant 
                     ? 'bg-[#FAF0F0] text-[#EB5757] border-[#F0D5D5]' 
                     : 'bg-[#FAF6F0] text-[#2A2320] border-[#E5DACD]'
                 }`}>
                   {duplicateInfo.isRedundant ? `Bản thừa #${duplicateInfo.copyIndex}` : 'Bản gốc'}
                 </span>
               </div>
             )}
             
             <div className="absolute top-2 left-2 z-20">
               {book.external_url ? (
                 <span className="flex items-center gap-1 text-[#3A7BD5] font-bold bg-[#FAF6F0]/95 backdrop-blur px-2 py-0.5 rounded-lg text-[10px] shadow-sm border border-[#E5DACD]" title={book.external_url}>
                   <LinkIcon size={11} /> Drive
                 </span>
               ) : book.has_file === false ? (
                 <span className="flex items-center gap-1 text-[#C06060] font-bold bg-[#FAF0F0]/95 backdrop-blur px-2 py-0.5 rounded-lg text-[10px] shadow-sm border border-[#F0D5D5]" title="Chưa có dữ liệu file">
                   <AlertTriangle size={11} className="text-[#C06060]" /> Chưa có file
                 </span>
               ) : (
                 <span className="flex items-center gap-1 text-[#27AE60] font-bold bg-[#FAF6F0]/95 backdrop-blur px-2 py-0.5 rounded-lg text-[10px] shadow-sm border border-[#E5DACD]">
                   <Upload size={11} /> Local
                 </span>
               )}
             </div>

             <div className="absolute bottom-2 right-2 flex items-center gap-1.5 z-20">
                 <button 
                   onClick={() => {
                     if (book.has_file === false) return;
                     setDownloadingId(book.id);
                     const a = document.createElement('a');
                     a.href = `${baseUrl}/api/books/${book.id}/download`;
                     a.download = `${book.title}.pdf`;
                     document.body.appendChild(a);
                     a.click();
                     a.remove();
                     setTimeout(() => setDownloadingId(null), 1500);
                   }} 
                   disabled={downloadingId === book.id || book.has_file === false}
                   className={`p-1.5 rounded-full shadow-md border transition-all hover:scale-105 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                     book.has_file === false
                       ? 'bg-[#EFE8DE] text-gray-400 border-[#E0D5C7]'
                       : 'bg-[#1B2A4A] hover:bg-[#131E33] text-white border-[#1B2A4A]'
                   }`} 
                   title={book.has_file === false ? "Chưa có file dữ liệu" : "Tải sách xuống"}
                 >
                   {downloadingId === book.id ? <Loader2 size={13} className="animate-spin text-white" /> : <Download size={13} className="text-white" />}
                 </button>
                 <button 
                   onClick={() => copyShareLink(book.id)} 
                   className="p-1.5 bg-[#FAF6F0]/95 text-[#2A2320] hover:bg-[#EFE8DE] rounded-full shadow-sm border border-[#E5DACD] transition-all hover:scale-105 cursor-pointer" 
                   title="Sao chép link chia sẻ"
                 >
                   {copiedId === book.id ? <Check size={13} className="text-green-600 stroke-[3]" /> : <Share2 size={13} className="text-[#7A6F68]" />}
                 </button>

                 <button 
                   onClick={() => openEditModal(book)} 
                   className="p-1.5 bg-[#FAF6F0]/95 text-[#2A2320] hover:bg-[#EFE8DE] rounded-full shadow-sm border border-[#E5DACD] transition-all hover:scale-105 cursor-pointer" 
                   title="Sửa thông tin sách"
                 >
                   <Edit2 size={13} className="text-[#7A6F68]" />
                 </button>
                 <button 
                   onClick={() => handleDelete(book.id)} 
                   className="p-1.5 bg-[#FAF6F0]/95 text-[#EB5757] hover:bg-[#FAF0F0] rounded-full shadow-sm border border-[#E5DACD] transition-all hover:scale-105 cursor-pointer" 
                   title="Xóa sách"
                 >
                   <Trash2 size={13} />
                 </button>
              </div>
           </>
         )}
      </div>
      
      <div className="px-1">
        <h3 className="text-xs sm:text-sm font-extrabold text-[#2A2320] leading-snug line-clamp-2">{book.title}</h3>
        <p className="text-[11px] sm:text-xs text-[#8B7070] font-semibold mt-0.5 truncate">{book.author || 'Chưa rõ tác giả'}</p>
        {duplicateInfo && (
          <p className="text-[10px] font-bold text-[#7A6F68] mt-0.5">
            Nhóm trùng #{duplicateInfo.groupIndex} ({duplicateInfo.totalInGroup} bản)
          </p>
        )}
      </div>
    </div>
  );
}

interface Book {
  id: string;
  title: string;
  author: string;
  genre: string;
  summary: string;
  cover_url: string;
  external_url: string;
  has_file?: boolean;
  created_at: string;
}

interface UploadItem {
  file: File;
  external_url: string;
}

export default function AdminPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFixing, setIsFixing] = useState(false);
  const [selectedBooks, setSelectedBooks] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [isFetchingBooks, setIsFetchingBooks] = useState(true);

  const [downloadProgress, setDownloadProgress] = useState(0);
  
  const [isSortMode, setIsSortMode] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  
  const { user, token, logout, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'admin')) {
      router.push('/');
    }
  }, [user, isLoading, router]);
  
  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCheckLinksOpen, setIsCheckLinksOpen] = useState(false);
  const [isSearchOnlineOpen, setIsSearchOnlineOpen] = useState(false);
  const [searchOnlineQuery, setSearchOnlineQuery] = useState('');
  const [searchOnlineTargetBookId, setSearchOnlineTargetBookId] = useState<string | null>(null);
  
  // Edit State
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [editForm, setEditForm] = useState({ title: '', author: '', genre: '', summary: '', cover_url: '', external_url: '' });
  
  // Add State (Bulk Upload)
  const [addMode, setAddMode] = useState<'upload' | 'link'>('upload');
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [smartPasteText, setSmartPasteText] = useState('');
  const [uploadStatus, setUploadStatus] = useState<{type: 'error'|'success', msg: string} | null>(null);
  
  // Add State (Direct Link)
  const [linkForm, setLinkForm] = useState({ title: '', author: '', genre: '', cover_url: '', external_url: '' });

  // File Health / Broken Links Check State
  const [brokenFileCount, setBrokenFileCount] = useState<number | null>(null);
  const [brokenBooksList, setBrokenBooksList] = useState<{ id: string; title: string; author?: string; reason?: string }[]>([]);
  const [isCheckingFiles, setIsCheckingFiles] = useState(false);
  const [isBrokenFilterActive, setIsBrokenFilterActive] = useState(false);
  const [checkLinksRefreshKey, setCheckLinksRefreshKey] = useState(0);

  const refreshAllBookData = async () => {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('cached_books');
      } catch (e) {}
    }
    await Promise.allSettled([
      fetchBooks(),
      fetchBrokenFiles()
    ]);
    setCheckLinksRefreshKey(k => k + 1);
  };


  const handleFixCovers = async () => {
    setIsFixing(true);
    try {
      const res = await axios.post(`${API_URL}/api/admin/fix-all-covers`, {}, {
        headers: getHeaders()
      });
      fetchBooks();
      setSuccessMsg(res.data.message || "Đã khắc phục xong!");
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      if (err.response?.status === 401) logout();
      else {
        setError("Lỗi khi khắc phục bìa sách");
        setTimeout(() => setError(null), 3000);
      }
    } finally {
      setIsFixing(false);
    }
  };

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
      setUploadStatus({type: 'error', msg: 'Không tìm thấy link Google Drive hợp lệ trong đoạn text.'});
      setTimeout(() => setUploadStatus(null), 3000);
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
      
      setUploadStatus({type: 'success', msg: `Đã tự động ghép nối thành công ${filledCount} links!`});
      setTimeout(() => setUploadStatus(null), 3000);
      return newItems;
    });
    
    setSmartPasteText('');
  };

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;

  const getCoverUrl = (url: string | undefined | null) => {
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    return `${baseUrl}${url}`;
  };

  const fetchBooks = async () => {
    try {
      setIsFetchingBooks(true);
      setDownloadProgress(0);
      const response = await axios.get(`${baseUrl}/api/books`, {
        timeout: 15000,
        onDownloadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setDownloadProgress(percentCompleted);
          } else {
            setDownloadProgress(prev => Math.min(prev + 20, 95));
          }
        }
      });
      setBooks(response.data);
      setDownloadProgress(100);
      setTimeout(() => setIsFetchingBooks(false), 200);
      setError(null);
    } catch (err: any) {
      console.error('Lỗi lấy dữ liệu sách:', err);
      if (err.response?.status === 401) {
        logout();
      } else {
        setError(err.message || 'Lỗi kết nối API');
      }
      setIsFetchingBooks(false);
    }
  };

  const fetchBrokenFiles = async () => {
    try {
      setIsCheckingFiles(true);
      const res = await axios.get(`${baseUrl}/api/admin/books/check-files`, {
        headers: getHeaders()
      });
      setBrokenFileCount(res.data.broken_count ?? 0);
      setBrokenBooksList(res.data.broken_books || []);
    } catch (e) {
      console.error('Lỗi khi kiểm tra liên kết file:', e);
    } finally {
      setIsCheckingFiles(false);
    }
  };

  useEffect(() => {
    fetchBooks();
    fetchBrokenFiles();

    const handleBooksUpdated = () => {
      fetchBooks();
      fetchBrokenFiles();
      setCheckLinksRefreshKey(k => k + 1);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('bookcase:books-updated', handleBooksUpdated);
      return () => window.removeEventListener('bookcase:books-updated', handleBooksUpdated);
    }
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setBooks((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleSaveOrder = async () => {
    if (!isSortMode) return;
    setIsSavingOrder(true);
    try {
      const bookIds = books.map(b => b.id);
      await axios.put(`${API_URL}/api/admin/books/reorder`, { book_ids: bookIds }, {
        headers: getHeaders()
      });
      setIsSortMode(false);
      setSuccessMsg("Đã lưu thứ tự sách thành công!");
      setTimeout(() => setSuccessMsg(null), 3000);
      fetchBooks();
    } catch (err: any) {
      if (err.response?.status === 401) logout();
      else {
        setError('Lỗi khi lưu thứ tự sách!');
        setTimeout(() => setError(null), 3000);
      }
    } finally {
      setIsSavingOrder(false);
    }
  };

  const getHeaders = () => {
    const authToken = token || localStorage.getItem('access_token') || localStorage.getItem('token');
    return { Authorization: `Bearer ${authToken}` };
  };

  const handleDelete = async (id: string) => {
    try {
      await axios.delete(`${API_URL}/api/books/${id}`, {
        headers: getHeaders()
      });
      setSelectedBooks(prev => prev.filter(bookId => bookId !== id));
      refreshAllBookData();
    } catch (err: any) {
      if (err.response?.status === 401) {
        logout();
      } else {
        setError('Lỗi khi xóa sách!');
        setTimeout(() => setError(null), 3000);
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedBooks.length === 0) return;
    try {
      await axios.delete(`${API_URL}/api/books`, {
        headers: getHeaders(),
        data: { book_ids: selectedBooks }
      });
      setSelectedBooks([]);
      refreshAllBookData();
    } catch (err: any) {
      if (err.response?.status === 401) {
        logout();
      } else {
        setError('Lỗi khi xóa sách đồng loạt!');
        setTimeout(() => setError(null), 3000);
      }
    }
  };

  const toggleBookSelection = (id: string) => {
    setSelectedBooks(prev => 
      prev.includes(id) ? prev.filter(bookId => bookId !== id) : [...prev, id]
    );
  };

  const openEditModal = (book: Book) => {
    setEditingBook(book);
    const initialCover = (book.cover_url && book.cover_url.includes('/api/books/cover/')) ? '' : (book.cover_url || '');
    setEditForm({ 
      title: book.title, 
      author: book.author || '', 
      genre: book.genre || '', 
      summary: book.summary || '',
      cover_url: initialCover,
      external_url: book.external_url || ''
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editingBook) return;
    try {
      const payload: any = { ...editForm };
      if (!payload.cover_url || !payload.cover_url.trim() || payload.cover_url.includes('/api/books/cover/')) {
        delete payload.cover_url;
      }
      await axios.put(`${API_URL}/api/books/${editingBook.id}`, payload, {
        headers: getHeaders()
      });
      setIsEditModalOpen(false);
      refreshAllBookData();
    } catch (err: any) {
      if (err.response?.status === 401) {
        logout();
      } else {
        setError('Lỗi khi cập nhật sách!');
        setTimeout(() => setError(null), 3000);
      }
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
            ...getHeaders()
          }
        });
        uploadedCount++;
      } catch (err: any) {
        console.error(`Lỗi tải lên file ${item.file.name}:`, err);
        if (err.response?.status === 401) {
          logout();
          return;
        }
      }
    }
    
    setIsUploading(false);
    setIsAddModalOpen(false);
    setUploadItems([]);
    refreshAllBookData();
    if (uploadedCount > 0) {
       setSuccessMsg(`Đã tải lên thành công ${uploadedCount} sách!`);
       setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  const handleAddByLinkSubmit = async () => {
    if (!linkForm.title || !linkForm.external_url) {
       setUploadStatus({type: 'error', msg: "Vui lòng nhập tối thiểu Tên sách và Link Drive!"});
       setTimeout(() => setUploadStatus(null), 3000);
       return;
    }
    setIsUploading(true);
    try {
       await axios.post(`${API_URL}/api/books/link`, linkForm, {
         headers: getHeaders()
       });
       setIsUploading(false);
       setIsAddModalOpen(false);
       setLinkForm({ title: '', author: '', genre: '', cover_url: '', external_url: '' });
       refreshAllBookData();
       setSuccessMsg("Đã thêm sách thành công!");
       setTimeout(() => setSuccessMsg(null), 3000);
    } catch(err: any) {
       setIsUploading(false);
       if (err.response?.status === 401) {
         logout();
       } else {
         setUploadStatus({type: 'error', msg: err.response?.data?.detail || "Lỗi khi thêm sách bằng Link!"});
         setTimeout(() => setUploadStatus(null), 3000);
       }
    }
  };



  const copyShareLink = (id: string) => {
    const url = `${window.location.origin}/share/book/${id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Quản lý trạng thái lọc sách trùng
  const [isDuplicateFilterActive, setIsDuplicateFilterActive] = useState(false);

  // Nhóm các sách trùng lặp theo (Tên sách chuẩn hóa + Tác giả chuẩn hóa)
  const duplicateGroups = useMemo(() => {
    const map: { [key: string]: Book[] } = {};
    
    books.forEach(book => {
      const normTitle = normalizeTitle(book.title);
      if (!normTitle) return;
      const normAuthor = normalizeAuthor(book.author);
      const key = `${normTitle}:::${normAuthor}`;
      if (!map[key]) {
        map[key] = [];
      }
      map[key].push(book);
    });

    return Object.entries(map)
      .filter(([_, group]) => group.length >= 2)
      .map(([key, groupBooks], groupIdx) => ({
        key,
        groupIndex: groupIdx + 1,
        displayTitle: groupBooks[0].title,
        displayAuthor: groupBooks[0].author || 'Chưa rõ tác giả',
        books: groupBooks,
      }));
  }, [books]);

  const totalDuplicateBooks = useMemo(() => {
    return duplicateGroups.reduce((acc, g) => acc + g.books.length, 0);
  }, [duplicateGroups]);

  const duplicateRedundantCount = useMemo(() => {
    return duplicateGroups.reduce((acc, g) => acc + (g.books.length - 1), 0);
  }, [duplicateGroups]);

  // Danh sách các sách trùng kèm thông tin nhóm để hiển thị cạnh nhau
  const duplicateBooksWithInfo = useMemo(() => {
    const list: { book: Book; duplicateInfo: any }[] = [];
    duplicateGroups.forEach((group) => {
      group.books.forEach((b, bIdx) => {
        list.push({
          book: b,
          duplicateInfo: {
            groupIndex: group.groupIndex,
            copyIndex: bIdx + 1,
            totalInGroup: group.books.length,
            isRedundant: bIdx > 0, // Quy ước bản đầu tiên (index 0) là bản giữ lại, các bản sau là thừa
          }
        });
      });
    });
    return list;
  }, [duplicateGroups]);

  // Chọn toàn bộ các bản sao thừa (tất cả các bản từ vị trí thứ 2 trở đi trong mỗi nhóm trùng)
  const handleSelectAllDuplicates = () => {
    const redundantIds = duplicateBooksWithInfo
      .filter(item => item.duplicateInfo.isRedundant)
      .map(item => item.book.id);
    setSelectedBooks(redundantIds);
  };

  // Danh sách sách hiển thị trên grid
  const displayItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const brokenIds = new Set(brokenBooksList.map(b => b.id));

    if (isBrokenFilterActive) {
      const brokenOnly = books.filter(b => b.has_file === false || brokenIds.has(b.id));
      const filtered = q
        ? brokenOnly.filter(b => b.title.toLowerCase().includes(q) || (b.author && b.author.toLowerCase().includes(q)))
        : brokenOnly;
      return filtered.map(b => ({ book: b, duplicateInfo: null }));
    } else if (isDuplicateFilterActive) {
      if (!q) return duplicateBooksWithInfo;
      return duplicateBooksWithInfo.filter(item => 
        item.book.title.toLowerCase().includes(q) || 
        (item.book.author && item.book.author.toLowerCase().includes(q))
      );
    } else {
      const filtered = q
        ? books.filter(b => b.title.toLowerCase().includes(q) || (b.author && b.author.toLowerCase().includes(q)))
        : books;
      return filtered.map(b => ({ book: b, duplicateInfo: null }));
    }
  }, [isBrokenFilterActive, isDuplicateFilterActive, duplicateBooksWithInfo, books, brokenBooksList, searchQuery]);

  if (isLoading || !user || user.role !== 'admin') {
    return <div className="min-h-screen bg-[#D8C9BB] flex items-center justify-center font-bold text-[#7A6F68]">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[#D8C9BB] text-[#2A2320] pt-[70px] pb-4 px-3 sm:p-5 md:p-6 lg:p-7 flex flex-col md:flex-row gap-4 sm:gap-5 font-sans selection:bg-[#E5DACD]">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col gap-4 sm:gap-5">
        {/* Top Header Card (Phần Header) */}
        <header className="bg-[#FBF8F4] rounded-[28px] md:rounded-[36px] p-4 sm:p-6 shadow-[0_12px_32px_rgba(120,100,85,0.1)] border border-[#EFE8DE] flex flex-col gap-4">
          {/* Dòng 1: Tiêu đề Dashboard & Admin Navigation Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3 w-full">
            <div>
              <h1 className="text-xl md:text-2xl font-black text-[#2A2320] tracking-tight">Admin Dashboard</h1>
              <p className="text-xs text-[#7A6F68] font-medium mt-0.5">Quản lý toàn bộ kho sách, kiểm tra liên kết và xử lý dữ liệu</p>
            </div>
            <AdminTabs />
          </div>

          {/* Dòng 2: Nhóm công cụ kiểm tra, quản trị & Thêm sách */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-[#EFE8DE]">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Nút Kiểm tra file bị lỗi / mất liên kết */}
              <button 
                onClick={() => {
                  setIsCheckLinksOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold bg-[#FAF6F0] hover:bg-[#EFE8DE] text-[#1C1917] border border-[#E5DACD] transition-all cursor-pointer shadow-sm"
                title="Kiểm tra các cuốn sách chưa có file hoặc bị mất liên kết tải về"
              >
                <Link2 size={15} className="text-[#1B2A4A]" />
                <span>Kiểm tra file</span>
                {brokenFileCount !== null && brokenFileCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none bg-[#1B2A4A] text-white">
                    {brokenFileCount}
                  </span>
                )}
              </button>

              {/* Nút Lọc Sách Lỗi File */}
              {brokenFileCount !== null && brokenFileCount > 0 && (
                <button
                  onClick={() => {
                    setIsBrokenFilterActive(!isBrokenFilterActive);
                    if (!isBrokenFilterActive) {
                      setIsDuplicateFilterActive(false);
                      setSearchQuery('');
                      setIsSortMode(false);
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold transition-all cursor-pointer shadow-sm border ${
                    isBrokenFilterActive 
                      ? 'bg-[#1B2A4A] text-white border-transparent' 
                      : 'bg-[#EFE8DE] text-[#1C1917] border-[#E0D5C7] hover:bg-[#E5DACD]'
                  }`}
                  title="Chỉ hiển thị các cuốn sách chưa thể tải về trên bảng quản trị"
                >
                  <AlertTriangle size={15} />
                  <span>Sách lỗi file</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none ${isBrokenFilterActive ? 'bg-white text-[#1B2A4A]' : 'bg-[#1B2A4A] text-white'}`}>
                    {brokenFileCount}
                  </span>
                </button>
              )}

              {/* Nút Lọc Sách Trùng */}
              <button
                onClick={() => {
                  setIsDuplicateFilterActive(!isDuplicateFilterActive);
                  if (!isDuplicateFilterActive) {
                    setIsBrokenFilterActive(false);
                    setSearchQuery('');
                    setIsSortMode(false);
                  }
                }}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold transition-all cursor-pointer shadow-sm border ${
                  isDuplicateFilterActive 
                    ? 'bg-[#1B2A4A] text-white border-[#1B2A4A]' 
                    : 'bg-[#FAF6F0] hover:bg-[#EFE8DE] text-[#2A2320] border-[#E5DACD]'
                }`}
                title="Lọc các cuốn sách bị trùng lặp tên & tác giả"
              >
                <Copy size={15} />
                <span>Lọc trùng</span>
                {duplicateRedundantCount > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none ${isDuplicateFilterActive ? 'bg-white text-[#1B2A4A]' : 'bg-[#1B2A4A] text-white'}`}>
                    {duplicateRedundantCount}
                  </span>
                )}
              </button>

              {/* Bulk Delete button when items selected */}
              {selectedBooks.length > 0 && (
                <button 
                  onClick={handleBulkDelete}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold bg-[#EB5757] hover:bg-red-600 text-white transition-all shadow-md cursor-pointer border-none"
                >
                  <Trash2 size={15} className="text-white" />
                  <span>Xóa {selectedBooks.length}</span>
                </button>
              )}

              {/* Sửa bìa */}
              <button 
                onClick={handleFixCovers}
                disabled={isFixing}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold bg-[#FAF6F0] hover:bg-[#EFE8DE] text-[#2A2320] border border-[#E5DACD] transition-all cursor-pointer disabled:opacity-50 shadow-sm"
                title="Tự động sửa ảnh bìa bị lỗi"
              >
                {isFixing ? <Loader2 size={15} className="animate-spin text-[#7A6F68]" /> : <Settings size={15} className="text-[#7A6F68]" />}
                <span className="hidden sm:inline">{isFixing ? 'Đang sửa...' : 'Sửa bìa'}</span>
              </button>

              {/* Sắp xếp */}
              {isSortMode ? (
                <button 
                  onClick={handleSaveOrder}
                  disabled={isSavingOrder}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold bg-[#2A2320] text-white hover:bg-black transition-all shadow-md cursor-pointer border-none"
                >
                  {isSavingOrder ? <Loader2 size={15} className="animate-spin text-white" /> : <Save size={15} className="text-white" />}
                  <span>Lưu thứ tự</span>
                </button>
              ) : (
                <button 
                  onClick={() => { setIsSortMode(true); setSearchQuery(''); setIsDuplicateFilterActive(false); }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold bg-[#FAF6F0] hover:bg-[#EFE8DE] text-[#2A2320] border border-[#E5DACD] transition-all cursor-pointer shadow-sm"
                  title="Thay đổi thứ tự sắp xếp sách"
                >
                  <GripVertical size={15} className="text-[#7A6F68]" />
                  <span>Sắp xếp</span>
                </button>
              )}

              {/* Đường phân cách thẩm mỹ */}
              <div className="h-6 w-px bg-[#E5DACD] mx-1 hidden sm:block shrink-0" />
            </div>

            {/* Nút Hành Động Chính: Thêm Sách */}
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="btn-gradient flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-black text-white hover:opacity-95 transition-all shadow-md cursor-pointer shrink-0 border-none"
            >
              <Plus size={16} className="text-white stroke-[3]" />
              <span>Thêm Sách</span>
            </button>
          </div>

          {/* Dòng 3: Số lượng sách & Ô tìm kiếm */}
          <div className="flex items-center justify-between gap-3 w-full pt-3 border-t border-[#EFE8DE]">
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold px-3.5 py-1.5 bg-[#FAF6F0] border border-[#E5DACD] text-[#7A6F68] rounded-full flex items-center gap-2 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                <span>{books.length} cuốn sách</span>
              </span>
            </div>

            {/* Search Input */}
            <div className="relative w-full max-w-xs sm:max-w-sm">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A0958C]" size={14} />
              <input 
                type="text" 
                placeholder="Tìm tên sách, tác giả..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#FAF6F0] border border-[#E5DACD] rounded-full py-2 pl-9 pr-8 text-xs font-medium text-[#1C1917] placeholder-[#57534E] focus:outline-none focus:border-[#1B2A4A] transition-all shadow-sm"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A0958C] hover:text-[#2A2320] cursor-pointer">
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Card (Phần Trang Chính) */}
        <main className="flex-1 min-w-0 bg-[#FBF8F4] rounded-[28px] md:rounded-[36px] p-4 sm:p-6 md:p-8 shadow-[0_16px_40px_rgba(120,100,85,0.12)] border border-[#EFE8DE] flex flex-col">
          <section className="flex-1">
          {/* Banner hướng dẫn và xử lý trùng lặp */}
          {isDuplicateFilterActive && (
            duplicateGroups.length === 0 ? (
              <div className="bg-[#FAF6F0] border border-[#ECE2D5] rounded-3xl p-8 text-center my-4 shadow-sm">
                <Check size={32} className="mx-auto text-emerald-600 mb-3" />
                <h3 className="text-base font-bold text-[#2A2320]">Không phát hiện cuốn sách nào bị trùng lặp</h3>
                <p className="text-xs text-[#7A6F68] mt-1 max-w-md mx-auto">
                  Hệ thống đã đối soát toàn bộ {books.length} cuốn sách theo tên & tác giả (đã hỗ trợ đảo họ tên và bỏ dấu tiếng Việt).
                </p>
                <button 
                  onClick={() => setIsDuplicateFilterActive(false)}
                  className="mt-4 px-5 py-2.5 font-bold text-xs rounded-full bg-[#2A2320] text-white hover:bg-black cursor-pointer transition-all shadow-md inline-flex items-center justify-center gap-2"
                >
                  <span>Quay lại xem tất cả sách</span>
                </button>
              </div>
            ) : (
              <div className="bg-[#FAF6F0] border border-[#ECE2D5] rounded-3xl p-5 mb-6 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-[#EFE8DE] border border-[#E5DACD] rounded-2xl text-[#2A2320] shrink-0">
                      <Copy size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm md:text-base font-black text-[#2A2320]">
                          Phát hiện {duplicateGroups.length} nhóm sách trùng lặp ({totalDuplicateBooks} cuốn)
                        </h3>
                        <span className="text-[11px] font-bold px-2.5 py-0.5 bg-red-100 text-red-600 border border-red-200 rounded-full">
                          {duplicateRedundantCount} bản sao thừa
                        </span>
                      </div>
                      <p className="text-xs text-[#7A6F68] mt-1">
                        Hệ thống đã nhận diện thông minh tên sách và họ tên tác giả (ví dụ: &ldquo;Higashino Keigo&rdquo; = &ldquo;Keigo Higashino&rdquo;).
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    <button
                      onClick={handleSelectAllDuplicates}
                      className="flex-1 md:flex-initial px-4 py-2 bg-[#2A2320] hover:bg-black text-white text-xs font-bold rounded-full transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Check size={14} />
                      <span>Chọn {duplicateRedundantCount} bản thừa để xóa</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsDuplicateFilterActive(false);
                        setSelectedBooks([]);
                      }}
                      className="px-3.5 py-2 text-xs font-bold text-[#7A6F68] hover:text-[#2A2320] cursor-pointer"
                    >
                      Thoát lọc
                    </button>
                  </div>
                </div>
              </div>
            )
          )}

          {isFetchingBooks ? (
            <div className="flex flex-col items-center justify-center mt-32 max-w-md mx-auto w-full px-4">
               <div className="w-full bg-[#EFE8DE] border border-[#E5DACD] rounded-full h-3 mb-3 shadow-inner overflow-hidden">
                 <div className="btn-gradient h-full rounded-full transition-all duration-300" style={{ width: `${downloadProgress}%` }}></div>
               </div>
               <span className="text-sm font-bold text-[#7A6F68] animate-pulse">Đang tải danh sách sách... {downloadProgress}%</span>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={displayItems.map(item => item.book.id)} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-4 md:gap-x-5 gap-y-6 md:gap-y-8">
                  {displayItems.map(({ book, duplicateInfo }) => (
                    <SortableBookItem 
                      key={book.id} 
                      book={book} 
                      isSortMode={isSortMode} 
                      selectedBooks={selectedBooks} 
                      toggleBookSelection={toggleBookSelection} 
                      setDownloadingId={setDownloadingId} 
                      downloadingId={downloadingId} 
                      baseUrl={baseUrl} 
                      copyShareLink={copyShareLink} 
                      copiedId={copiedId} 
                      openEditModal={openEditModal} 
                      handleDelete={handleDelete}
                      duplicateInfo={duplicateInfo}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {successMsg && (
            <div className="text-center bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-2xl text-sm font-bold mt-10">
              {successMsg}
            </div>
          )}

          {error && (
            <div className="text-center bg-red-50 border border-red-200 text-red-600 p-4 rounded-2xl text-sm font-bold mt-10">
              {error}
            </div>
          )}

          {!isFetchingBooks && displayItems.length === 0 && !error && (
            <div className="text-center text-[#7A6F68] text-sm mt-10">No books found.</div>
          )}
        </section>
      </main>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
           <div className="bg-[#FBF8F4] text-[#2A2320] border border-[#ECE2D5] rounded-[36px] w-full max-w-4xl p-6 md:p-8 shadow-2xl relative max-h-[90vh] flex flex-col">
              <button onClick={() => setIsEditModalOpen(false)} className="absolute top-4 right-4 md:top-6 md:right-6 p-2 bg-[#FAF6F0] rounded-full text-[#7A6F68] hover:text-[#2A2320] transition-colors border border-[#ECE2D5] cursor-pointer"><X size={16}/></button>
              <h3 className="text-xl md:text-2xl font-black mb-4 md:mb-6 text-[#2A2320] shrink-0">Chỉnh sửa sách</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 overflow-y-auto flex-1 pr-2">
                {/* Left Column - Details */}
                <div className="space-y-4 md:space-y-5">
                  <div>
                    <label className="text-xs font-bold text-[#57534E] block mb-1.5">Tên sách</label>
                    <input type="text" className="w-full bg-[#FAF6F0] border border-[#E5DACD] text-[#1C1917] rounded-xl px-3.5 py-2.5 text-xs font-medium focus:outline-none focus:border-[#1B2A4A]" value={editForm.title} onChange={e=>setEditForm({...editForm, title: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[#57534E] block mb-1.5">Tác giả</label>
                    <input type="text" className="w-full bg-[#FAF6F0] border border-[#E5DACD] text-[#1C1917] rounded-xl px-3.5 py-2.5 text-xs font-medium focus:outline-none focus:border-[#1B2A4A]" value={editForm.author} onChange={e=>setEditForm({...editForm, author: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-[#57534E] block mb-1.5">Thể loại</label>
                      <input type="text" className="w-full bg-[#FAF6F0] border border-[#E5DACD] text-[#1C1917] rounded-xl px-3.5 py-2.5 text-xs font-medium focus:outline-none focus:border-[#1B2A4A]" value={editForm.genre} onChange={e=>setEditForm({...editForm, genre: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-[#1B2A4A] block mb-1.5">Google Drive Link</label>
                      <input type="text" className="w-full bg-[#FAF6F0] border border-[#E5DACD] text-[#1C1917] rounded-xl px-3.5 py-2.5 text-xs font-medium focus:outline-none focus:border-[#1B2A4A]" placeholder="Optional URL" value={editForm.external_url} onChange={e=>setEditForm({...editForm, external_url: e.target.value})} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[#57534E] block mb-1.5">Tóm tắt</label>
                    <textarea className="w-full bg-[#FAF6F0] border border-[#E5DACD] text-[#1C1917] rounded-xl px-3.5 py-2.5 text-xs font-medium focus:outline-none focus:border-[#1B2A4A] h-32 md:h-36 resize-none leading-relaxed" value={editForm.summary} onChange={e=>setEditForm({...editForm, summary: e.target.value})} />
                  </div>
                </div>

                {/* Right Column - Cover */}
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-[#57534E] block mb-1.5">Ảnh bìa</label>
                  <div className="flex gap-2 mb-4">
                    <input type="text" className="flex-1 bg-[#FAF6F0] border border-[#E5DACD] text-[#1C1917] rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-[#1B2A4A]" value={editForm.cover_url} placeholder="Dán link hoặc tải ảnh lên ->" onChange={e=>setEditForm({...editForm, cover_url: e.target.value})} />
                    <label className="px-4 py-2 bg-[#EFE8DE] hover:bg-[#E5DACD] text-[#2A2320] rounded-xl text-xs font-bold cursor-pointer whitespace-nowrap border border-[#E5DACD] transition-colors flex items-center">
                      Upload
                      <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
                    </label>
                  </div>
                  <div className="bg-[#FAF6F0] border border-[#ECE2D5] rounded-2xl flex items-center justify-center flex-1 min-h-[200px] md:min-h-[280px] p-4 overflow-hidden">
                    {editForm.cover_url ? (
                      <img src={getCoverUrl(editForm.cover_url)} className="max-h-[200px] md:max-h-[260px] rounded-lg object-contain shadow-sm" alt="cover preview" 
                           onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_COVER_SVG; }} />
                    ) : editingBook ? (
                      <div className="w-full max-w-[160px] aspect-[2/3]">
                        <BookCoverImage coverUrl={editingBook.cover_url} bookId={editingBook.id} title={editingBook.title} author={editingBook.author} />
                      </div>
                    ) : (
                      <span className="text-[#A0958C] text-sm font-medium">Chưa có ảnh bìa</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 md:mt-8 pt-4 md:pt-5 border-t border-[#EFE8DE] flex justify-end gap-3 shrink-0">
                 <button onClick={() => setIsEditModalOpen(false)} className="px-5 py-2.5 text-xs font-bold text-[#7A6F68] hover:text-[#2A2320] bg-[#FAF6F0] hover:bg-[#EFE8DE] border border-[#E5DACD] rounded-full cursor-pointer transition-colors">Hủy</button>
                 <button onClick={handleEditSubmit} className="btn-gradient !py-2.5 !px-6 text-xs font-bold text-white rounded-full shadow-md cursor-pointer border-none hover:opacity-95 transition-all">Lưu thay đổi</button>
              </div>
           </div>
        </div>
      )}

      {/* Add Modal (Bulk Upload + Links) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
           <div className="bg-[#FBF8F4] text-[#2A2320] border border-[#ECE2D5] rounded-[36px] w-full max-w-2xl p-6 md:p-8 shadow-2xl relative max-h-[90vh] flex flex-col">
              <button onClick={() => {setIsAddModalOpen(false); setUploadItems([]); setAddMode('upload');}} className="absolute top-6 right-6 p-2 bg-[#FAF6F0] rounded-full text-[#7A6F68] hover:text-[#2A2320] border border-[#ECE2D5] cursor-pointer"><X size={16}/></button>
              
              <div className="flex gap-4 mb-6 border-b border-[#EFE8DE]">
                 <button 
                    className={`pb-3 text-base font-bold px-3 transition-colors cursor-pointer ${addMode === 'upload' ? 'text-[#2A2320] border-b-2 border-[#2A2320]' : 'text-[#A0958C] hover:text-[#2A2320]'}`}
                    onClick={() => setAddMode('upload')}
                 >
                    Upload Sách (PDF/EPUB)
                 </button>
                 <button 
                    className={`pb-3 text-base font-bold px-3 transition-colors cursor-pointer ${addMode === 'link' ? 'text-[#2A2320] border-b-2 border-[#2A2320]' : 'text-[#A0958C] hover:text-[#2A2320]'}`}
                    onClick={() => setAddMode('link')}
                 >
                    Thêm Nhanh (Bằng Link)
                 </button>
              </div>

              {uploadStatus && (
                <div className={`p-3.5 rounded-2xl mb-4 text-xs font-bold ${uploadStatus.type === 'error' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                  {uploadStatus.msg}
                </div>
              )}
              
              <div className="flex-1 overflow-y-auto pr-2 space-y-4 min-h-[200px]">
                {addMode === 'upload' ? (
                  <>
                    {/* Khu vực chọn file */}
                    <div className="border-2 border-dashed border-[#D8C9BB] bg-[#FAF6F0] hover:bg-[#FAF0E6] rounded-2xl p-8 text-center cursor-pointer transition-colors relative">
                      <input type="file" multiple accept=".pdf,.epub" className="absolute opacity-0 cursor-pointer inset-0 z-10" onChange={handleFileSelect} />
                      <Upload size={32} className="mx-auto text-[#7A6F68] mb-2" />
                      <p className="text-xs font-bold text-[#2A2320]">Nhấp chuột hoặc kéo thả nhiều file PDF/EPUB vào đây</p>
                    </div>

                    {/* Smart Paste Block */}
                    {uploadItems.length > 0 && uploadItems.some(item => !item.external_url) && (
                      <div className="bg-[#FAF6F0] border border-[#ECE2D5] p-4 rounded-2xl mt-4">
                        <h4 className="text-xs font-black text-[#1B2A4A] mb-1.5">Smart Auto-Match</h4>
                        <p className="text-[11px] text-[#57534E] mb-3">Dán danh sách theo định dạng <b>Tên Sách - Link Drive</b>, hệ thống sẽ tự động ghép đúng link vào đúng sách bất chấp thứ tự!</p>
                        <div className="flex flex-col gap-2">
                          <textarea 
                            placeholder="Tên Sách 1 - https://drive...&#10;Tên Sách 2 - https://drive..." 
                            className="w-full bg-white border border-[#E5DACD] text-[#1C1917] rounded-xl p-3 text-xs font-medium focus:outline-none focus:border-[#1B2A4A] min-h-[100px] resize-y leading-relaxed"
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
                                  setUploadStatus({type: 'error', msg: "Trình duyệt chặn quyền Clipboard. Vui lòng dán thủ công bằng Ctrl+V"});
                                  setTimeout(() => setUploadStatus(null), 3000);
                                }
                              }}
                              className="px-3.5 py-2 text-xs font-bold rounded-xl bg-white border border-[#E5DACD] text-[#1C1917] hover:bg-[#FAF6F0] flex items-center gap-1 shadow-sm cursor-pointer"
                            >
                              Dán (Paste)
                            </button>
                            <button 
                              onClick={handleSmartPaste}
                              disabled={!smartPasteText}
                              className="btn-gradient px-4 py-2 text-xs font-black text-white rounded-xl disabled:opacity-50 whitespace-nowrap cursor-pointer shadow-sm border-none"
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
                        <h4 className="text-xs font-black text-[#1C1917] border-b border-[#EFE8DE] pb-2">Selected Files ({uploadItems.length})</h4>
                        {uploadItems.map((item, index) => (
                          <div key={index} className="flex flex-col gap-2 p-3.5 bg-[#FAF6F0] rounded-2xl border border-[#ECE2D5] relative group">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-xs text-[#1C1917] truncate pr-4">{item.file.name}</span>
                              <button onClick={() => setUploadItems(items => items.filter((_, i) => i !== index))} className="text-[#8C827A] hover:text-red-500 cursor-pointer"><Trash2 size={15}/></button>
                            </div>
                            <div className="flex items-center gap-2">
                              <LinkIcon size={14} className="text-[#57534E] shrink-0"/>
                              <input 
                                type="text" 
                                placeholder="Paste Google Drive Link here..." 
                                className="w-full bg-white border border-[#E5DACD] text-[#1C1917] rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:border-[#1B2A4A]"
                                value={item.external_url}
                                onChange={(e) => {
                                  const newItems = [...uploadItems];
                                  newItems[index].external_url = e.target.value;
                                  setUploadItems(newItems);
                                }}
                              />
                              <button
                                onClick={async () => {
                                  try {
                                    const text = await navigator.clipboard.readText();
                                    const newItems = [...uploadItems];
                                    newItems[index].external_url = text;
                                    setUploadItems(newItems);
                                  } catch (err) {
                                    setUploadStatus({type: 'error', msg: "Trình duyệt chặn quyền Clipboard. Vui lòng dán thủ công"});
                                    setTimeout(() => setUploadStatus(null), 3000);
                                  }
                                }}
                                className="py-1.5 px-3 text-[10px] font-bold rounded-xl border border-[#E5DACD] bg-white text-[#1C1917] hover:bg-[#FAF6F0] whitespace-nowrap shadow-sm transition-colors cursor-pointer"
                              >
                                Paste
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-4">
                    <p className="text-xs text-[#1B2A4A] bg-[#FAF6F0] p-3 rounded-2xl border border-[#ECE2D5] leading-relaxed font-semibold">
                      Thêm sách nhanh chóng không cần Upload file EPUB/PDF. Giúp tiết kiệm 100% băng thông tải lên và tự động lấy ảnh bìa từ đường link bạn cung cấp!
                    </p>
                    <div><label className="text-xs font-bold text-[#57534E] block mb-1.5">Tên Sách <span className="text-red-500">*</span></label><input type="text" className="w-full bg-[#FAF6F0] border border-[#E5DACD] text-[#1C1917] rounded-xl px-3.5 py-2.5 text-xs font-medium focus:outline-none focus:border-[#1B2A4A]" value={linkForm.title} onChange={e=>setLinkForm({...linkForm, title: e.target.value})} /></div>
                    <div><label className="text-xs font-bold text-[#57534E] block mb-1.5">Tác Giả</label><input type="text" className="w-full bg-[#FAF6F0] border border-[#E5DACD] text-[#1C1917] rounded-xl px-3.5 py-2.5 text-xs font-medium focus:outline-none focus:border-[#1B2A4A]" value={linkForm.author} onChange={e=>setLinkForm({...linkForm, author: e.target.value})} /></div>
                    <div><label className="text-xs font-bold text-[#57534E] block mb-1.5">Thể Loại</label><input type="text" className="w-full bg-[#FAF6F0] border border-[#E5DACD] text-[#1C1917] rounded-xl px-3.5 py-2.5 text-xs font-medium focus:outline-none focus:border-[#1B2A4A]" value={linkForm.genre} onChange={e=>setLinkForm({...linkForm, genre: e.target.value})} /></div>
                    <div><label className="text-xs font-bold text-[#57534E] block mb-1.5">Link Google Drive <span className="text-red-500">*</span></label><input type="text" className="w-full bg-[#FAF6F0] border border-[#E5DACD] text-[#1C1917] rounded-xl px-3.5 py-2.5 text-xs font-medium focus:outline-none focus:border-[#1B2A4A]" placeholder="https://drive.google.com/..." value={linkForm.external_url} onChange={e=>setLinkForm({...linkForm, external_url: e.target.value})} /></div>
                    <div><label className="text-xs font-bold text-[#57534E] block mb-1.5">Link Ảnh Bìa (Cover URL)</label><input type="text" className="w-full bg-[#FAF6F0] border border-[#E5DACD] text-[#1C1917] rounded-xl px-3.5 py-2.5 text-xs font-medium focus:outline-none focus:border-[#1B2A4A]" placeholder="https://..." value={linkForm.cover_url} onChange={e=>setLinkForm({...linkForm, cover_url: e.target.value})} /></div>
                  </div>
                )}
              </div>
              <div className="mt-6 pt-4 border-t border-[#EFE8DE] shrink-0">
                 {addMode === 'upload' ? (
                   <button 
                     onClick={handleBulkUploadSubmit} 
                     disabled={isUploading || uploadItems.length === 0}
                     className="btn-gradient w-full !py-3 rounded-full text-white font-bold shadow-md cursor-pointer border-none text-xs hover:opacity-95 transition-all"
                   >
                     {isUploading ? 'Uploading...' : `Upload All ${uploadItems.length} Books`}
                   </button>
                 ) : (
                   <button 
                     onClick={handleAddByLinkSubmit} 
                     disabled={isUploading || !linkForm.title || !linkForm.external_url}
                     className="btn-gradient w-full !py-3 rounded-full text-white font-bold shadow-md cursor-pointer border-none text-xs hover:opacity-95 transition-all"
                   >
                     {isUploading ? 'Đang thêm...' : 'Thêm Sách Nhanh'}
                   </button>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* Check File Links Modal */}
      <CheckFileLinksModal
        isOpen={isCheckLinksOpen}
        onClose={() => setIsCheckLinksOpen(false)}
        initialBrokenBooks={brokenBooksList}
        initialBrokenCount={brokenFileCount}
        refreshKey={checkLinksRefreshKey}
        onOpenSearchOnline={(q, targetId) => {
          setSearchOnlineQuery(q);
          setSearchOnlineTargetBookId(targetId || null);
          setIsSearchOnlineOpen(true);
        }}
        onOpenEditBook={(bookId) => {
          const b = books.find(item => item.id === bookId);
          if (b) {
            openEditModal(b);
          }
        }}
        onSuccess={() => {
          refreshAllBookData();
        }}
      />

      {/* Online Book Search Modal */}
      <SearchOnlineModal
        isOpen={isSearchOnlineOpen}
        onClose={() => {
          setIsSearchOnlineOpen(false);
          setSearchOnlineTargetBookId(null);
          setSearchOnlineQuery('');
        }}
        onImportSuccess={() => {
          refreshAllBookData();
        }}
        initialQuery={searchOnlineQuery}
        targetBookId={searchOnlineTargetBookId}
      />
    </div>
  );
}
