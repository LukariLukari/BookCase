'use client';
import { useState, useEffect } from 'react';
import { X, Loader2, Library, Upload, Edit3, Search, Check, Image as ImageIcon, FileText, ArrowRight, BookOpen, User, ArrowLeft } from 'lucide-react';
import axios from 'axios';
import BookCoverImage from './BookCoverImage';

interface AddMyBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddMyBookModal({ isOpen, onClose, onSuccess }: AddMyBookModalProps) {
  const [activeTab, setActiveTab] = useState<'library' | 'upload' | 'manual'>('library');

  // Library Tab State
  const [libraryBooks, setLibraryBooks] = useState<any[]>([]);
  const [isFetchingLibrary, setIsFetchingLibrary] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLibraryBookId, setSelectedLibraryBookId] = useState<string | null>(null);

  // Upload / Custom Tab State
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [compressedCoverUrl, setCompressedCoverUrl] = useState<string | null>(null);
  const [compressedSizeKb, setCompressedSizeKb] = useState<number | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  // Fetch library books when modal opens or library tab active
  useEffect(() => {
    if (isOpen && activeTab === 'library') {
      fetchLibraryBooks();
    }
  }, [isOpen, activeTab]);

  const fetchLibraryBooks = async () => {
    setIsFetchingLibrary(true);
    try {
      const res = await axios.get(`${API_URL}/api/books`);
      setLibraryBooks(res.data);
    } catch (err) {
      console.error("Lỗi khi tải danh sách sách thư viện:", err);
    } finally {
      setIsFetchingLibrary(false);
    }
  };

  // Helper function to downscale & compress cover image to low footprint (<30KB)
  const compressImage = (file: File): Promise<{ dataUrl: string; sizeKb: number }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxWidth = 320;
          const maxHeight = 480;
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error("Canvas context unavailable"));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Export compressed JPEG at 0.6 quality for minimal size footprint
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          const sizeInBytes = Math.round((dataUrl.length * 3) / 4);
          const sizeKb = Math.round(sizeInBytes / 1024);

          resolve({ dataUrl, sizeKb });
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);

    // If file is an image
    if (file.type.startsWith('image/')) {
      try {
        const { dataUrl, sizeKb } = await compressImage(file);
        setCompressedCoverUrl(dataUrl);
        setCompressedSizeKb(sizeKb);
      } catch (err) {
        console.error("Lỗi khi nén ảnh bìa:", err);
      }
    } else {
      // Document file (PDF, EPUB, MOBI, TXT)
      const rawName = file.name.replace(/\.[^/.]+$/, "");
      const cleanTitle = rawName
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, l => l.toUpperCase());

      if (!title) {
        setTitle(cleanTitle);
      }
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { dataUrl, sizeKb } = await compressImage(file);
      setCompressedCoverUrl(dataUrl);
      setCompressedSizeKb(sizeKb);
    } catch (err) {
      console.error("Lỗi khi nén ảnh bìa:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('access_token');
      const headers = { Authorization: `Bearer ${token}` };

      if (activeTab === 'library') {
        if (!selectedLibraryBookId) {
          alert("Vui lòng chọn một cuốn sách từ thư viện.");
          setIsLoading(false);
          return;
        }

        await axios.post(`${API_URL}/api/users/me/books`, {
          book_id: selectedLibraryBookId
        }, { headers });

      } else {
        // Upload or Manual tab
        if (!title.trim()) {
          alert("Vui lòng nhập tên sách.");
          setIsLoading(false);
          return;
        }

        await axios.post(`${API_URL}/api/users/me/books`, {
          custom_title: title.trim(),
          custom_author: author.trim() || "Unknown Author",
          custom_cover_url: compressedCoverUrl || null
        }, { headers });
      }

      // Reset form
      setTitle('');
      setAuthor('');
      setCompressedCoverUrl(null);
      setCompressedSizeKb(null);
      setUploadedFileName(null);
      setSelectedLibraryBookId(null);

      onSuccess();
      onClose();
    } catch (err) {
      console.error("Lỗi khi thêm sách:", err);
      alert("Lỗi khi thêm sách vào thư viện cá nhân.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const filteredLibraryBooks = libraryBooks.filter(b => 
    b.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.author?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#1E0C0B]/70 backdrop-blur-xs" onClick={onClose} />

      {/* Neo-Brutalist Modal Card */}
      <div className="relative bg-[#FFFDF9] border-[2.5px] border-[#1E0C0B] rounded-2xl p-5 sm:p-7 w-full max-w-xl shadow-[7px_7px_0px_#1E0C0B] z-10 max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Top Floating Square Accents (Neo-Brutalist) */}
        <div className="absolute top-4 right-16 flex items-center gap-1.5 pointer-events-none opacity-80 hidden sm:flex" aria-hidden="true">
          <span className="w-3.5 h-3.5 bg-[#84221D] border-2 border-[#1E0C0B] shadow-[1.5px_1.5px_0px_#1E0C0B]" />
          <span className="w-2.5 h-2.5 bg-[#1E0C0B]" />
        </div>

        {/* Top Bar: Back Button, Dot Grid & Skip Link */}
        <div className="flex items-center justify-between pb-3 mb-2">
          <button 
            type="button"
            onClick={onClose} 
            className="w-10 h-10 rounded-lg border-2 border-[#1E0C0B] bg-[#FFFDF9] shadow-[2.5px_2.5px_0px_#1E0C0B] hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-[1px_1px_0px_#1E0C0B] active:translate-x-[2.5px] active:translate-y-[2.5px] active:shadow-none transition-all flex items-center justify-center text-[#1E0C0B] cursor-pointer"
            title="Đóng / Quay lại"
            aria-label="Đóng"
          >
            <ArrowLeft size={18} strokeWidth={2.8} className="text-[#1E0C0B]" />
          </button>

          <div className="flex items-center gap-3">
            <span className="brutal-dots hidden sm:inline-block" aria-hidden="true" />
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-black uppercase tracking-wider text-[#1E0C0B] hover:text-[#84221D] underline decoration-2 cursor-pointer font-['Oswald',sans-serif]"
            >
              SKIP
            </button>
          </div>
        </div>

        {/* Header Display Title */}
        <div className="mb-5">
          <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#1E0C0B] font-['Oswald',sans-serif] leading-tight">
            CREATE YOUR BOOK
          </h2>
          <p className="text-xs font-bold text-[#8E5E58] mt-1">
            Thêm sách vào kệ cá nhân để ghi chú, theo dõi tiến độ và lưu trích dẫn tâm đắc.
          </p>
        </div>

        {/* Segmented Neo-Brutalist Tabs */}
        <div className="grid grid-cols-3 gap-2 p-1.5 bg-[#F6EFE2] rounded-xl border-2 border-[#1E0C0B] shadow-[3px_3px_0px_#1E0C0B] mb-5">
          <button
            type="button"
            onClick={() => setActiveTab('library')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all cursor-pointer font-['Oswald',sans-serif] ${
              activeTab === 'library'
                ? 'bg-[#84221D] text-[#FFFDF9] border-2 border-[#1E0C0B] shadow-[2px_2px_0px_#1E0C0B]'
                : 'text-[#1E0C0B] hover:bg-[#FAF5EB]'
            }`}
          >
            <Library size={15} strokeWidth={2.5} className={activeTab === 'library' ? 'text-[#FFFDF9]' : 'text-[#1E0C0B]'} />
            <span>Thư Viện</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all cursor-pointer font-['Oswald',sans-serif] ${
              activeTab === 'upload'
                ? 'bg-[#84221D] text-[#FFFDF9] border-2 border-[#1E0C0B] shadow-[2px_2px_0px_#1E0C0B]'
                : 'text-[#1E0C0B] hover:bg-[#FAF5EB]'
            }`}
          >
            <Upload size={15} strokeWidth={2.5} className={activeTab === 'upload' ? 'text-[#FFFDF9]' : 'text-[#1E0C0B]'} />
            <span>Tải File</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all cursor-pointer font-['Oswald',sans-serif] ${
              activeTab === 'manual'
                ? 'bg-[#84221D] text-[#FFFDF9] border-2 border-[#1E0C0B] shadow-[2px_2px_0px_#1E0C0B]'
                : 'text-[#1E0C0B] hover:bg-[#FAF5EB]'
            }`}
          >
            <Edit3 size={15} strokeWidth={2.5} className={activeTab === 'manual' ? 'text-[#FFFDF9]' : 'text-[#1E0C0B]'} />
            <span>Nhập Tay</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col justify-between pr-1">
          
          {/* TAB 1: LIBRARY SELECTION */}
          {activeTab === 'library' && (
            <div className="space-y-3.5">
              {/* Search Bar - Segmented Box Style */}
              <div className="flex items-stretch rounded-xl border-2 border-[#1E0C0B] bg-white shadow-[3px_3px_0px_#1E0C0B] focus-within:shadow-[4px_4px_0px_#84221D] overflow-hidden transition-all">
                <div className="w-11 bg-[#F6EFE2] border-r-2 border-[#1E0C0B] flex items-center justify-center text-[#1E0C0B] shrink-0">
                  <Search size={16} strokeWidth={2.5} />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm sách trong thư viện..."
                  className="w-full bg-transparent px-3 py-2.5 text-sm font-bold text-[#1E0C0B] placeholder-[#1E0C0B]/40 outline-none"
                />
              </div>

              {/* Book List */}
              {isFetchingLibrary ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="animate-spin text-[#84221D]" size={30} />
                </div>
              ) : filteredLibraryBooks.length === 0 ? (
                <div className="text-center py-10 bg-[#FAF5EB] rounded-xl border-2 border-dashed border-[#1E0C0B]/40">
                  <p className="text-xs font-bold text-[#8E5E58]">Không tìm thấy sách phù hợp.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                  {filteredLibraryBooks.map((book) => {
                    const isSelected = selectedLibraryBookId === book.id;
                    return (
                      <div
                        key={book.id}
                        onClick={() => setSelectedLibraryBookId(book.id)}
                        className={`flex items-center gap-3 p-2.5 rounded-xl border-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-[#F6EFE2] border-[#1E0C0B] shadow-[4px_4px_0px_#84221D] translate-x-[-1px] translate-y-[-1px]'
                            : 'bg-white border-[#1E0C0B] shadow-[2.5px_2.5px_0px_#1E0C0B] hover:shadow-[3.5px_3.5px_0px_#1E0C0B] hover:translate-x-[-1px] hover:translate-y-[-1px]'
                        }`}
                      >
                        <div className="w-11 h-15 shrink-0 relative overflow-hidden rounded-md border border-[#1E0C0B]/30 shadow-xs">
                          <BookCoverImage
                            coverUrl={book.cover_url}
                            bookId={book.id}
                            title={book.title}
                            author={book.author}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-black text-[#1E0C0B] truncate leading-snug">{book.title}</h4>
                          <p className="text-[11px] font-semibold text-[#8E5E58] truncate">{book.author || "Unknown Author"}</p>
                        </div>
                        {isSelected && (
                          <div className="w-6 h-6 bg-[#84221D] text-white rounded-md border-2 border-[#1E0C0B] shadow-[1.5px_1.5px_0px_#1E0C0B] flex items-center justify-center shrink-0">
                            <Check size={14} strokeWidth={3.5} className="text-white" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: FILE / COVER UPLOAD FROM DEVICE */}
          {activeTab === 'upload' && (
            <div className="space-y-3.5">
              
              {/* File Input Box */}
              <div className="bg-[#FAF5EB] border-2 border-dashed border-[#1E0C0B] hover:bg-[#F6EFE2] rounded-xl p-4 text-center transition-all shadow-[3px_3px_0px_#1E0C0B]">
                <label className="cursor-pointer flex flex-col items-center justify-center gap-1.5">
                  <div className="p-2.5 bg-[#84221D] rounded-xl text-white border-2 border-[#1E0C0B] shadow-[2px_2px_0px_#1E0C0B]">
                    <FileText size={22} className="text-white" />
                  </div>
                  <div>
                    <span className="text-xs font-black uppercase text-[#1E0C0B] block font-['Oswald',sans-serif] tracking-wide">
                      Chọn File sách hoặc Ảnh bìa từ máy
                    </span>
                    <span className="text-[11px] font-medium text-[#8E5E58] block mt-0.5">
                      Hỗ trợ .pdf, .epub, .mobi, .txt hoặc ảnh (.png, .jpg)
                    </span>
                  </div>
                  <input
                    type="file"
                    accept="image/*,.pdf,.epub,.mobi,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Info notice about file saving strategy */}
              <div className="p-3 bg-[#F6EFE2] border-2 border-[#1E0C0B] rounded-xl text-xs font-semibold text-[#1E0C0B] shadow-[2px_2px_0px_#1E0C0B] leading-relaxed">
                💡 <strong>Tiết kiệm dung lượng:</strong> Hệ thống trích xuất tên sách & tự động nén ảnh bìa xuống mức thấp nhất (&lt;30KB) để hiển thị mượt mà.
              </div>

              {uploadedFileName && (
                <div className="text-xs font-bold text-[#1E0C0B] bg-white p-2.5 rounded-xl border-2 border-[#1E0C0B] shadow-[2.5px_2.5px_0px_#1E0C0B] flex items-center gap-2 truncate">
                  <FileText size={15} className="text-[#84221D] shrink-0" />
                  <span className="truncate">File đã chọn: <strong>{uploadedFileName}</strong></span>
                </div>
              )}

              {/* Title & Author inputs in Screen 1 Neo-Brutalist Boxed style */}
              <div className="flex items-stretch rounded-xl border-2 border-[#1E0C0B] bg-white shadow-[3px_3px_0px_#1E0C0B] focus-within:shadow-[4px_4px_0px_#84221D] overflow-hidden transition-all">
                <div className="w-12 bg-[#F6EFE2] border-r-2 border-[#1E0C0B] flex items-center justify-center text-[#1E0C0B] shrink-0">
                  <BookOpen size={18} strokeWidth={2.5} />
                </div>
                <div className="p-2 flex-1 min-w-0">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-[#1E0C0B]/70 font-['Oswald',sans-serif]">
                    Tên Sách *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Nhập tên sách..."
                    className="w-full bg-transparent text-sm font-bold text-[#1E0C0B] placeholder-[#1E0C0B]/40 outline-none"
                    required={activeTab === 'upload'}
                  />
                </div>
              </div>

              <div className="flex items-stretch rounded-xl border-2 border-[#1E0C0B] bg-white shadow-[3px_3px_0px_#1E0C0B] focus-within:shadow-[4px_4px_0px_#84221D] overflow-hidden transition-all">
                <div className="w-12 bg-[#F6EFE2] border-r-2 border-[#1E0C0B] flex items-center justify-center text-[#1E0C0B] shrink-0">
                  <User size={18} strokeWidth={2.5} />
                </div>
                <div className="p-2 flex-1 min-w-0">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-[#1E0C0B]/70 font-['Oswald',sans-serif]">
                    Tác Giả
                  </label>
                  <input
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="Nhập tên tác giả..."
                    className="w-full bg-transparent text-sm font-bold text-[#1E0C0B] placeholder-[#1E0C0B]/40 outline-none"
                  />
                </div>
              </div>

              {/* Compressed Cover Preview */}
              {compressedCoverUrl && (
                <div className="flex items-center gap-3 p-2.5 bg-[#FAF5EB] rounded-xl border-2 border-[#1E0C0B] shadow-[2.5px_2.5px_0px_#1E0C0B]">
                  <img src={compressedCoverUrl} alt="Cover preview" className="w-12 h-16 object-cover rounded-md border-2 border-[#1E0C0B] shadow-xs" />
                  <div>
                    <span className="text-xs font-black text-[#1E0C0B] block">Ảnh bìa đã nén siêu nhỏ</span>
                    {compressedSizeKb && (
                      <span className="text-[11px] text-[#385E26] font-mono font-bold block mt-0.5">Dung lượng: ~{compressedSizeKb} KB</span>
                    )}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 3: MANUAL ENTRY */}
          {activeTab === 'manual' && (
            <div className="space-y-3.5">
              <div className="flex items-stretch rounded-xl border-2 border-[#1E0C0B] bg-white shadow-[3px_3px_0px_#1E0C0B] focus-within:shadow-[4px_4px_0px_#84221D] overflow-hidden transition-all">
                <div className="w-12 bg-[#F6EFE2] border-r-2 border-[#1E0C0B] flex items-center justify-center text-[#1E0C0B] shrink-0">
                  <BookOpen size={18} strokeWidth={2.5} />
                </div>
                <div className="p-2 flex-1 min-w-0">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-[#1E0C0B]/70 font-['Oswald',sans-serif]">
                    Tên Sách *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Nhập tên sách..."
                    className="w-full bg-transparent text-sm font-bold text-[#1E0C0B] placeholder-[#1E0C0B]/40 outline-none"
                    required={activeTab === 'manual'}
                  />
                </div>
              </div>

              <div className="flex items-stretch rounded-xl border-2 border-[#1E0C0B] bg-white shadow-[3px_3px_0px_#1E0C0B] focus-within:shadow-[4px_4px_0px_#84221D] overflow-hidden transition-all">
                <div className="w-12 bg-[#F6EFE2] border-r-2 border-[#1E0C0B] flex items-center justify-center text-[#1E0C0B] shrink-0">
                  <User size={18} strokeWidth={2.5} />
                </div>
                <div className="p-2 flex-1 min-w-0">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-[#1E0C0B]/70 font-['Oswald',sans-serif]">
                    Tác Giả
                  </label>
                  <input
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="Nhập tên tác giả..."
                    className="w-full bg-transparent text-sm font-bold text-[#1E0C0B] placeholder-[#1E0C0B]/40 outline-none"
                  />
                </div>
              </div>

              {/* Custom Cover Picker */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-[#1E0C0B]/70 mb-1 font-['Oswald',sans-serif]">
                  Ảnh Bìa (Tùy chọn)
                </label>
                {compressedCoverUrl ? (
                  <div className="flex items-center gap-3 p-2.5 bg-white rounded-xl border-2 border-[#1E0C0B] shadow-[2.5px_2.5px_0px_#1E0C0B]">
                    <img src={compressedCoverUrl} alt="Cover preview" className="w-12 h-16 object-cover rounded-md border-2 border-[#1E0C0B]" />
                    <div className="flex-1">
                      <span className="text-xs font-bold text-[#1E0C0B] block">Ảnh bìa đã nén</span>
                      {compressedSizeKb && <span className="text-[11px] text-[#385E26] font-mono font-bold">Dung lượng: ~{compressedSizeKb} KB</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => { setCompressedCoverUrl(null); setCompressedSizeKb(null); }}
                      className="px-2.5 py-1 bg-[#1E0C0B] text-white rounded-lg text-xs font-bold border border-[#1E0C0B] hover:bg-red-700 transition-colors"
                    >
                      Xóa
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 p-3 bg-[#FAF5EB] border-2 border-dashed border-[#1E0C0B] hover:bg-white rounded-xl cursor-pointer transition-all text-xs font-bold text-[#1E0C0B] shadow-[2.5px_2.5px_0px_#1E0C0B]">
                    <ImageIcon size={18} className="text-[#84221D]" />
                    <span>Tải ảnh bìa từ máy (Tự nén dung lượng thấp)</span>
                    <input type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
                  </label>
                )}
              </div>
            </div>
          )}

          {/* Bottom Split CTA Button & Hazard Strip (RULE[user_global] & Reference UI) */}
          <div className="pt-4 mt-4 border-t-2 border-[#1E0C0B]/20">
            <button
              type="submit"
              disabled={isLoading || (activeTab === 'library' && !selectedLibraryBookId) || (activeTab !== 'library' && !title.trim())}
              className="btn-split w-full flex items-stretch border-2 border-[#1E0C0B] rounded-xl overflow-hidden shadow-[4px_4px_0px_#1E0C0B] hover:shadow-[5px_5px_0px_#1E0C0B] hover:-translate-x-0.5 hover:-translate-y-0.5 active:shadow-none active:translate-x-1 active:translate-y-1 transition-all disabled:opacity-45 disabled:pointer-events-none cursor-pointer"
            >
              <span className="flex-1 py-3.5 px-4 bg-[#84221D] text-[#FFFDF9] font-['Oswald',sans-serif] text-base font-bold tracking-widest uppercase flex items-center justify-center gap-2">
                {isLoading && <Loader2 className="animate-spin text-white" size={18} />}
                <span>{isLoading ? 'Đang thêm...' : 'THÊM VÀO THƯ VIỆN'}</span>
              </span>
              <span className="w-14 bg-[#1E0C0B] text-[#FFFDF9] border-l-2 border-[#1E0C0B] flex items-center justify-center shrink-0">
                <ArrowRight size={20} strokeWidth={2.8} className="text-[#FFFDF9]" />
              </span>
            </button>

            {/* Neo-brutalist diagonal hazard stripe */}
            <div className="brutal-hazard h-3 w-full rounded-md border-2 border-[#1E0C0B] mt-3" aria-hidden="true" />
          </div>

        </form>
      </div>
    </div>
  );
}
