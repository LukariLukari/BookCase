'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { 
  BookOpen, Star, Sparkles, Award, Flame, Target, 
  TrendingUp, CheckCircle2, Clock, Quote as QuoteIcon, 
  Tag, Search, Plus, Filter, Trash2, Edit3, 
  Copy, Check, BarChart3, Brain, ArrowUpRight, 
  Loader2, BookMarked, Compass, Calendar
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import BookCoverImage from '@/components/BookCoverImage';
import BookRatingModal from '@/components/BookRatingModal';
import { useAuth } from '@/app/contexts/AuthContext';

interface KeyTakeaway {
  id: string;
  book_id?: string;
  book_title: string;
  book_author?: string;
  book_cover_url?: string;
  rating: number;
  key_takeaway: string;
  favorite_quote?: string;
  tags?: string;
  created_at: string;
}

interface ActiveRead {
  id: string;
  book_id?: string;
  book_title: string;
  book_author?: string;
  book_cover_url?: string;
  progress_percent: number;
  rating?: number;
  reading_status: string;
  key_takeaway?: string;
  updated_at?: string;
}

interface ReviewItem {
  id: string;
  user_id: string;
  book_id?: string;
  user_book_id?: string;
  rating: number;
  reading_status: string;
  progress_percent: number;
  review_title?: string;
  review_text?: string;
  key_takeaway?: string;
  favorite_quote?: string;
  tags?: string;
  created_at: string;
  updated_at?: string;
  book_title?: string;
  book_author?: string;
  book_cover_url?: string;
}

interface DashboardData {
  total_completed: number;
  currently_reading: number;
  want_to_read: number;
  total_reviews: number;
  average_rating: number;
  total_quotes: number;
  reading_streak_days: number;
  yearly_goal: number;
  yearly_goal_progress: number;
  genre_distribution: Record<string, number>;
  rating_distribution: Record<string, number>;
  key_takeaways: KeyTakeaway[];
  current_reads: ActiveRead[];
  recent_reviews: ReviewItem[];
}

