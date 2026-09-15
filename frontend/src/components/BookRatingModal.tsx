'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, X, Sparkles, BookOpen, Quote, Check, Tag, Loader2 } from 'lucide-react';
import axios from 'axios';
import BookCoverImage from '@/components/BookCoverImage';

interface BookRatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookId: string;
  bookTitle: string;
  bookAuthor?: string;
  coverUrl?: string;
  onSuccess?: () => void;
}

const PRESET_TAGS = [
  'Tư duy', 'Kỷ luật', 'Tài chính', 'Tâm lý học', 
  'Lãnh đạo', 'Thói quen', 'Khởi nghiệp', 'Sâu sắc', 'Triết lý sống'
];

export default function BookRatingModal({
  isOpen,
  onClose,
  bookId,
  bookTitle,
  bookAuthor,
  coverUrl,
  onSuccess,
}: BookRatingModalProps) {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [readingStatus, setReadingStatus] = useState<string>('completed');
  const [progressPercent, setProgressPercent] = useState<number>(100);
  const [reviewTitle, setReviewTitle] = useState<string>('');
  const [reviewText, setReviewText] = useState<string>('');
  const [keyTakeaway, setKeyTakeaway] = useState<string>('');
  const [favoriteQuote, setFavoriteQuote] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState<string>('');
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isFetchingMyReview, setIsFetchingMyReview] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  useEffect(() => {
    if (isOpen && bookId) {
      fetchMyReview();
    }
  }, [isOpen, bookId]);

  const fetchMyReview = async () => {
    try {
      setIsFetchingMyReview(true);
      const token = localStorage.getItem('token') || localStorage.getItem('access_token');
      if (!token) {
        setIsFetchingMyReview(false);
        return;
      }
      const res = await axios.get(`${API_URL}/api/books/${bookId}/my-review`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data) {
        const d = res.data;
        setRating(d.rating || 5);
        setReadingStatus(d.reading_status || 'completed');
        setProgressPercent(d.progress_percent !== undefined ? d.progress_percent : 100);
        setReviewTitle(d.review_title || '');
        setReviewText(d.review_text || '');
        setKeyTakeaway(d.key_takeaway || '');
        setFavoriteQuote(d.favorite_quote || '');
        if (d.tags) {
          setSelectedTags(d.tags.split(',').map((t: string) => t.trim()).filter(Boolean));
        }
      }
    } catch (err) {
      console.error('Không tìm thấy review cũ:', err);
    } finally {
      setIsFetchingMyReview(false);
    }
  };

  const handleToggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleAddCustomTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && customTagInput.trim()) {
      e.preventDefault();
      const val = customTagInput.trim();
      if (!selectedTags.includes(val)) {
        setSelectedTags([...selectedTags, val]);
      }
      setCustomTagInput('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('access_token');
      if (!token) {
        setErrorMessage('Vui lòng đăng nhập để lưu đánh giá.');
        setIsLoading(false);
        return;
      }

      await axios.post(`${API_URL}/api/books/${bookId}/reviews`, {
        rating,
        reading_status: readingStatus,
        progress_percent: progressPercent,
        review_title: reviewTitle || null,
        review_text: reviewText || null,
        key_takeaway: keyTakeaway || null,
        favorite_quote: favoriteQuote || null,
        tags: selectedTags.length > 0 ? selectedTags.join(', ') : null,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.response?.data?.detail || 'Đã có lỗi xảy ra khi lưu đánh giá.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/75 backdrop-blur-sm"
          onClick={onClose}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative bg-[#1F1D20] border border-[#4D4845]/50 rounded-3xl p-5 sm:p-8 max-w-2xl w-full shadow-2xl z-10 max-h-[92vh] overflow-y-auto text-[#F5ECDC]"
        >
          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b border-[#4D4845]/40 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-20 relative rounded-xl overflow-hidden shadow-md flex-shrink-0 border border-[#4D4845]/40">
                <BookCoverImage
                  coverUrl={coverUrl}
                  bookId={bookId}
                  title={bookTitle}
                  author={bookAuthor}
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#D7C9B2] mb-1 flex items-center gap-1">
                  <Sparkles size={13} /> Đánh Giá & Ghi Insight
                </p>
                <h2 className="text-lg sm:text-xl font-black text-[#F5ECDC] line-clamp-1">{bookTitle}</h2>
                <p className="text-xs text-[#D7C9B2]">{bookAuthor || 'Tác giả chưa rõ'}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-[#D7C9B2] hover:text-[#F5ECDC] bg-[#2A272A] hover:bg-[#3A373A] rounded-full transition-colors flex-shrink-0 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {isFetchingMyReview ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2">
              <Loader2 className="animate-spin text-[#F5ECDC]" size={28} />
              <p className="text-xs text-[#D7C9B2]">Đang tải dữ liệu...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* Star Rating Section */}
              <div className="bg-[#2A272A] border border-[#4D4845]/40 rounded-2xl p-4 text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-[#D7C9B2] mb-2">Đánh Giá Tổng Quan</p>
                <div className="flex justify-center items-center gap-2 mb-1">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const isFilled = (hoverRating !== null ? hoverRating : rating) >= star;
                    return (
                      <button
                        key={star}
                        type="button"
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(null)}
                        onClick={() => setRating(star)}
                        className="p-1.5 transition-transform hover:scale-125 active:scale-95 cursor-pointer focus:outline-none"
                      >
                        <Star
                          size={30}
                          className={isFilled ? 'text-[#F5ECDC] fill-[#F5ECDC]' : 'text-[#4D4845] hover:text-[#D7C9B2]'}
                        />
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs font-semibold text-[#D7C9B2]">
                  {rating === 5 && 'Tuyệt tác - Đổi thay góc nhìn'}
                  {rating === 4 && 'Rất hay - Nhiều bài học thực tiễn'}
                  {rating === 3 && 'Khá ổn - Đáng đọc khi có thời gian'}
                  {rating === 2 && 'Tạm được - Chưa thật sự ấn tượng'}
                  {rating === 1 && 'Không hợp gu'}
                </p>
              </div>

              {/* Reading Status & Progress Slider */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#D7C9B2] mb-2">
                    Trạng Thái Đọc
                  </label>
                  <div className="flex gap-1.5 bg-[#2A272A] p-1.5 rounded-xl border border-[#4D4845]/40">
                    {[
                      { key: 'reading', label: 'Đang đọc' },
                      { key: 'completed', label: 'Đã xong' },
                      { key: 'want_to_read', label: 'Muốn đọc' },
                    ].map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => {
                          setReadingStatus(item.key);
                          if (item.key === 'completed') setProgressPercent(100);
                          else if (item.key === 'want_to_read') setProgressPercent(0);
                          else if (progressPercent >= 100) setProgressPercent(35);
                        }}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          readingStatus === item.key
                            ? 'bg-[#F5ECDC] text-black shadow-sm'
                            : 'text-[#D7C9B2] hover:text-white'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#D7C9B2]">
                      Tiến Độ Hoàn Thành
                    </label>
                    <span className="text-xs font-bold text-[#F5ECDC] bg-[#1F1D20] border border-[#4D4845]/50 px-2 py-0.5 rounded-full">
                      {progressPercent}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={progressPercent}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setProgressPercent(val);
                      if (val === 100) setReadingStatus('completed');
                      else if (val > 0) setReadingStatus('reading');
                    }}
                    className="w-full accent-[#F5ECDC] h-2 bg-[#2A272A] rounded-lg appearance-none cursor-pointer mt-3"
                  />
                </div>
              </div>

              {/* Signature Insight: Key Takeaway */}
              <div className="bg-[#1F1D20] border border-[#4D4845]/50 rounded-2xl p-4 shadow-sm">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#F5ECDC] mb-1">
                  Bài Học Cốt Lõi (Key Takeaway)
                </label>
                <p className="text-xs text-[#7B7369] mb-3">
                  Điều gì đọng lại sâu sắc nhất sau khi gấp cuốn sách này lại?
                </p>
                <textarea
                  value={keyTakeaway}
                  onChange={(e) => setKeyTakeaway(e.target.value)}
                  placeholder="Ví dụ: Quy luật 80/20 giúp tôi nhận ra 20% nỗ lực cốt lõi tạo ra 80% kết quả..."
                  rows={3}
                  className="w-full bg-[#2A272A] border border-[#4D4845]/50 rounded-xl p-3 text-sm text-[#F5ECDC] placeholder-[#7B7369] focus:outline-none focus:border-[#D7C9B2] resize-none font-medium leading-relaxed"
                />
              </div>

              {/* Review & Thoughts */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#D7C9B2] mb-2">
                  Cảm Nhận Chi Tiết (Tùy chọn)
                </label>
                <input
                  type="text"
                  value={reviewTitle}
                  onChange={(e) => setReviewTitle(e.target.value)}
                  placeholder="Tiêu đề cảm nhận ngắn gọn"
                  className="w-full bg-[#2A272A] border border-[#4D4845]/50 rounded-xl px-4 py-2.5 text-sm text-[#F5ECDC] placeholder-[#7B7369] focus:outline-none focus:border-[#D7C9B2] mb-2"
                />
                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Chia sẻ góc nhìn, điều bạn thích, điều bạn chưa ưng ý..."
                  rows={3}
                  className="w-full bg-[#2A272A] border border-[#4D4845]/50 rounded-xl p-3 text-sm text-[#F5ECDC] placeholder-[#7B7369] focus:outline-none focus:border-[#D7C9B2] resize-none"
                />
              </div>

              {/* Favorite Quote */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#D7C9B2] mb-2">
                  <Quote size={14} className="text-[#7B7369]" /> Trích Dẫn Tâm Đắc Nhất (Tùy chọn)
                </label>
                <input
                  type="text"
                  value={favoriteQuote}
                  onChange={(e) => setFavoriteQuote(e.target.value)}
                  placeholder='"Cuộc sống là 10% những gì xảy ra với bạn và 90% cách bạn phản ứng với nó."'
                  className="w-full bg-[#2A272A] border border-[#4D4845]/50 rounded-xl px-4 py-2.5 text-sm text-[#F5ECDC] placeholder-[#7B7369] focus:outline-none focus:border-[#D7C9B2] italic"
                />
              </div>

              {/* Tag Cloud */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#D7C9B2] mb-2">
                  <Tag size={14} className="text-[#7B7369]" /> Thẻ Chủ Đề
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {PRESET_TAGS.map((t) => {
                    const isSelected = selectedTags.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => handleToggleTag(t)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#F5ECDC] text-black font-bold border-[#F5ECDC]'
                            : 'bg-[#2A272A] border-[#4D4845]/40 text-[#D7C9B2] hover:border-[#D7C9B2]'
                        }`}
                      >
                        {isSelected && '✓ '}{t}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="text"
                  value={customTagInput}
                  onChange={(e) => setCustomTagInput(e.target.value)}
                  onKeyDown={handleAddCustomTag}
                  placeholder="Thêm tag tự tạo và bấm Enter..."
                  className="w-full bg-[#2A272A] border border-[#4D4845]/40 rounded-xl px-3 py-2 text-xs text-[#F5ECDC] placeholder-[#7B7369] focus:outline-none"
                />
              </div>

              {errorMessage && (
                <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-xl text-red-300 text-xs font-medium">
                  {errorMessage}
                </div>
              )}

              {/* Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-outline flex-1 text-sm font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary flex-2 text-sm font-black"
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin text-black" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} className="stroke-[3] text-black" />
                      <span>Lưu Đánh Giá & Insight</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          )}

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
