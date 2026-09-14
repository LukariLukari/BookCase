'use client';
import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/contexts/AuthContext';
import Sidebar from '@/components/Sidebar';
import { Search, Plus, Edit2, Trash2, Link as LinkIcon, Upload, X, Share2, Check, Loader2, Settings, Download, GripVertical, Save, Copy, Unlink2, AlertTriangle } from 'lucide-react';

import { getCoverUrl, DEFAULT_COVER_SVG } from '@/utils/image';
import BookCoverImage from '@/components/BookCoverImage';

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
    .replace(/Đ/g, 'd');
  return str.split(/\s+/).filter(Boolean).join(' ');
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
    <div ref={setNodeRef} style={style} className={`flex flex-col group relative ${isSortMode ? 'cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-[#D7C9B2] rounded-2xl' : ''}`}>
      {isSortMode && (
         <div {...attributes} {...listeners} className="absolute top-2 left-2 z-40 bg-black/60 p-1.5 rounded-lg text-white hover:bg-[#F5ECDC] hover:text-[#1F1D20] transition-colors backdrop-blur-sm cursor-grab">
           <GripVertical size={16} />
         </div>
      )}
      <div className={`w-full aspect-[2/3] relative z-10 mb-3 rounded-2xl overflow-hidden shadow-sm border ${
        duplicateInfo && duplicateInfo.isRedundant 
          ? 'border-red-500/50 shadow-red-950/20' 
          : 'border-[#4D4845]/40'
      } transition-all duration-300 ${!isSortMode ? 'group-hover:shadow-xl' : ''}`}>
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
                 className="w-5 h-5 rounded-md border-2 border-white/80 bg-black/40 checked:bg-orange-500 checked:border-orange-500 cursor-pointer shadow-sm focus:ring-0 focus:ring-offset-0 transition-colors"
               />
             </div>

             {duplicateInfo && (
               <div className="absolute top-2 right-9 z-20">
                 <span className={`text-[10px] font-black px-2 py-0.5 rounded-md backdrop-blur-md shadow-sm border ${
                   duplicateInfo.isRedundant 
                     ? 'bg-red-950/90 text-red-200 border-red-700/60' 
                     : 'bg-[#1F1D20]/90 text-[#F5ECDC] border-[#4D4845]/80'
                 }`}>
                   {duplicateInfo.isRedundant ? `Bản thừa #${duplicateInfo.copyIndex}` : 'Bản gốc'}
                 </span>
               </div>
             )}
             
             <div className="absolute top-2 left-2 z-20">
               {book.external_url ? (
                 <span className="flex items-center gap-1 text-orange-400 font-bold bg-[#1F1D20]/90 backdrop-blur px-2 py-1 rounded-lg text-[10px] shadow-sm border border-orange-500/30" title={book.external_url}>
                   <LinkIcon size={12} /> Drive
                 </span>
               ) : (
                 <span className="flex items-center gap-1 text-[#D7C9B2] font-bold bg-[#1F1D20]/90 backdrop-blur px-2 py-1 rounded-lg text-[10px] shadow-sm border border-[#4D4845]/40">
                   <Upload size={12} /> Local
                 </span>
               )}
             </div>

             <div className="absolute bottom-2 right-2 flex items-center gap-1.5 z-20">
                 <button 
                   onClick={() => {
                     setDownloadingId(book.id);
                     const a = document.createElement('a');
                     a.href = `${baseUrl}/api/books/${book.id}/download`;
                     a.download = `${book.title}.pdf`;
                     document.body.appendChild(a);
                     a.click();
                     a.remove();
                     setTimeout(() => setDownloadingId(null), 1500);
                   }} 
                   disabled={downloadingId === book.id}
                   className="p-1.5 md:p-2 bg-[#F97316] text-white hover:bg-[#EA580C] rounded-full shadow-lg border border-[#F97316] transition-all hover:scale-110 cursor-pointer disabled:opacity-50" 
                   title="Tải sách xuống"
                 >
                   {downloadingId === book.id ? <Loader2 size={14} className="animate-spin text-white" /> : <Download size={14} className="text-white" />}
                 </button>
                 <button 
                   onClick={() => copyShareLink(book.id)} 
                   className="p-1.5 md:p-2 bg-[#1F1D20]/95 text-[#F5ECDC] hover:text-green-400 hover:bg-[#2A272A] rounded-full shadow-lg border border-[#4D4845]/50 transition-all hover:scale-110 cursor-pointer" 
                   title="Sao chép link chia sẻ"
                 >
                   {copiedId === book.id ? <Check size={14} className="text-green-400" /> : <Share2 size={14} className="text-[#D7C9B2] hover:text-green-400" />}
                 </button>

                 <button 
                   onClick={() => openEditModal(book)} 
                   className="p-1.5 md:p-2 bg-[#1F1D20]/95 text-[#F5ECDC] hover:text-orange-400 hover:bg-[#2A272A] rounded-full shadow-lg border border-[#4D4845]/50 transition-all hover:scale-110 cursor-pointer" 
                   title="Sửa thông tin sách"
                 >
                   <Edit2 size={14} className="text-[#D7C9B2] hover:text-orange-400" />
                 </button>
                 <button 
                   onClick={() => handleDelete(book.id)} 
                   className="p-1.5 md:p-2 bg-[#1F1D20]/95 text-[#F5ECDC] hover:text-red-400 hover:bg-[#2A272A] rounded-full shadow-lg border border-[#4D4845]/50 transition-all hover:scale-110 cursor-pointer" 
                   title="Xóa sách"
                 >
                   <Trash2 size={14} className="text-[#D7C9B2] hover:text-red-400" />
                 </button>
              </div>
           </>
         )}
      </div>
      
      <div className="px-1">
        <h3 className="text-sm font-bold text-[#F5ECDC] leading-tight line-clamp-2">{book.title}</h3>
        <p className="text-xs text-[#D7C9B2] font-semibold mt-1 truncate">{book.author || 'Chưa rõ tác giả'}</p>
        {duplicateInfo && (
          <p className="text-[10px] font-bold text-[#7B7369] mt-0.5">
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

  // File Health / Broken Links Check & Sync State
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncFiles, setSyncFiles] = useState<File[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<string | null>(null);
  const [brokenFileCount, setBrokenFileCount] = useState<number | null>(null);
  const [brokenBooksList, setBrokenBooksList] = useState<{ id: string; title: string; author?: string; reason?: string }[]>([]);
  const [isCheckingFiles, setIsCheckingFiles] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    success: boolean;
    total_files: number;
    matched_count: number;
    created_count: number;
    matched_books: any[];
    created_books: any[];
  } | null>(null);


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
      fetchBooks();
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
      fetchBooks();
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
      fetchBooks();
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
    fetchBooks();
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
       fetchBooks();
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

  const handleSyncFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSyncFiles(prev => [...prev, ...files]);
      setSyncResult(null);
    }
  };

  const handleSyncDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const files = Array.from(e.dataTransfer.files).filter(f => 
        f.name.toLowerCase().endsWith('.epub') || f.name.toLowerCase().endsWith('.pdf')
      );
      setSyncFiles(prev => [...prev, ...files]);
      setSyncResult(null);
    }
  };

  const handleSyncFilesSubmit = async () => {
    if (syncFiles.length === 0) return;
    setIsSyncing(true);
    setSyncResult(null);
    setSyncProgress('Đang chuẩn bị dữ liệu gửi lên máy chủ...');

    const BATCH_SIZE = 5;
    let totalMatched = 0;
    let totalCreated = 0;
    const allMatched: any[] = [];
    const allCreated: any[] = [];

    for (let i = 0; i < syncFiles.length; i += BATCH_SIZE) {
      const chunk = syncFiles.slice(i, i + BATCH_SIZE);
      setSyncProgress(`Đang nạp file ${i + 1} - ${Math.min(i + BATCH_SIZE, syncFiles.length)} / ${syncFiles.length}...`);

      const formData = new FormData();
      chunk.forEach(f => formData.append('files', f));

      try {
        const res = await axios.post(`${API_URL}/api/admin/books/sync-files`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            ...getHeaders()
          }
        });
        if (res.data.success) {
          totalMatched += res.data.matched_count;
          totalCreated += res.data.created_count;
          if (res.data.matched_books) allMatched.push(...res.data.matched_books);
          if (res.data.created_books) allCreated.push(...res.data.created_books);
        }
      } catch (err: any) {
        console.error('Lỗi khi gửi chunk sync file:', err);
      }
    }

    setIsSyncing(false);
    setSyncProgress(null);
    setSyncResult({
      success: true,
      total_files: syncFiles.length,
      matched_count: totalMatched,
      created_count: totalCreated,
      matched_books: allMatched,
      created_books: allCreated
    });
    fetchBooks();
    fetchBrokenFiles();
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
    if (isDuplicateFilterActive) {
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
  }, [isDuplicateFilterActive, duplicateBooksWithInfo, books, searchQuery]);

  if (isLoading || !user || user.role !== 'admin') {
    return <div className="min-h-screen bg-[#1F1D20] flex items-center justify-center font-bold text-[#D7C9B2]">Loading...</div>;
  }

  return (
    <div className="flex bg-[#1F1D20] text-[#F5ECDC] min-h-screen font-sans selection:bg-orange-950/60">
      <Sidebar />
      <div className="flex-1 min-w-0 md:ml-64 pt-16 md:pt-0 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="sticky top-16 md:top-0 z-30 bg-[#1F1D20]/95 backdrop-blur-md px-4 py-3.5 md:px-6 md:py-4 border-b border-[#4D4845]/40 flex flex-col gap-3">
          {/* Dòng 1: Tiêu đề Dashboard & Các nút công cụ + Thêm sách */}
          <div className="flex flex-wrap items-center justify-between gap-3 w-full">
            <h1 className="text-xl md:text-2xl font-black text-[#F5ECDC] tracking-tight">Admin Dashboard</h1>

            {/* Nhóm công cụ kiểm tra, quản trị & Thêm sách */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Nút Kiểm tra file bị lỗi / mất liên kết */}
              <button 
                onClick={() => {
                  setIsSyncModalOpen(true);
                  setSyncFiles([]);
                  setSyncResult(null);
                  setSyncProgress(null);
                  fetchBrokenFiles();
                }}
                style={{ 
                  backgroundColor: '#2A272A', 
                  color: '#F5ECDC', 
                  borderColor: brokenFileCount && brokenFileCount > 0 ? '#F59E0B' : '#4D4845' 
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black border hover:border-[#D7C9B2] transition-all cursor-pointer shadow-sm"
                title="Kiểm tra các cuốn sách chưa có file hoặc bị mất liên kết tải về"
              >
                <Unlink2 size={15} style={{ color: brokenFileCount && brokenFileCount > 0 ? '#F59E0B' : '#D7C9B2' }} />
                <span>Kiểm tra file</span>
                {brokenFileCount !== null && brokenFileCount > 0 && (
                  <span 
                    style={{ backgroundColor: '#D97706', color: '#FFFFFF' }}
                    className="px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none"
                  >
                    {brokenFileCount}
                  </span>
                )}
              </button>

              {/* Nút Lọc Sách Trùng */}
              <button
                onClick={() => {
                  setIsDuplicateFilterActive(!isDuplicateFilterActive);
                  if (!isDuplicateFilterActive) {
                    setSearchQuery('');
                    setIsSortMode(false);
                  }
                }}
                style={{
                  backgroundColor: isDuplicateFilterActive ? '#F5ECDC' : '#2A272A',
                  color: isDuplicateFilterActive ? '#181618' : (duplicateGroups.length > 0 ? '#F5ECDC' : '#7B7369'),
                  borderColor: isDuplicateFilterActive ? '#F5ECDC' : '#4D4845',
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer border shadow-sm"
                title="Lọc các cuốn sách bị trùng lặp tên & tác giả"
              >
                <Copy size={15} style={{ color: isDuplicateFilterActive ? '#181618' : 'currentColor' }} />
                <span style={{ color: isDuplicateFilterActive ? '#181618' : 'currentColor' }}>Lọc trùng</span>
                {duplicateRedundantCount > 0 && (
                  <span 
                    style={{
                      backgroundColor: isDuplicateFilterActive ? '#181618' : '#4D4845',
                      color: '#F5ECDC',
                    }}
                    className="px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none"
                  >
                    {duplicateRedundantCount}
                  </span>
                )}
              </button>

              {/* Bulk Delete button when items selected */}
              {selectedBooks.length > 0 && (
                <button 
                  onClick={handleBulkDelete}
                  style={{ backgroundColor: '#DC2626', color: '#FFFFFF' }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black hover:bg-red-700 text-white transition-all shadow-md cursor-pointer border border-red-600"
                >
                  <Trash2 size={15} style={{ color: '#FFFFFF' }} />
                  <span>Xóa {selectedBooks.length}</span>
                </button>
              )}

              {/* Sửa bìa */}
              <button 
                onClick={handleFixCovers}
                disabled={isFixing}
                style={{ backgroundColor: '#2A272A', color: '#F5ECDC', borderColor: '#4D4845' }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black border hover:border-[#D7C9B2] transition-all cursor-pointer disabled:opacity-50 shadow-sm"
                title="Tự động sửa ảnh bìa bị lỗi"
              >
                {isFixing ? <Loader2 size={15} className="animate-spin text-[#F5ECDC]" /> : <Settings size={15} style={{ color: '#F5ECDC' }} />}
                <span className="hidden sm:inline" style={{ color: '#F5ECDC' }}>{isFixing ? 'Đang sửa...' : 'Sửa bìa'}</span>
              </button>

              {/* Sắp xếp */}
              {isSortMode ? (
                <button 
                  onClick={handleSaveOrder}
                  disabled={isSavingOrder}
                  style={{ backgroundColor: '#F5ECDC', color: '#181618', borderColor: '#F5ECDC' }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black hover:bg-white transition-all shadow-md cursor-pointer border"
                >
                  {isSavingOrder ? <Loader2 size={15} className="animate-spin text-[#181618]" /> : <Save size={15} style={{ color: '#181618' }} />}
                  <span style={{ color: '#181618' }}>Lưu thứ tự</span>
                </button>
              ) : (
                <button 
                  onClick={() => { setIsSortMode(true); setSearchQuery(''); setIsDuplicateFilterActive(false); }}
                  style={{ backgroundColor: '#2A272A', color: '#F5ECDC', borderColor: '#4D4845' }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black border hover:border-[#D7C9B2] transition-all cursor-pointer shadow-sm"
                  title="Thay đổi thứ tự sắp xếp sách"
                >
                  <GripVertical size={15} style={{ color: '#F5ECDC' }} />
                  <span style={{ color: '#F5ECDC' }}>Sắp xếp</span>
                </button>
              )}

              {/* Đường phân cách thẩm mỹ */}
              <div className="h-6 w-px bg-[#4D4845]/50 mx-1 hidden sm:block shrink-0" />

              {/* Nút Hành Động Chính: Thêm Sách */}
              <button 
                onClick={() => setIsAddModalOpen(true)}
                style={{ backgroundColor: '#F5ECDC', color: '#181618', borderColor: '#F5ECDC' }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black hover:bg-white transition-all shadow-md cursor-pointer border shrink-0"
              >
                <Plus size={16} style={{ color: '#181618' }} />
                <span style={{ color: '#181618' }}>Thêm Sách</span>
              </button>
            </div>
          </div>

          {/* Dòng 2 riêng biệt: Số lượng sách & Ô tìm kiếm (Không bao giờ bị đè) */}
          <div className="flex items-center justify-between gap-3 w-full pt-1 border-t border-[#4D4845]/25">
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold px-3 py-1.5 bg-[#2A272A] border border-[#4D4845]/50 text-[#D7C9B2] rounded-xl flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                <span>{books.length} cuốn sách</span>
              </span>
            </div>

            {/* Search Input rộng rãi, độc lập */}
            <div className="relative w-full max-w-xs sm:max-w-sm">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7B7369]" size={14} />
              <input 
                type="text" 
                placeholder="Tìm tên sách, tác giả..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#2A272A] border border-[#4D4845]/60 rounded-xl py-2 pl-9 pr-8 text-xs font-medium text-[#F5ECDC] placeholder-[#7B7369] focus:outline-none focus:border-[#F5ECDC] transition-all"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7B7369] hover:text-[#F5ECDC] cursor-pointer">
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 md:px-8 pt-6 pb-12">
          {/* Banner hướng dẫn và xử lý trùng lặp */}
          {isDuplicateFilterActive && (
            duplicateGroups.length === 0 ? (
              <div className="bg-[#2A272A] border border-[#4D4845]/50 rounded-2xl p-8 text-center my-4">
                <Check size={32} className="mx-auto text-[#F5ECDC] mb-3" />
                <h3 className="text-base font-bold text-[#F5ECDC]">Không phát hiện cuốn sách nào bị trùng lặp</h3>
                <p className="text-xs text-[#D7C9B2] mt-1 max-w-md mx-auto">
                  Hệ thống đã đối soát toàn bộ {books.length} cuốn sách theo tên & tác giả (đã hỗ trợ đảo họ tên và bỏ dấu tiếng Việt).
                </p>
                <button 
                  onClick={() => setIsDuplicateFilterActive(false)}
                  style={{ backgroundColor: '#F5ECDC', color: '#181618', borderColor: '#F5ECDC' }}
                  className="mt-4 px-5 py-2.5 font-black text-xs rounded-xl hover:bg-white cursor-pointer transition-all shadow-md border inline-flex items-center justify-center gap-2"
                >
                  <span style={{ color: '#181618' }}>Quay lại xem tất cả sách</span>
                </button>
              </div>
            ) : (
              <div className="bg-[#2A272A] border border-[#4D4845]/70 rounded-2xl p-4 md:p-5 mb-6 shadow-lg">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-[#1F1D20] border border-[#4D4845]/60 rounded-xl text-[#F5ECDC] shrink-0">
                      <Copy size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm md:text-base font-black text-[#F5ECDC]">
                          Phát hiện {duplicateGroups.length} nhóm sách trùng lặp ({totalDuplicateBooks} cuốn)
                        </h3>
                        <span className="text-[11px] font-bold px-2 py-0.5 bg-red-950/60 text-red-300 border border-red-800/40 rounded-full">
                          {duplicateRedundantCount} bản sao thừa
                        </span>
                      </div>
                      <p className="text-xs text-[#D7C9B2] mt-1">
                        Hệ thống đã nhận diện thông minh tên sách và họ tên tác giả (ví dụ: &ldquo;Higashino Keigo&rdquo; = &ldquo;Keigo Higashino&rdquo;).
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    <button
                      onClick={handleSelectAllDuplicates}
                      className="flex-1 md:flex-initial px-3.5 py-2 bg-[#1F1D20] hover:bg-[#3A373A] border border-[#4D4845] text-[#F5ECDC] text-xs font-black rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Check size={14} />
                      <span>Chọn {duplicateRedundantCount} bản thừa để xóa</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsDuplicateFilterActive(false);
                        setSelectedBooks([]);
                      }}
                      className="px-3 py-2 text-xs font-bold text-[#D7C9B2] hover:text-[#F5ECDC] cursor-pointer"
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
               <div className="w-full bg-[#2A272A] border border-[#4D4845]/50 rounded-full h-3 mb-3 shadow-inner overflow-hidden">
                 <div className="bg-gradient-to-r from-orange-500 to-orange-600 h-full rounded-full transition-all duration-300" style={{ width: `${downloadProgress}%` }}></div>
               </div>
               <span className="text-sm font-bold text-[#D7C9B2] animate-pulse">Đang tải danh sách sách... {downloadProgress}%</span>
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
            <div className="text-center bg-green-950/40 border border-green-500/30 text-green-400 p-4 rounded-xl text-sm font-bold mt-10">
              {successMsg}
            </div>
          )}

          {error && (
            <div className="text-center bg-red-950/40 border border-red-500/30 text-red-400 p-4 rounded-xl text-sm font-bold mt-10">
              {error}
            </div>
          )}

          {!isFetchingBooks && displayItems.length === 0 && !error && (
            <div className="text-center text-[#D7C9B2] text-sm mt-10">No books found.</div>
          )}
        </main>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
           <div className="bg-[#1F1D20] text-[#F5ECDC] border border-[#4D4845]/60 rounded-3xl w-full max-w-4xl p-6 md:p-8 shadow-2xl relative max-h-[90vh] flex flex-col">
              <button onClick={() => setIsEditModalOpen(false)} className="absolute top-4 right-4 md:top-6 md:right-6 p-2 bg-[#2A272A] rounded-full text-[#D7C9B2] hover:text-[#F5ECDC] transition-colors border border-[#4D4845]/40"><X size={16}/></button>
              <h3 className="text-xl md:text-2xl font-extrabold mb-4 md:mb-8 text-[#F5ECDC] shrink-0">Edit Book</h3>
              
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
                  <div className="bg-[#2A272A] border border-[#4D4845]/50 rounded-2xl flex items-center justify-center flex-1 min-h-[200px] md:min-h-[280px] p-4 overflow-hidden">
                    {editForm.cover_url ? (
                      <img src={getCoverUrl(editForm.cover_url)} className="max-h-[200px] md:max-h-[260px] rounded-lg object-contain shadow-sm" alt="cover preview" 
                           onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_COVER_SVG; }} />
                    ) : editingBook ? (
                      <div className="w-full max-w-[160px] aspect-[2/3]">
                        <BookCoverImage coverUrl={editingBook.cover_url} bookId={editingBook.id} title={editingBook.title} author={editingBook.author} />
                      </div>
                    ) : (
                      <span className="text-[#D7C9B2] text-sm font-medium">No Cover Provided</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 md:mt-10 pt-4 md:pt-6 border-t border-[#4D4845]/40 flex justify-end gap-3 shrink-0">
                 <button onClick={() => setIsEditModalOpen(false)} className="btn-outline !py-3 !px-6 text-sm text-[#F5ECDC] bg-[#2A272A] border-[#4D4845] hover:bg-[#363236]">Cancel</button>
                 <button onClick={handleEditSubmit} className="btn-primary !py-3 !px-8 text-sm !bg-[#F97316] !text-white font-bold hover:!bg-[#EA580C] shadow-md border-none">Save Changes</button>
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

              {uploadStatus && (
                <div className={`p-3 rounded-xl mb-4 text-sm font-bold ${uploadStatus.type === 'error' ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>
                  {uploadStatus.msg}
                </div>
              )}
              
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
                                  setUploadStatus({type: 'error', msg: "Trình duyệt chặn quyền Clipboard. Vui lòng dán thủ công bằng Ctrl+V"});
                                  setTimeout(() => setUploadStatus(null), 3000);
                                }
                              }}
                              className="btn-secondary !py-2 !px-4 text-xs whitespace-nowrap bg-white border border-gray-200 !text-gray-700 hover:bg-gray-50 flex items-center gap-1 shadow-sm"
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
                                className="!py-1.5 !px-3 text-[10px] font-bold rounded-lg border border-gray-200 bg-white !text-gray-700 hover:bg-gray-100 whitespace-nowrap shadow-sm transition-colors"
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

      {/* Sync / Restore 67 Files Modal */}
      {isSyncModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="bg-[#242124] border border-[#4D4845]/70 rounded-3xl w-full max-w-2xl p-6 md:p-8 shadow-2xl relative max-h-[90vh] flex flex-col text-[#F5ECDC]">
            <button 
              onClick={() => {
                if (!isSyncing) {
                  setIsSyncModalOpen(false);
                  setSyncFiles([]);
                  setSyncResult(null);
                  setSyncProgress(null);
                }
              }} 
              className="absolute top-6 right-6 p-2 bg-[#2E2B2E] border border-[#4D4845]/50 rounded-full text-[#D7C9B2] hover:text-white cursor-pointer transition-all"
            >
              <X size={16} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <Unlink2 size={20} />
              </div>
              <div>
                <h3 className="text-lg font-black text-[#F5ECDC]">Kiểm Tra & Khắc Phục Liên Kết File Sách</h3>
                <p className="text-xs text-[#D7C9B2]">Rà soát toàn bộ sách xem cuốn nào chưa có file hoặc bị mất liên kết tải về</p>
              </div>
            </div>

            {/* Thẻ Báo cáo Kiểm tra File Sách */}
            <div className="mb-4">
              {isCheckingFiles ? (
                <div className="flex items-center gap-2 p-3.5 bg-[#2A272A] rounded-2xl border border-[#4D4845]/50 text-xs text-[#D7C9B2]">
                  <Loader2 size={16} className="animate-spin text-amber-400" />
                  <span>Đang rà soát trạng thái file của {books.length} cuốn sách...</span>
                </div>
              ) : brokenFileCount !== null && brokenFileCount > 0 ? (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs text-amber-200">
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-amber-500/20">
                    <div className="flex items-center gap-2 font-black text-amber-300">
                      <AlertTriangle size={16} className="text-amber-400" />
                      <span>Phát hiện {brokenFileCount} cuốn sách chưa có file / mất liên kết:</span>
                    </div>
                    <button 
                      onClick={fetchBrokenFiles} 
                      className="text-[11px] font-bold text-amber-400 hover:underline cursor-pointer"
                    >
                      Quét lại
                    </button>
                  </div>
                  <div className="max-h-28 overflow-y-auto space-y-1 pr-1 font-mono text-[11px] text-amber-100/90">
                    {brokenBooksList.map((b, i) => (
                      <div key={i} className="truncate">
                        • {b.title} {b.author ? `— ${b.author}` : ''}
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-amber-300/80">
                    💡 Hãy kéo thả hoặc chọn các file sách tương ứng vào ô bên dưới. Hệ thống sẽ tự động đối chiếu, ghép nối và lưu vĩnh viễn vào Database PostgreSQL.
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-300">
                  <div className="flex items-center gap-2.5 font-bold">
                    <Check size={18} className="text-emerald-400 shrink-0" />
                    <span>Toàn bộ {books.length} cuốn sách đều đã được liên kết file đầy đủ và an toàn trong Database.</span>
                  </div>
                  <button 
                    onClick={fetchBrokenFiles} 
                    className="text-[11px] font-bold text-emerald-400 hover:underline cursor-pointer"
                  >
                    Quét lại
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-4">
              {/* Vùng chọn file / kéo thả */}
              <div 
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleSyncDrop}
                className="border-2 border-dashed border-[#4D4845] hover:border-amber-500/80 rounded-2xl p-6 text-center bg-[#1F1D20]/60 transition-all cursor-pointer group"
                onClick={() => document.getElementById('sync-files-picker')?.click()}
              >
                <input 
                  type="file" 
                  id="sync-files-picker" 
                  multiple 
                  accept=".epub,.pdf" 
                  className="hidden" 
                  onChange={handleSyncFilesSelect} 
                />
                <Unlink2 size={32} className="mx-auto text-amber-400/70 group-hover:text-amber-400 transition-colors mb-2" />
                <p className="text-sm font-bold text-[#F5ECDC]">
                  Kéo thả toàn bộ file sách (.epub, .pdf) vào đây
                </p>
                <p className="text-xs text-[#7B7369] mt-1">
                  hoặc bấm vào để chọn cùng lúc nhiều file từ máy tính của bạn
                </p>
              </div>

              {/* Trạng thái danh sách file đã chọn */}
              {syncFiles.length > 0 && (
                <div className="bg-[#1F1D20] border border-[#4D4845]/50 rounded-2xl p-4">
                  <div className="flex justify-between items-center mb-3 pb-2 border-b border-[#4D4845]/40">
                    <span className="text-xs font-black text-[#F5ECDC]">
                      Đã chọn {syncFiles.length} file sách ({(syncFiles.reduce((acc, f) => acc + f.size, 0) / (1024 * 1024)).toFixed(1)} MB)
                    </span>
                    {!isSyncing && (
                      <button 
                        onClick={() => { setSyncFiles([]); setSyncResult(null); }}
                        className="text-xs font-bold text-red-400 hover:text-red-300 cursor-pointer"
                      >
                        Xoá tất cả
                      </button>
                    )}
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                    {syncFiles.map((file, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs py-1.5 px-2.5 bg-[#2A272A] rounded-xl border border-[#4D4845]/30">
                        <span className="truncate pr-2 font-medium text-[#F5ECDC]">{file.name}</span>
                        <span className="shrink-0 text-[#7B7369] font-mono text-[10px]">
                          {(file.size / (1024 * 1024)).toFixed(2)} MB
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Hiển thị tiến trình đang đồng bộ */}
              {isSyncing && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-center">
                  <Loader2 size={24} className="animate-spin mx-auto text-amber-400 mb-2" />
                  <p className="text-xs font-black text-amber-300">{syncProgress || 'Đang xử lý...'}</p>
                  <p className="text-[11px] text-amber-200/70 mt-1">
                    Hệ thống chia nhỏ thành từng đợt gửi để đảm bảo ổn định 100% không bị quá tải đường truyền.
                  </p>
                </div>
              )}

              {/* Hiển thị kết quả sau khi đồng bộ xong */}
              {syncResult && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 text-xs text-emerald-200">
                  <div className="flex items-center gap-2 mb-2 font-black text-sm text-emerald-400">
                    <Check size={18} />
                    <span>Đồng Bộ Hoàn Tất Thành Công!</span>
                  </div>
                  <p className="leading-relaxed">
                    • Khôi phục thành công: <strong>{syncResult.matched_count}</strong> cuốn sách đã có trong hệ thống.<br />
                    • Thêm mới thành công: <strong>{syncResult.created_count}</strong> cuốn sách.<br />
                    Tất cả file đã được chuyển vào PostgreSQL Database vĩnh viễn. Bạn có thể mở đọc hoặc tải xuống ngay!
                  </p>
                  {syncResult.matched_books && syncResult.matched_books.length > 0 && (
                    <div className="mt-3 max-h-32 overflow-y-auto space-y-1 pt-2 border-t border-emerald-500/20">
                      {syncResult.matched_books.slice(0, 15).map((b, i) => (
                        <div key={i} className="truncate text-[11px] text-emerald-300">
                          ✓ {b.title} {b.author ? `— ${b.author}` : ''}
                        </div>
                      ))}
                      {syncResult.matched_books.length > 15 && (
                        <div className="text-[10px] text-emerald-400 italic">
                          và {syncResult.matched_books.length - 15} cuốn sách khác...
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Nút kích hoạt đồng bộ */}
            <div className="mt-6 pt-4 border-t border-[#4D4845]/50 shrink-0">
              <button
                onClick={handleSyncFilesSubmit}
                disabled={isSyncing || syncFiles.length === 0}
                style={{ backgroundColor: syncFiles.length > 0 ? '#D97706' : '#2A272A', color: syncFiles.length > 0 ? '#FFFFFF' : '#7B7369' }}
                className="w-full py-3 px-6 rounded-2xl text-sm font-black transition-all shadow-lg cursor-pointer hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-[#4D4845]"
              >
                {isSyncing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Đang Khôi Phục & Gắn File Vào Database...</span>
                  </>
                ) : (
                  <span>Khôi Phục & Gắn File Vào Database ({syncFiles.length} file đã chọn)</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