export default function ReaderInsightsClient() {
  const { user, token: authToken, isLoading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'journal' | 'active' | 'analytics' | 'wisdom'>('journal');
  
  // Filter states
  const [filterRating, setFilterRating] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Modal states
  const [editingBook, setEditingBook] = useState<{ id: string; title: string; author?: string; coverUrl?: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [updatingProgressId, setUpdatingProgressId] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const fetchInsights = async () => {
    try {
      setIsLoading(true);
      const token = authToken || localStorage.getItem('token') || localStorage.getItem('access_token');
      if (!token) {
        logout();
        return;
      }
      const res = await axios.get(`${API_URL}/api/users/me/insights`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDashboard(res.data);
    } catch (err: any) {
      console.error('Lỗi tải Reader Insights:', err);
      if (err.response?.status === 401) {
        logout();
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    } else if (user) {
      fetchInsights();
    }
  }, [user, authLoading, router]);

  const handleDeleteReview = async (reviewId: string) => {
    if (!confirm('Bạn có chắc muốn xóa bài đánh giá và insight này?')) return;
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('access_token');
      await axios.delete(`${API_URL}/api/users/me/reviews/${reviewId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchInsights();
    } catch (err) {
      console.error(err);
      alert('Không thể xóa bài đánh giá.');
    }
  };

  const handleQuickProgressUpdate = async (bookId: string, newPercent: number) => {
    try {
      setUpdatingProgressId(bookId);
      const token = localStorage.getItem('token') || localStorage.getItem('access_token');
      await axios.patch(`${API_URL}/api/users/me/reading-progress`, null, {
        params: {
          book_id: bookId,
          progress_percent: newPercent,
          reading_status: newPercent >= 100 ? 'completed' : 'reading'
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchInsights();
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingProgressId(null);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtered reviews
  const filteredReviews = useMemo(() => {
    if (!dashboard?.recent_reviews) return [];
    return dashboard.recent_reviews.filter((r) => {
      const matchSearch = !searchQuery || 
        (r.book_title && r.book_title.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.key_takeaway && r.key_takeaway.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.tags && r.tags.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchRating = filterRating === 'all' || r.rating.toString() === filterRating;
      const matchStatus = filterStatus === 'all' || r.reading_status === filterStatus;

      return matchSearch && matchRating && matchStatus;
    });
  }, [dashboard, searchQuery, filterRating, filterStatus]);

  // Unique tags for cloud
  const allTags = useMemo(() => {
    if (!dashboard?.recent_reviews) return [];
    const set = new Set<string>();
    dashboard.recent_reviews.forEach((r) => {
      if (r.tags) {
        r.tags.split(',').forEach((t) => {
          const trimmed = t.trim();
          if (trimmed) set.add(trimmed);
        });
      }
    });
    return Array.from(set);
  }, [dashboard]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-[#1F1D20] flex items-center justify-center font-bold text-[#D7C9B2]">
        Đang xác thực...
      </div>
    );
  }

  return (
    <div className="flex bg-[#1F1D20] text-[#F5ECDC] min-h-screen font-sans selection:bg-amber-950/60 overflow-x-hidden">
      <Sidebar />

      <div className="flex-1 ml-0 md:ml-64 pt-16 md:pt-0 flex flex-col min-h-screen w-full">
        
        {/* Top Header */}
        <header className="sticky top-16 md:top-0 z-30 bg-[#1F1D20]/90 backdrop-blur-md px-4 py-4 md:px-10 md:py-6 border-b border-[#4D4845]/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-black uppercase tracking-wider text-amber-400 bg-amber-950/50 px-2.5 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1">
                <Brain size={13} /> Reader Studio & Insight Hub
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-black text-[#F5ECDC]">
              Không Gian Người Đọc
            </h1>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2.5 bg-[#2A272A] hover:bg-[#3A373A] text-[#D7C9B2] hover:text-[#F5ECDC] rounded-xl text-xs font-bold border border-[#4D4845]/50 transition-colors flex items-center gap-1.5"
            >
              <Compass size={16} /> Tủ Sách Chung
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 px-4 md:px-10 pt-6 pb-16 space-y-8">
          
          {isLoading && !dashboard ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3">
              <Loader2 className="animate-spin text-amber-400" size={36} />
              <p className="text-sm font-bold text-[#D7C9B2]">Đang tải không gian tri thức của bạn...</p>
            </div>
          ) : (
            <>
              {/* HERO BANNER: Reader Persona, Streak & Reading Challenge */}
              <div className="relative overflow-hidden bg-gradient-to-r from-[#2A231C] via-[#2A272A] to-[#1F1D20] border border-amber-500/30 rounded-3xl p-6 md:p-8 shadow-xl">
                <div className="absolute right-0 top-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                  
                  {/* Left: Avatar & Motivation */}
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-amber-950/40 border-2 border-amber-500/40 overflow-hidden flex-shrink-0 shadow-lg">
                      <img 
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} 
                        alt="Avatar" 
                        className="w-full h-full object-cover" 
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl md:text-2xl font-black text-[#F5ECDC]">
                          Chào {user.username},
                        </h2>
                        <span className="text-xs bg-amber-400 text-black font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Award size={12} /> {dashboard?.total_completed && dashboard.total_completed >= 10 ? 'Mọt Sách Uyên Bác' : 'Nhà Săn Insight'}
                        </span>
                      </div>
                      <p className="text-xs md:text-sm text-[#D7C9B2] mt-1 max-w-xl italic leading-relaxed">
                        &ldquo;Đọc sách không phải để nhớ từng câu chữ, mà để xây dựng thế giới quan và gom nhặt những góc nhìn sâu sắc nhất.&rdquo;
                      </p>
                    </div>
                  </div>

                  {/* Right: Streak & 2025/2026 Challenge Goal */}
                  <div className="w-full lg:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-4 bg-[#1F1D20]/80 border border-[#4D4845]/40 p-4 rounded-2xl">
                    
                    {/* Streak Badge */}
                    <div className="flex items-center gap-3 pr-4 sm:border-r border-[#4D4845]/40">
                      <div className="p-3 bg-orange-500/10 text-orange-400 border border-orange-500/30 rounded-xl">
                        <Flame size={24} className="fill-orange-400/30 animate-pulse" />
                      </div>
                      <div>
                        <p className="text-xs text-[#7B7369] font-bold uppercase">Chuỗi Đọc Sách</p>
                        <p className="text-lg font-black text-[#F5ECDC]">
                          {dashboard?.reading_streak_days || 1} Ngày
                        </p>
                      </div>
                    </div>

                    {/* Challenge Goal */}
                    <div className="min-w-[180px]">
                      <div className="flex justify-between items-center text-xs mb-1.5 font-bold">
                        <span className="text-[#D7C9B2] flex items-center gap-1">
                          <Target size={13} className="text-amber-400" /> Mục Tiêu 2025
                        </span>
                        <span className="text-amber-300">
                          {dashboard?.total_completed || 0}/{dashboard?.yearly_goal || 24} cuốn
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-[#2A272A] rounded-full overflow-hidden border border-[#4D4845]/40">
                        <div 
                          className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(100, dashboard?.yearly_goal_progress || 0)}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-[#7B7369] mt-1 text-right font-medium">
                        Đạt {dashboard?.yearly_goal_progress || 0}% chặng đường
                      </p>
                    </div>

                  </div>

                </div>
              </div>

              {/* METRIC CARDS (4 Stats) */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Completed */}
                <div className="bg-[#2A272A] border border-[#4D4845]/40 p-5 rounded-2xl flex items-center gap-4 hover:border-amber-500/40 transition-colors">
                  <div className="p-3 bg-green-500/10 text-green-400 border border-green-500/30 rounded-xl">
                    <CheckCircle2 size={22} />
                  </div>
                  <div>
                    <p className="text-xs text-[#7B7369] font-bold uppercase">Đã Đọc Xong</p>
                    <p className="text-2xl font-black text-[#F5ECDC]">{dashboard?.total_completed || 0}</p>
                    <span className="text-[11px] text-green-400 font-semibold">Tri thức hoàn thành</span>
                  </div>
                </div>

                {/* Currently Reading */}
                <div className="bg-[#2A272A] border border-[#4D4845]/40 p-5 rounded-2xl flex items-center gap-4 hover:border-amber-500/40 transition-colors">
                  <div className="p-3 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-xl">
                    <BookOpen size={22} />
                  </div>
                  <div>
                    <p className="text-xs text-[#7B7369] font-bold uppercase">Đang Đọc Dở</p>
                    <p className="text-2xl font-black text-[#F5ECDC]">{dashboard?.currently_reading || 0}</p>
                    <span className="text-[11px] text-amber-300 font-semibold">Đang tiếp thu</span>
                  </div>
                </div>

                {/* Average Rating */}
                <div className="bg-[#2A272A] border border-[#4D4845]/40 p-5 rounded-2xl flex items-center gap-4 hover:border-amber-500/40 transition-colors">
                  <div className="p-3 bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 rounded-xl">
                    <Star size={22} className="fill-yellow-400" />
                  </div>
                  <div>
                    <p className="text-xs text-[#7B7369] font-bold uppercase">Điểm Trung Bình</p>
                    <p className="text-2xl font-black text-[#F5ECDC]">{dashboard?.average_rating ? dashboard.average_rating.toFixed(1) : '0.0'}</p>
                    <span className="text-[11px] text-[#D7C9B2] font-semibold">{dashboard?.total_reviews || 0} lần chấm sao</span>
                  </div>
                </div>

                {/* Insights & Takeaways count */}
                <div className="bg-[#2A272A] border border-[#4D4845]/40 p-5 rounded-2xl flex items-center gap-4 hover:border-amber-500/40 transition-colors">
                  <div className="p-3 bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded-xl">
                    <Sparkles size={22} />
                  </div>
                  <div>
                    <p className="text-xs text-[#7B7369] font-bold uppercase">Bài Học Đúc Kết</p>
                    <p className="text-2xl font-black text-[#F5ECDC]">{dashboard?.key_takeaways?.length || 0}</p>
                    <span className="text-[11px] text-purple-300 font-semibold">& {dashboard?.total_quotes || 0} trích dẫn</span>
                  </div>
                </div>

              </div>

              {/* TABS NAVIGATION */}
              <div className="flex border-b border-[#4D4845]/40 gap-2 sm:gap-6 overflow-x-auto no-scrollbar">
                {[
                  { key: 'journal', label: 'Sổ Nhật Ký & Đánh Giá', icon: <BookMarked size={16} /> },
                  { key: 'active', label: `Đang Đọc (${dashboard?.current_reads?.length || 0})`, icon: <Clock size={16} /> },
                  { key: 'wisdom', label: `Kho Trí Tuệ (${dashboard?.key_takeaways?.length || 0})`, icon: <Sparkles size={16} /> },
                  { key: 'analytics', label: 'Bản Đồ Tư Duy & Thói Quen', icon: <BarChart3 size={16} /> },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as any)}
                    className={`flex items-center gap-2 pb-3 px-2 text-sm font-black border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                      activeTab === tab.key
                        ? 'border-amber-400 text-amber-300'
                        : 'border-transparent text-[#7B7369] hover:text-[#D7C9B2]'
                    }`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* TAB CONTENT: 1. SỔ NHẬT KÝ & ĐÁNH GIÁ (JOURNAL) */}
              {activeTab === 'journal' && (
                <div className="space-y-6">
                  
                  {/* Search & Filter Bar */}
                  <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[#2A272A]/70 p-3 rounded-2xl border border-[#4D4845]/30">
                    <div className="relative flex-1">
                      <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7B7369]" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Tìm theo tên sách, nội dung insight, hoặc thẻ tag..."
                        className="w-full bg-[#1F1D20] border border-[#4D4845]/40 rounded-xl pl-10 pr-4 py-2 text-xs font-medium text-[#F5ECDC] placeholder-[#7B7369] focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                      />
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto">
                      <select
                        value={filterRating}
                        onChange={(e) => setFilterRating(e.target.value)}
                        className="bg-[#1F1D20] border border-[#4D4845]/40 rounded-xl px-3 py-2 text-xs font-bold text-[#F5ECDC] focus:outline-none cursor-pointer"
                      >
                        <option value="all">Tất cả sao (⭐)</option>
                        <option value="5">⭐⭐⭐⭐⭐ 5 Sao</option>
                        <option value="4">⭐⭐⭐⭐ 4 Sao</option>
                        <option value="3">⭐⭐⭐ 3 Sao</option>
                        <option value="2">⭐⭐ 2 Sao</option>
                        <option value="1">⭐ 1 Sao</option>
                      </select>

                      <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="bg-[#1F1D20] border border-[#4D4845]/40 rounded-xl px-3 py-2 text-xs font-bold text-[#F5ECDC] focus:outline-none cursor-pointer"
                      >
                        <option value="all">Tất cả trạng thái</option>
                        <option value="completed">Đã hoàn thành</option>
                        <option value="reading">Đang đọc</option>
                        <option value="want_to_read">Muốn đọc</option>
                      </select>
                    </div>
                  </div>

                  {/* Reviews List */}
                  {filteredReviews.length === 0 ? (
                    <div className="bg-[#2A272A] border border-[#4D4845]/40 rounded-3xl p-12 text-center flex flex-col items-center">
                      <BookOpen size={48} className="text-[#4D4845] mb-3" />
                      <h3 className="text-base font-bold text-[#F5ECDC]">Chưa có bài đánh giá nào khớp bộ lọc</h3>
                      <p className="text-xs text-[#D7C9B2] max-w-sm mt-1 mb-4">
                        Hãy bắt đầu chấm điểm cuốn sách đầu tiên và ghi lại bài học cốt lõi từ thư viện sách nhé!
                      </p>
                      <button
                        onClick={() => router.push('/')}
                        className="px-5 py-2.5 bg-gradient-to-r from-amber-400 to-amber-300 text-black font-black text-xs rounded-xl shadow-md cursor-pointer hover:opacity-90"
                      >
                        Khám Phá Sách & Đánh Giá
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {filteredReviews.map((rev) => (
                        <motion.div
                          key={rev.id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-[#2A272A] border border-[#4D4845]/40 hover:border-amber-500/40 rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all"
                        >
                          <div>
                            {/* Top info */}
                            <div className="flex gap-4 mb-4">
                              <div className="w-16 h-24 rounded-xl overflow-hidden shadow-md flex-shrink-0 border border-[#4D4845]/30">
                                <BookCoverImage
                                  coverUrl={rev.book_cover_url}
                                  bookId={rev.book_id || rev.id}
                                  title={rev.book_title || 'Sách'}
                                  author={rev.book_author}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                  <h4 className="font-extrabold text-sm text-[#F5ECDC] line-clamp-1">
                                    {rev.book_title}
                                  </h4>
                                  <div className="flex items-center gap-1 text-amber-400">
                                    {[...Array(rev.rating)].map((_, i) => (
                                      <Star key={i} size={13} className="fill-amber-400" />
                                    ))}
                                  </div>
                                </div>
                                <p className="text-xs text-[#D7C9B2] font-semibold truncate mb-2">
                                  {rev.book_author || 'Tác giả chưa rõ'}
                                </p>

                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                                    rev.reading_status === 'completed'
                                      ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                                      : rev.reading_status === 'reading'
                                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                      : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                  }`}>
                                    {rev.reading_status === 'completed' ? 'Đã xong' : rev.reading_status === 'reading' ? `Đang đọc ${rev.progress_percent}%` : 'Muốn đọc'}
                                  </span>

                                  {rev.created_at && (
                                    <span className="text-[10px] text-[#7B7369] font-medium flex items-center gap-1">
                                      <Calendar size={10} />
                                      {new Date(rev.created_at).toLocaleDateString('vi-VN')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Key Takeaway / Insight */}
                            {rev.key_takeaway && (
                              <div className="bg-[#1F1D20] border-l-4 border-amber-400 p-3.5 rounded-r-xl mb-3 shadow-inner">
                                <p className="text-[11px] font-black uppercase text-amber-300/90 tracking-wider mb-1 flex items-center gap-1">
                                  <Sparkles size={11} /> Bài Học Cốt Lõi (Insight)
                                </p>
                                <p className="text-xs text-[#F5ECDC] font-medium leading-relaxed italic">
                                  &ldquo;{rev.key_takeaway}&rdquo;
                                </p>
                              </div>
                            )}

                            {/* Detailed Review Text */}
                            {rev.review_text && (
                              <div className="mb-3">
                                {rev.review_title && (
                                  <p className="text-xs font-bold text-[#D7C9B2] mb-0.5">{rev.review_title}</p>
                                )}
                                <p className="text-xs text-[#7B7369] line-clamp-3 leading-relaxed">
                                  {rev.review_text}
                                </p>
                              </div>
                            )}

                            {/* Favorite Quote */}
                            {rev.favorite_quote && (
                              <p className="text-xs text-amber-200/80 italic mb-3 flex items-start gap-1">
                                <QuoteIcon size={12} className="flex-shrink-0 mt-0.5 text-amber-400" />
                                <span>{rev.favorite_quote}</span>
                              </p>
                            )}

                            {/* Tags */}
                            {rev.tags && (
                              <div className="flex flex-wrap gap-1 mb-3">
                                {rev.tags.split(',').map((t) => (
                                  <span
                                    key={t}
                                    className="text-[10px] bg-[#1F1D20] text-[#D7C9B2] border border-[#4D4845]/40 px-2 py-0.5 rounded-full"
                                  >
                                    #{t.trim()}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Action footer */}
                          <div className="pt-3 border-t border-[#4D4845]/30 flex justify-between items-center text-xs">
                            <button
                              onClick={() => setEditingBook({
                                id: rev.book_id || rev.id,
                                title: rev.book_title || 'Sách',
                                author: rev.book_author,
                                coverUrl: rev.book_cover_url
                              })}
                              className="text-amber-300 hover:text-white flex items-center gap-1 font-bold cursor-pointer transition-colors"
                            >
                              <Edit3 size={13} /> Sửa Insight
                            </button>

                            <button
                              onClick={() => handleDeleteReview(rev.id)}
                              className="text-red-400 hover:text-red-300 flex items-center gap-1 font-medium cursor-pointer transition-colors"
                            >
                              <Trash2 size={13} /> Xóa
                            </button>
                          </div>

                        </motion.div>
                      ))}
                    </div>
                  )}

                </div>
              )}

              {/* TAB CONTENT: 2. ĐANG ĐỌC & TIẾN ĐỘ (ACTIVE READING) */}
              {activeTab === 'active' && (
                <div className="space-y-6">
                  {(!dashboard?.current_reads || dashboard.current_reads.length === 0) ? (
                    <div className="bg-[#2A272A] border border-[#4D4845]/40 rounded-3xl p-12 text-center flex flex-col items-center">
                      <Clock size={48} className="text-[#4D4845] mb-3" />
                      <h3 className="text-base font-bold text-[#F5ECDC]">Bạn chưa có cuốn sách nào đang đọc dở</h3>
                      <p className="text-xs text-[#D7C9B2] max-w-sm mt-1 mb-4">
                        Chọn một cuốn sách trong tủ sách chung và bấm Đánh giá với trạng thái &quot;Đang đọc&quot; để theo dõi tiến độ hàng ngày!
                      </p>
                      <button
                        onClick={() => router.push('/')}
                        className="px-5 py-2.5 bg-gradient-to-r from-amber-400 to-amber-300 text-black font-black text-xs rounded-xl shadow-md cursor-pointer"
                      >
                        Chọn Sách Để Đọc
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {dashboard.current_reads.map((book) => (
                        <div
                          key={book.id}
                          className="bg-[#2A272A] border border-[#4D4845]/40 hover:border-amber-500/40 rounded-2xl p-5 shadow-lg flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex gap-4 mb-4">
                              <div className="w-16 h-24 rounded-xl overflow-hidden shadow-md flex-shrink-0 border border-[#4D4845]/30">
                                <BookCoverImage
                                  coverUrl={book.book_cover_url}
                                  bookId={book.book_id || book.id}
                                  title={book.book_title}
                                  author={book.book_author}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-extrabold text-sm text-[#F5ECDC] line-clamp-2">
                                  {book.book_title}
                                </h4>
                                <p className="text-xs text-[#D7C9B2] truncate mt-0.5">
                                  {book.book_author || 'Tác giả chưa rõ'}
                                </p>
                                <span className="inline-block mt-2 text-[11px] font-bold text-amber-300 bg-amber-950/40 border border-amber-500/30 px-2 py-0.5 rounded-full">
                                  Đã đọc {book.progress_percent}%
                                </span>
                              </div>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full h-2 bg-[#1F1D20] rounded-full overflow-hidden mb-4 border border-[#4D4845]/30">
                              <div
                                className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-500"
                                style={{ width: `${book.progress_percent}%` }}
                              />
                            </div>

                            {/* Quick Progress Adjustment Buttons */}
                            <div className="flex items-center gap-1.5 mb-4">
                              {[
                                { label: '+10%', add: 10 },
                                { label: '+25%', add: 25 },
                                { label: '50%', set: 50 },
                                { label: '✓ Xong (100%)', set: 100 },
                              ].map((btn, idx) => (
                                <button
                                  key={idx}
                                  disabled={updatingProgressId === (book.book_id || book.id)}
                                  onClick={() => {
                                    const next = btn.set !== undefined 
                                      ? btn.set 
                                      : Math.min(100, book.progress_percent + (btn.add || 0));
                                    handleQuickProgressUpdate(book.book_id || book.id, next);
                                  }}
                                  className="flex-1 py-1.5 bg-[#1F1D20] hover:bg-[#3A373A] text-[#D7C9B2] hover:text-white rounded-lg text-[11px] font-bold border border-[#4D4845]/40 transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                  {btn.label}
                                </button>
                              ))}
                            </div>

                            {book.key_takeaway && (
                              <div className="bg-[#1F1D20] p-3 rounded-xl border border-[#4D4845]/30 text-xs italic text-[#D7C9B2] line-clamp-2 mb-3">
                                &ldquo;{book.key_takeaway}&rdquo;
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => setEditingBook({
                              id: book.book_id || book.id,
                              title: book.book_title,
                              author: book.book_author,
                              coverUrl: book.book_cover_url
                            })}
                            className="w-full py-2 bg-[#1F1D20] hover:bg-amber-400 hover:text-black text-amber-300 font-black text-xs rounded-xl border border-amber-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Sparkles size={14} /> Ghi Chú & Đúc Kết Insight
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB CONTENT: 3. KHO TRÍ TUỆ ĐÚC KẾT (WISDOM VAULT) */}
              {activeTab === 'wisdom' && (
                <div className="space-y-6">
                  {(!dashboard?.key_takeaways || dashboard.key_takeaways.length === 0) ? (
                    <div className="bg-[#2A272A] border border-[#4D4845]/40 rounded-3xl p-12 text-center flex flex-col items-center">
                      <Sparkles size={48} className="text-[#4D4845] mb-3" />
                      <h3 className="text-base font-bold text-[#F5ECDC]">Kho trí tuệ đang chờ bạn lấp đầy</h3>
                      <p className="text-xs text-[#D7C9B2] max-w-sm mt-1">
                        Khi đánh giá sách, hãy ghi lại &quot;Bài học cốt lõi (Key Takeaway)&quot;. Mọi bài học sẽ được tập hợp về đây thành kho châm ngôn của riêng bạn.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {dashboard.key_takeaways.map((item) => (
                        <div
                          key={item.id}
                          className="bg-gradient-to-br from-[#2A272A] to-[#1F1D20] border-2 border-amber-500/30 hover:border-amber-400/60 rounded-3xl p-6 shadow-xl flex flex-col justify-between transition-all group"
                        >
                          <div>
                            <div className="flex justify-between items-start mb-4">
                              <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-amber-400 text-black rounded-lg">
                                  <Award size={14} />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                                  Góc Nhìn Cốt Lõi
                                </span>
                              </div>
                              <button
                                onClick={() => copyToClipboard(item.key_takeaway, item.id)}
                                title="Sao chép bài học"
                                className="p-1.5 text-[#D7C9B2] hover:text-white bg-[#1F1D20] rounded-lg border border-[#4D4845]/40 cursor-pointer transition-colors"
                              >
                                {copiedId === item.id ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                              </button>
                            </div>

                            <blockquote className="text-sm md:text-base font-semibold text-[#F5ECDC] leading-relaxed italic mb-6">
                              &ldquo;{item.key_takeaway}&rdquo;
                            </blockquote>
                          </div>

                          <div className="pt-4 border-t border-[#4D4845]/30 flex items-center gap-3">
                            <div className="w-10 h-14 rounded-lg overflow-hidden flex-shrink-0 shadow border border-[#4D4845]/40">
                              <BookCoverImage
                                coverUrl={item.book_cover_url}
                                bookId={item.book_id || item.id}
                                title={item.book_title}
                                author={item.book_author}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-black text-[#F5ECDC] truncate">{item.book_title}</p>
                              <p className="text-[11px] text-[#7B7369] truncate">{item.book_author || 'Tác giả'}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB CONTENT: 4. BẢN ĐỒ TƯ DUY & THÓI QUEN (ANALYTICS) */}
              {activeTab === 'analytics' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  
                  {/* Genre Distribution */}
                  <div className="bg-[#2A272A] border border-[#4D4845]/40 rounded-3xl p-6 shadow-xl">
                    <h3 className="text-sm font-extrabold text-[#F5ECDC] uppercase tracking-wider mb-4 flex items-center gap-2">
                      <BarChart3 size={16} className="text-amber-400" /> Thể Loại Đọc Nhiều Nhất
                    </h3>
                    
                    {dashboard?.genre_distribution && Object.keys(dashboard.genre_distribution).length > 0 ? (
                      <div className="space-y-3.5">
                        {Object.entries(dashboard.genre_distribution)
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 7)
                          .map(([genre, count]) => {
                            const total = Object.values(dashboard.genre_distribution).reduce((a, b) => a + b, 0);
                            const percent = Math.round((count / (total || 1)) * 100);
                            return (
                              <div key={genre}>
                                <div className="flex justify-between text-xs font-bold mb-1">
                                  <span className="text-[#F5ECDC]">{genre}</span>
                                  <span className="text-amber-300">{count} cuốn ({percent}%)</span>
                                </div>
                                <div className="w-full h-2 bg-[#1F1D20] rounded-full overflow-hidden border border-[#4D4845]/30">
                                  <div
                                    className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full"
                                    style={{ width: `${percent}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    ) : (
                      <p className="text-xs text-[#7B7369]">Chưa có dữ liệu thể loại.</p>
                    )}
                  </div>

                  {/* Rating Distribution */}
                  <div className="bg-[#2A272A] border border-[#4D4845]/40 rounded-3xl p-6 shadow-xl">
                    <h3 className="text-sm font-extrabold text-[#F5ECDC] uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Star size={16} className="text-amber-400 fill-amber-400" /> Phân Bố Điểm Đánh Giá
                    </h3>
                    
                    <div className="space-y-3">
                      {[5, 4, 3, 2, 1].map((stars) => {
                        const count = dashboard?.rating_distribution?.[stars.toString()] || 0;
                        const total = dashboard?.total_reviews || 1;
                        const percent = Math.round((count / total) * 100);
                        return (
                          <div key={stars} className="flex items-center gap-3">
                            <span className="text-xs font-bold text-[#D7C9B2] w-12 flex items-center gap-1">
                              {stars} <Star size={12} className="fill-amber-400 text-amber-400" />
                            </span>
                            <div className="flex-1 h-2 bg-[#1F1D20] rounded-full overflow-hidden border border-[#4D4845]/30">
                              <div
                                className="h-full bg-amber-400 rounded-full"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-[#7B7369] w-8 text-right">
                              {count}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Mindset Tag Cloud */}
                  <div className="lg:col-span-2 bg-[#2A272A] border border-[#4D4845]/40 rounded-3xl p-6 shadow-xl">
                    <h3 className="text-sm font-extrabold text-[#F5ECDC] uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Tag size={16} className="text-amber-400" /> Đám Mây Chủ Đề & Tư Duy (Mindset Cloud)
                    </h3>
                    <p className="text-xs text-[#D7C9B2] mb-4">
                      Những chủ đề và từ khóa cốt lõi xuất hiện nhiều nhất trong các đúc kết của bạn:
                    </p>
                    
                    {allTags.length > 0 ? (
                      <div className="flex flex-wrap gap-2.5">
                        {allTags.map((tag) => (
                          <span
                            key={tag}
                            className="px-3.5 py-1.5 bg-[#1F1D20] hover:bg-amber-400/20 text-amber-300 border border-amber-500/30 rounded-full text-xs font-extrabold transition-colors cursor-pointer"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[#7B7369]">Chưa có tag nào được lưu.</p>
                    )}
                  </div>

                </div>
              )}

            </>
          )}

        </main>

        {/* Edit / Add Modal */}
        {editingBook && (
          <BookRatingModal
            isOpen={true}
            onClose={() => setEditingBook(null)}
            bookId={editingBook.id}
            bookTitle={editingBook.title}
            bookAuthor={editingBook.author}
            coverUrl={editingBook.coverUrl}
            onSuccess={fetchInsights}
          />
        )}

      </div>
    </div>
  );
}
