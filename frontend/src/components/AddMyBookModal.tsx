'use client';
import { useState, useEffect } from 'react';
import { X, Loader2, Library, Upload, Edit3, Search, Check, Image as ImageIcon, FileText } from 'lucide-react';
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
      // Extract title from filename (remove extension)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Card */}
      <div className="relative bg-[#1C1C1B] border border-[#6A5D52]/50 rounded-3xl p-6 md:p-8 w-full max-w-xl shadow-2xl z-10 max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-[#6A5D52]/40 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#1C1C1B] rounded-xl text-[#E2E2DE] border border-[#6A5D52]/50">
              <Library size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-[#E2E2DE]">Thêm Sách Cá Nhân</h2>
              <p className="text-xs text-[#B7AC9B]">Tạo bộ sưu tập sách và lưu trữ trích dẫn của bạn</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-[#B7AC9B] hover:text-[#E2E2DE] p-2 bg-[#1C1C1B] hover:bg-[#2E2E2D] rounded-full transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation - High Contrast Button Styling (RULE[user_global]) */}
        <div className="grid grid-cols-3 gap-2 p-1.5 bg-[#1C1C1B] rounded-2xl border border-[#6A5D52]/40 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab('library')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'library'
                ? 'bg-[#E2E2DE] text-[#1C1C1B] shadow-md font-black'
                : 'text-[#B7AC9B] hover:text-[#E2E2DE] hover:bg-[#2E2E2D]'
            }`}
            style={activeTab === 'library' ? { color: '#1C1C1B' } : {}}
          >
            <Library size={15} className={activeTab === 'library' ? 'text-[#1C1C1B]' : 'text-[#B7AC9B]'} />
            <span>Thư Viện</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'upload'
                ? 'bg-[#E2E2DE] text-[#1C1C1B] shadow-md font-black'
                : 'text-[#B7AC9B] hover:text-[#E2E2DE] hover:bg-[#2E2E2D]'
            }`}
            style={activeTab === 'upload' ? { color: '#1C1C1B' } : {}}
          >
            <Upload size={15} className={activeTab === 'upload' ? 'text-[#1C1C1B]' : 'text-[#B7AC9B]'} />
            <span>Tải File Máy</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'manual'
                ? 'bg-[#E2E2DE] text-[#1C1C1B] shadow-md font-black'
                : 'text-[#B7AC9B] hover:text-[#E2E2DE] hover:bg-[#2E2E2D]'
            }`}
            style={activeTab === 'manual' ? { color: '#1C1C1B' } : {}}
          >
            <Edit3 size={15} className={activeTab === 'manual' ? 'text-[#1C1C1B]' : 'text-[#B7AC9B]'} />
            <span>Nhập Tay</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col justify-between pr-1">
          
          {/* TAB 1: LIBRARY SELECTION */}
          {activeTab === 'library' && (
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-3.5 text-[#8A817C]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm sách trong thư viện..."
                  className="w-full bg-[#1C1C1B] border border-[#6A5D52] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#E2E2DE] placeholder-[#979086] focus:outline-none focus:border-[#E2E2DE]"
                />
              </div>

              {/* Book List */}
              {isFetchingLibrary ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="animate-spin text-[#B7AC9B]" size={28} />
                </div>
              ) : filteredLibraryBooks.length === 0 ? (
                <div className="text-center py-10 bg-[#1C1C1B]/50 rounded-2xl border border-[#6A5D52]/30">
                  <p className="text-sm text-[#B7AC9B]">Không tìm thấy sách phù hợp.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
                  {filteredLibraryBooks.map((book) => {
                    const isSelected = selectedLibraryBookId === book.id;
                    return (
                      <div
                        key={book.id}
                        onClick={() => setSelectedLibraryBookId(book.id)}
                        className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-[#2E2E2D] border-[#E2E2DE] shadow-md ring-1 ring-[#E2E2DE]'
                            : 'bg-[#1C1C1B]/80 border-[#6A5D52]/50 hover:bg-[#2E2E2D]/60'
                        }`}
                      >
                        <div className="w-12 h-16 flex-shrink-0 relative overflow-hidden rounded-lg">
                          <BookCoverImage
                            coverUrl={book.cover_url}
                            bookId={book.id}
                            title={book.title}
                            author={book.author}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-bold text-[#E2E2DE] truncate leading-snug">{book.title}</h4>
                          <p className="text-[11px] text-[#B7AC9B] truncate">{book.author || "Unknown Author"}</p>
                        </div>
                        {isSelected && (
                          <div className="p-1 bg-[#E2E2DE] text-black rounded-full flex-shrink-0">
                            <Check size={12} strokeWidth={3} className="text-black" />
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
            <div className="space-y-4">
              
              {/* File Input Box */}
              <div className="bg-[#1C1C1B]/60 border border-dashed border-[#6A5D52] hover:border-[#E2E2DE]/50 rounded-2xl p-5 text-center transition-colors">
                <label className="cursor-pointer flex flex-col items-center justify-center gap-2">
                  <div className="p-3 bg-[#1C1C1B] rounded-full text-[#E2E2DE] border border-[#6A5D52]/60">
                    <FileText size={24} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#E2E2DE] block">Chọn File sách hoặc Ảnh bìa từ máy</span>
                    <span className="text-[11px] text-[#8A817C] block mt-0.5">Hỗ trợ .pdf, .epub, .mobi, .txt hoặc file ảnh (.png, .jpg)</span>
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
              <div className="p-3 bg-[#1C1C1B] border border-[#6A5D52]/60 rounded-xl text-xs text-[#B7AC9B] leading-relaxed">
                💡 <strong>Tiết kiệm dung lượng:</strong> Hệ thống chỉ trích xuất thông tin tên sách & nén ảnh bìa xuống mức thấp nhất (15-30KB) để hiển thị, <strong>không lưu trữ toàn bộ file nặng</strong> lên máy chủ.
              </div>

              {uploadedFileName && (
                <div className="text-xs text-[#B7AC9B] bg-[#1C1C1B] px-3 py-2 rounded-lg border border-[#6A5D52]/40 flex items-center gap-2 truncate">
                  <FileText size={14} className="text-[#E2E2DE] flex-shrink-0" />
                  <span className="truncate">File đã chọn: <strong>{uploadedFileName}</strong></span>
                </div>
              )}

              {/* Title & Author inputs */}
              <div>
                <label className="block text-xs font-bold text-[#B7AC9B] mb-1">Tên Sách <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nhập tên sách..."
                  className="w-full bg-[#1C1C1B] border border-[#6A5D52] rounded-xl px-4 py-2.5 text-sm text-[#E2E2DE] focus:outline-none focus:border-[#E2E2DE]"
                  required={activeTab === 'upload'}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#B7AC9B] mb-1">Tác giả</label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Nhập tên tác giả..."
                  className="w-full bg-[#1C1C1B] border border-[#6A5D52] rounded-xl px-4 py-2.5 text-sm text-[#E2E2DE] focus:outline-none focus:border-[#E2E2DE]"
                />
              </div>

              {/* Compressed Cover Preview */}
              {compressedCoverUrl && (
                <div className="flex items-center gap-4 p-3 bg-[#1C1C1B] rounded-xl border border-[#6A5D52]/50">
                  <img src={compressedCoverUrl} alt="Cover preview" className="w-12 h-16 object-cover rounded-md shadow-md" />
                  <div>
                    <span className="text-xs font-bold text-[#E2E2DE] block">Ảnh bìa đã nén siêu nhỏ</span>
                    {compressedSizeKb && (
                      <span className="text-[11px] text-green-400 font-mono block mt-0.5">Dung lượng: ~{compressedSizeKb} KB</span>
                    )}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 3: MANUAL ENTRY */}
          {activeTab === 'manual' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#B7AC9B] mb-1">Tên Sách <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nhập tên sách..."
                  className="w-full bg-[#1C1C1B] border border-[#6A5D52] rounded-xl px-4 py-2.5 text-sm text-[#E2E2DE] focus:outline-none focus:border-[#E2E2DE]"
                  required={activeTab === 'manual'}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#B7AC9B] mb-1">Tác giả</label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Nhập tên tác giả..."
                  className="w-full bg-[#1C1C1B] border border-[#6A5D52] rounded-xl px-4 py-2.5 text-sm text-[#E2E2DE] focus:outline-none focus:border-[#E2E2DE]"
                />
              </div>

              {/* Custom Cover Picker */}
              <div>
                <label className="block text-xs font-bold text-[#B7AC9B] mb-1.5">Ảnh Bìa (Tùy chọn)</label>
                {compressedCoverUrl ? (
                  <div className="flex items-center gap-3 p-3 bg-[#1C1C1B] rounded-xl border border-[#6A5D52]/50">
                    <img src={compressedCoverUrl} alt="Cover preview" className="w-12 h-16 object-cover rounded-md shadow" />
                    <div className="flex-1">
                      <span className="text-xs font-bold text-[#E2E2DE] block">Ảnh bìa đã nén</span>
                      {compressedSizeKb && <span className="text-[11px] text-green-400 font-mono">Dung lượng: ~{compressedSizeKb} KB</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => { setCompressedCoverUrl(null); setCompressedSizeKb(null); }}
                      className="text-xs text-red-400 hover:text-red-300 p-1.5"
                    >
                      Xóa
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 p-3 bg-[#1C1C1B] border border-dashed border-[#6A5D52] hover:border-[#E2E2DE]/50 rounded-xl cursor-pointer transition-colors text-xs font-bold text-[#B7AC9B]">
                    <ImageIcon size={16} className="text-[#E2E2DE]" />
                    <span>Tải ảnh bìa (Sẽ tự nén dung lượng thấp)</span>
                    <input type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
                  </label>
                )}
              </div>
            </div>
          )}

          {/* Submit Button - Enforcing Contrast (RULE[user_global]) */}
          <div className="pt-6 mt-4 border-t border-[#6A5D52]/40">
            <button
              type="submit"
              disabled={isLoading || (activeTab === 'library' && !selectedLibraryBookId) || (activeTab !== 'library' && !title.trim())}
              className="w-full bg-[#E2E2DE] hover:bg-white text-[#000000] font-black py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50 cursor-pointer"
              style={{ color: '#000000' }}
            >
              {isLoading ? <Loader2 className="animate-spin text-black" size={18} /> : null}
              <span className="text-black font-black">{isLoading ? 'Đang thêm...' : 'Thêm Vào Thư Viện'}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
