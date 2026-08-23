'use client';
import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import axios from 'axios';

interface AddMyBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddMyBookModal({ isOpen, onClose, onSuccess }: AddMyBookModalProps) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/api/users/me/books`, {
        custom_title: title,
        custom_author: author || "Unknown Author"
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTitle('');
      setAuthor('');
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      alert("Lỗi khi thêm sách.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#1F1D20] border border-[#4D4845]/40 rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl z-10">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-[#F5ECDC]">Thêm Sách Cá Nhân</h2>
          <button onClick={onClose} className="text-[#D7C9B2] hover:text-[#F5ECDC] p-2 bg-[#2A272A] rounded-full">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-bold text-[#D7C9B2] mb-1">Tên Sách <span className="text-red-400">*</span></label>
            <input 
              type="text" 
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-[#2A272A] border border-[#4D4845] rounded-xl px-4 py-3 text-[#F5ECDC] focus:outline-none focus:border-[#F5ECDC]"
              placeholder="Nhập tên sách..."
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-[#D7C9B2] mb-1">Tác giả</label>
            <input 
              type="text" 
              value={author}
              onChange={e => setAuthor(e.target.value)}
              className="w-full bg-[#2A272A] border border-[#4D4845] rounded-xl px-4 py-3 text-[#F5ECDC] focus:outline-none focus:border-[#F5ECDC]"
              placeholder="Nhập tên tác giả..."
            />
          </div>

          <button 
            type="submit" 
            disabled={isLoading || !title.trim()}
            className="w-full bg-[#F5ECDC] text-black font-bold py-3 rounded-xl mt-4 flex items-center justify-center gap-2 hover:bg-white transition-colors disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : null}
            {isLoading ? 'Đang thêm...' : 'Thêm Vào Thư Viện'}
          </button>
        </form>
      </div>
    </div>
  );
}
