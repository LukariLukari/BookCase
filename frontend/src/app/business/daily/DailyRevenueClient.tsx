'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ReceiptText,
  ShoppingBag,
  TrendingUp,
  RotateCcw,
  Search,
  SlidersHorizontal,
  UtensilsCrossed,
  ArrowUpRight,
  Eye,
  Check,
  Calendar,
  Sparkles,
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import BusinessBottomNav from '@/components/BusinessBottomNav';
import { useAuth } from '@/app/contexts/AuthContext';

type DailyItem = {
  productId: string;
  productName: string;
  quantity: number;
  revenue: number;
  unitPrice: number;
  orderCount: number;
  percentageQuantity: number;
  percentageRevenue: number;
};

type OrderSummary = {
  id: string;
  code: string;
  customerName: string;
  customerContact?: string;
  orderedAt: string;
  total: number;
  profit: number;
  itemCount: number;
  items: { productName: string; quantity: number; unitPrice: number }[];
};

type AvailableDate = {
  date: string;
  revenue: number;
  orderCount: number;
};

type DailyStats = {
  date: string;
  totalRevenue: number;
  orderCount: number;
  soldUnits: number;
  totalProfit: number;
  averageOrderValue: number;
  items: DailyItem[];
  orders: OrderSummary[];
  availableDates: AvailableDate[];
};

const formatVNCurrency = (amount = 0) => `${Math.round(amount).toLocaleString('vi-VN')} đ`;

function getTodayString(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

function formatDateLong(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d, 12, 0, 0);
    const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dayName = dayNames[date.getDay()];
    return `${dayName}, ngày ${String(d).padStart(2, '0')} tháng ${String(m).padStart(2, '0')} năm ${y}`;
  } catch {
    return dateStr;
  }
}

function shiftDate(dateStr: string, days: number, maxDate: string = getTodayString()): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d + days, 12, 0, 0);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const result = `${year}-${month}-${day}`;
    if (result > maxDate) return maxDate;
    return result;
  } catch {
    return dateStr;
  }
}

export default function DailyRevenueClient() {
  const { user, token, isLoading: authLoading, logout } = useAuth();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [filterMode, setFilterMode] = useState<'quantity' | 'revenue'>('quantity');
  const [searchDish, setSearchDish] = useState<string>('');
  const [minRevenueThreshold, setMinRevenueThreshold] = useState<number>(0);
  const [showOrderList, setShowOrderList] = useState<boolean>(false);
  const [toast, setToast] = useState<string>('');

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const todayStr = useMemo(() => getTodayString(), []);
  const isToday = selectedDate >= todayStr;

  useEffect(() => {
    if (selectedDate > todayStr) {
      setSelectedDate(todayStr);
    }
  }, [selectedDate, todayStr]);

  const fetchDailyData = async (date: string, isSilent = false) => {
    if (!token) return;
    const safeDate = date > todayStr ? todayStr : date;
    if (safeDate !== date) {
      setSelectedDate(safeDate);
      return;
    }
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const response = await axios.get<DailyStats>(`/api/business/daily?date=${safeDate}`, { headers });
      setStats(response.data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        logout();
      } else {
        notify('Không thể tải dữ liệu doanh thu ngày này.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchDailyData(selectedDate);
    }
  }, [token, selectedDate]);

  // Filter and sort items based on filterMode, searchDish, and minRevenueThreshold
  const processedItems = useMemo(() => {
    if (!stats || !stats.items) return [];

    let list = stats.items.filter((item) => {
      const matchSearch = item.productName.toLowerCase().includes(searchDish.toLowerCase().trim());
      const matchMinRevenue = item.revenue >= minRevenueThreshold;
      return matchSearch && matchMinRevenue;
    });

    if (filterMode === 'quantity') {
      list.sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue);
    } else {
      list.sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity);
    }

    return list;
  }, [stats, filterMode, searchDish, minRevenueThreshold]);

  // Max values for chart scaling
  const maxQuantity = useMemo(() => {
    if (!processedItems.length) return 1;
    return Math.max(...processedItems.map((i) => i.quantity), 1);
  }, [processedItems]);

  const maxRevenue = useMemo(() => {
    if (!processedItems.length) return 1;
    return Math.max(...processedItems.map((i) => i.revenue), 1);
  }, [processedItems]);

  if (authLoading || !user) {
    return <div className="min-h-screen bg-[#F5EEDD]" />;
  }

  return (
    <div className="min-h-screen bg-[#F5EEDD] p-3 pb-[calc(10rem+env(safe-area-inset-bottom))] pt-[calc(4.75rem+env(safe-area-inset-top,0px))] text-[#16587B] md:flex md:gap-5 md:p-6 md:pb-8 md:pt-6">
      <Sidebar />

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-5xl space-y-5">
          {/* TOP BAR / BREADCRUMB */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#16587B]/70">
                Thống Kê Bán Hàng Theo Ngày
              </p>
              <h1 className="business-page-title text-xl font-black md:text-2xl">
                Doanh Thu Trong Ngày
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fetchDailyData(selectedDate, true)}
                disabled={refreshing}
                title="Làm mới số liệu"
                className="btn-push flex h-10 items-center justify-center gap-2 rounded-xl border border-[#16587B]/25 bg-white px-3.5 text-xs font-black text-[#16587B] transition-transform active:scale-95 disabled:opacity-50"
              >
                <RotateCcw size={15} className={`text-[#16587B] ${refreshing ? 'animate-spin' : ''}`} />
                <span>{refreshing ? 'Đang tải...' : 'Làm mới'}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedDate(todayStr)}
                disabled={isToday}
                className={`flex h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-black transition-all ${
                  isToday
                    ? 'choice-active cursor-default'
                    : 'bg-[#16587B] text-white shadow-md hover:bg-[#104460] active:scale-95'
                }`}
              >
                <Sparkles size={14} className={isToday ? 'text-[#16587B]/60' : 'text-white'} />
                <span>Hôm nay</span>
              </button>
            </div>
          </div>

          {/* =========================================================================
              PHẦN TRUNG TÂM PHÍA TRÊN: NGAY GIỮA MÀN HÌNH
              - Bên trên số tiền: Ngày tháng năm kích thước nhỏ và chọn thời gian
              - Ở giữa: Tổng số tiền doanh thu ngày hôm đó nhận được
              - Bên dưới số tiền: Tổng số đơn hàng trong ngày hôm đó
              ========================================================================= */}
          <section className="relative overflow-hidden rounded-3xl border-2 border-[#16587B]/20 bg-white p-6 text-center shadow-[0_10px_30px_rgb(22_88_123_/_0.08)] md:p-10">
            {/* Subtle decorative background glow */}
            <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-96 -translate-x-1/2 rounded-full bg-[#84B3CE]/15 blur-3xl" />

            <div className="relative mx-auto flex max-w-xl flex-col items-center justify-center">
              {/* 1. BÊN TRÊN SỐ TIỀN: NGÀY THÁNG NĂM KÍCH THƯỚC NHỎ & BỘ CHỌN THỜI GIAN */}
              <div className="mb-4 flex flex-col items-center gap-2">
                {/* Ngày tháng năm dạng chữ nhỏ trang trọng */}
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#16587B]/20 bg-[#F5EEDD]/70 px-3.5 py-1 text-xs font-bold text-[#16587B]">
                  <Calendar size={13} className="text-[#16587B]" />
                  <span>{formatDateLong(selectedDate)}</span>
                </span>

                {/* Bộ điều khiển chọn ngày (Next / Prev / Input Date) */}
                <div className="flex items-center gap-1.5 rounded-2xl border border-[#16587B]/20 bg-[#F5EEDD] p-1 shadow-inner">
                  {/* Nút lùi 1 ngày */}
                  <button
                    type="button"
                    onClick={() => setSelectedDate((prev) => shiftDate(prev, -1, todayStr))}
                    title="Xem ngày trước"
                    aria-label="Xem ngày trước"
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#16587B] shadow-sm transition-all hover:bg-[#16587B] hover:text-white active:scale-90"
                  >
                    <ChevronLeft size={18} />
                  </button>

                  {/* Input Date chọn trực tiếp - Chặn ngày tương lai */}
                  <div className="relative flex items-center">
                    <CalendarDays size={15} className="pointer-events-none absolute left-3 text-[#16587B]" />
                    <input
                      type="date"
                      value={selectedDate}
                      max={todayStr}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) return;
                        if (val > todayStr) {
                          notify('Không thể xem các ngày trong tương lai chưa xảy ra.');
                          setSelectedDate(todayStr);
                        } else {
                          setSelectedDate(val);
                        }
                      }}
                      title="Bấm để chọn ngày (tối đa là hôm nay)"
                      className="h-9 cursor-pointer rounded-xl border border-transparent bg-white pl-8 pr-3 text-xs font-black text-[#16587B] outline-none shadow-sm transition-colors hover:border-[#16587B]/30 focus:border-[#16587B]"
                    />
                  </div>

                  {/* Nút tiến 1 ngày - Cấm vượt quá hôm nay */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!isToday && selectedDate < todayStr) {
                        setSelectedDate((prev) => shiftDate(prev, 1, todayStr));
                      }
                    }}
                    disabled={isToday || selectedDate >= todayStr}
                    title={isToday || selectedDate >= todayStr ? 'Không thể xem ngày trong tương lai chưa xảy ra' : 'Xem ngày tiếp theo'}
                    aria-label="Xem ngày tiếp theo"
                    className={`flex h-9 w-9 items-center justify-center rounded-xl shadow-sm transition-all ${
                      isToday || selectedDate >= todayStr
                        ? 'border border-[#16587B]/10 bg-white/40 text-[#16587B]/30 cursor-not-allowed opacity-40'
                        : 'bg-white text-[#16587B] hover:bg-[#16587B] hover:text-white active:scale-90'
                    }`}
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>

              {/* 2. CHÍNH GIỮA: TỔNG SỐ TIỀN DOANH THU NHẬN ĐƯỢC NGÀY HÔM ĐÓ */}
              <div className="my-2 flex flex-col items-center">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-[#16587B]/60">
                  Tổng Doanh Thu Trong Ngày
                </span>

                {loading ? (
                  <div className="my-3 h-16 w-64 animate-pulse rounded-2xl bg-[#F5EEDD]" />
                ) : (
                  <motion.div
                    key={selectedDate + stats?.totalRevenue}
                    initial={{ scale: 0.92, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                    className="my-1"
                  >
                    <span className="block text-4xl font-black tracking-tight text-[#16587B] sm:text-5xl md:text-6xl lg:text-7xl">
                      {formatVNCurrency(stats?.totalRevenue || 0)}
                    </span>
                  </motion.div>
                )}
              </div>

              {/* 3. BÊN DƯỚI SỐ TIỀN: TỔNG SỐ ĐƠN HÀNG TRONG NGÀY HÔM ĐÓ */}
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-2xl border-2 border-[#16587B]/25 bg-[#F5EEDD] px-4 py-2 shadow-xs">
                  <ReceiptText size={17} className="text-[#16587B]" />
                  <span className="text-xs font-bold text-[#16587B]/70">Tổng số đơn hàng:</span>
                  <b className="text-sm font-black text-[#16587B] md:text-base">
                    {stats?.orderCount || 0} đơn
                  </b>
                </div>

                <div className="inline-flex items-center gap-2 rounded-2xl border border-[#16587B]/20 bg-white px-3.5 py-2 shadow-xs">
                  <ShoppingBag size={16} className="text-[#16587B]" />
                  <span className="text-xs font-bold text-[#16587B]/70">Tổng món đã bán:</span>
                  <b className="text-xs font-black text-[#385E26] md:text-sm">
                    {stats?.soldUnits || 0} món
                  </b>
                </div>

                {stats && stats.orderCount > 0 && (
                  <div className="inline-flex items-center gap-2 rounded-2xl border border-[#16587B]/20 bg-white px-3.5 py-2 shadow-xs">
                    <TrendingUp size={16} className="text-[#16587B]" />
                    <span className="text-xs font-bold text-[#16587B]/70">Trung bình/đơn:</span>
                    <b className="text-xs font-black text-[#16587B] md:text-sm">
                      {formatVNCurrency(stats.averageOrderValue)}
                    </b>
                  </div>
                )}
              </div>

              {/* Danh sách các ngày gần nhất có doanh thu (quick jump chips) */}
              {stats?.availableDates && stats.availableDates.length > 0 && (
                <div className="mt-6 w-full border-t border-[#16587B]/10 pt-4">
                  <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-[#16587B]/60">
                    Các ngày gần nhất có đơn bán:
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    {stats.availableDates.filter((d) => d.date <= todayStr).slice(0, 7).map((d) => {
                      const isSelected = d.date === selectedDate;
                      return (
                        <button
                          key={d.date}
                          type="button"
                          onClick={() => setSelectedDate(d.date)}
                          className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[11px] font-black transition-all ${
                            isSelected
                              ? 'choice-active shadow-sm'
                              : 'border border-[#16587B]/20 bg-[#F5EEDD] text-[#16587B] hover:bg-[#16587B]/10 active:scale-95'
                          }`}
                        >
                          <span>{d.date.slice(5).replace('-', '/')}</span>
                          <span
                            className={`rounded-md px-1 py-0.5 text-[9px] font-black ${
                              isSelected ? 'bg-white/20 text-white' : 'bg-white text-[#16587B]'
                            }`}
                          >
                            {formatVNCurrency(d.revenue).replace(' đ', '')}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* =========================================================================
              PHÍA DƯỚI CÙNG: BIỂU ĐỒ BIỂU THỊ CÁC MÓN ĐƯỢC GỌI THEO SỐ LƯỢNG
              CÓ THỂ FILTER THEO TỔNG DOANH THU
              ========================================================================= */}
          <section className="card-push rounded-3xl border-2 border-[#16587B]/20 bg-white p-5 md:p-7">
            {/* Header & Controls bar */}
            <div className="mb-6 flex flex-col gap-4 border-b border-[#16587B]/10 pb-5 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#16587B] text-white">
                    <UtensilsCrossed size={16} />
                  </div>
                  <h2 className="text-lg font-black text-[#16587B] md:text-xl">
                    Biểu Đồ Các Món Được Gọi
                  </h2>
                </div>
                <p className="mt-1 text-xs font-semibold text-[#16587B]/70">
                  Phân tích số lượng gọi và tỷ trọng doanh thu của từng món trong ngày {selectedDate}
                </p>
              </div>

              {/* FILTER & TOGGLE BUTTONS - ĐẢM BẢO MÀU SẮC TƯƠNG PHẢN TUYỆT ĐỐI */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-2xl border-2 border-[#16587B] bg-[#F5EEDD] p-1 shadow-inner">
                  {/* Filter theo số lượng */}
                  <button
                    type="button"
                    onClick={() => setFilterMode('quantity')}
                    className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-black transition-all ${
                      filterMode === 'quantity'
                        ? 'choice-active shadow-md'
                        : 'bg-transparent text-[#16587B] hover:bg-white/60'
                    }`}
                  >
                    <ShoppingBag size={14} className={filterMode === 'quantity' ? 'text-white' : 'text-[#16587B]'} />
                    <span>Theo số lượng</span>
                  </button>

                  {/* Filter theo tổng doanh thu */}
                  <button
                    type="button"
                    onClick={() => setFilterMode('revenue')}
                    className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-black transition-all ${
                      filterMode === 'revenue'
                        ? 'choice-active shadow-md'
                        : 'bg-transparent text-[#16587B] hover:bg-white/60'
                    }`}
                  >
                    <CircleDollarSign size={14} className={filterMode === 'revenue' ? 'text-white' : 'text-[#16587B]'} />
                    <span>Theo doanh thu</span>
                  </button>
                </div>

                {/* Filter nhanh mức doanh thu tối thiểu */}
                <select
                  value={minRevenueThreshold}
                  onChange={(e) => setMinRevenueThreshold(Number(e.target.value))}
                  title="Lọc món theo ngưỡng doanh thu"
                  className="h-10 rounded-xl border-2 border-[#16587B]/20 bg-white px-3 text-xs font-black text-[#16587B] outline-none hover:border-[#16587B] focus:border-[#16587B]"
                >
                  <option value={0}>Tất cả doanh thu</option>
                  <option value={50000}>Doanh thu &gt; 50.000 đ</option>
                  <option value={100000}>Doanh thu &gt; 100.000 đ</option>
                  <option value={200000}>Doanh thu &gt; 200.000 đ</option>
                </select>
              </div>
            </div>

            {/* Tìm kiếm món */}
            <div className="relative mb-5">
              <Search size={16} className="absolute left-3.5 top-3.5 text-[#16587B]/50" />
              <input
                type="text"
                value={searchDish}
                onChange={(e) => setSearchDish(e.target.value)}
                placeholder="Tìm tên món trong danh sách hôm nay..."
                className="h-11 w-full rounded-2xl border border-[#16587B]/20 bg-[#F5EEDD]/40 pl-10 pr-4 text-xs font-bold text-[#16587B] outline-none placeholder:text-[#16587B]/40 focus:border-[#16587B] focus:bg-white"
              />
              {searchDish && (
                <button
                  type="button"
                  onClick={() => setSearchDish('')}
                  className="absolute right-3 top-2.5 rounded-lg bg-[#16587B] px-2 py-1 text-[10px] font-bold text-white hover:bg-[#104460]"
                >
                  Xóa
                </button>
              )}
            </div>

            {/* BIỂU ĐỒ BARS */}
            {loading ? (
              <div className="space-y-3 py-6">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-2xl bg-[#F5EEDD]" />
                ))}
              </div>
            ) : processedItems.length === 0 ? (
              <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-[#16587B]/20 bg-[#F5EEDD]/30 p-8 text-center">
                <UtensilsCrossed size={32} className="mb-2 text-[#16587B]/40" />
                <p className="font-bold text-[#16587B]">Chưa có món nào được gọi trong ngày này</p>
                <p className="mt-1 text-xs text-[#16587B]/60">
                  {searchDish || minRevenueThreshold > 0
                    ? 'Không tìm thấy món phù hợp với bộ lọc hiện tại.'
                    : 'Hãy tạo đơn hàng tại quầy để hệ thống tự động ghi nhận số lượng và doanh thu món.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {processedItems.map((item, index) => {
                  const barPercent =
                    filterMode === 'quantity'
                      ? Math.max(6, Math.round((item.quantity / maxQuantity) * 100))
                      : Math.max(6, Math.round((item.revenue / maxRevenue) * 100));

                  const isTop1 = index === 0;
                  const isTop3 = index < 3;

                  return (
                    <motion.div
                      key={item.productId || item.productName}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: index * 0.03 }}
                      className="group relative rounded-2xl border border-[#16587B]/15 bg-white p-3.5 shadow-xs transition-all hover:border-[#16587B]/40 hover:shadow-md"
                    >
                      {/* Dish title & key stats */}
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          {/* Rank badge */}
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs font-black ${
                              isTop1
                                ? 'bg-amber-400 text-amber-950 shadow-xs'
                                : isTop3
                                ? 'bg-[#16587B] text-white'
                                : 'bg-[#F5EEDD] text-[#16587B]'
                            }`}
                          >
                            #{index + 1}
                          </span>

                          <div className="min-w-0">
                            <b className="block truncate text-sm font-black text-[#16587B]">
                              {item.productName}
                            </b>
                            <span className="text-[11px] font-semibold text-[#16587B]/60">
                              Đơn giá: {formatVNCurrency(item.unitPrice)} · Xuất hiện trong{' '}
                              {item.orderCount} đơn
                            </span>
                          </div>
                        </div>

                        {/* Value highlight depending on filter */}
                        <div className="shrink-0 text-right">
                          {filterMode === 'quantity' ? (
                            <>
                              <b className="block text-base font-black text-[#16587B]">
                                {item.quantity} <span className="text-xs font-normal">phần</span>
                              </b>
                              <span className="text-[11px] font-black text-[#385E26]">
                                {formatVNCurrency(item.revenue)} ({item.percentageRevenue}%)
                              </span>
                            </>
                          ) : (
                            <>
                              <b className="block text-base font-black text-[#385E26]">
                                {formatVNCurrency(item.revenue)}
                              </b>
                              <span className="text-[11px] font-black text-[#16587B]/70">
                                {item.quantity} phần ({item.percentageQuantity}%)
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Visual Interactive Bar */}
                      <div className="relative h-4 w-full overflow-hidden rounded-full bg-[#F5EEDD]">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${barPercent}%` }}
                          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                          className={`h-full rounded-full ${
                            filterMode === 'quantity'
                              ? isTop1
                                ? 'bg-gradient-to-r from-[#16587B] to-[#84B3CE]'
                                : 'bg-[#16587B]'
                              : isTop1
                              ? 'bg-gradient-to-r from-[#2e521e] to-[#487a32]'
                              : 'bg-[#385E26]'
                          }`}
                        />
                      </div>

                      {/* Mini footer on bar: percentages */}
                      <div className="mt-1.5 flex items-center justify-between text-[10px] font-bold text-[#16587B]/60">
                        <span>
                          {filterMode === 'quantity'
                            ? `Tỷ trọng số lượng: ${item.percentageQuantity}% tổng món`
                            : `Tỷ trọng doanh thu: ${item.percentageRevenue}% tổng tiền`}
                        </span>
                        <span className="text-right">
                          {filterMode === 'quantity'
                            ? `Doanh thu món: ${formatVNCurrency(item.revenue)}`
                            : `Số lượng gọi: ${item.quantity} phần`}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* BẢNG TỔNG KẾT CHI TIẾT & XEM DANH SÁCH ĐƠN HÀNG */}
            {stats && stats.orders && stats.orders.length > 0 && (
              <div className="mt-8 border-t border-[#16587B]/15 pt-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-[#16587B]">
                    Chi Tiết Các Đơn Hàng Trong Ngày ({stats.orders.length} đơn)
                  </h3>

                  {/* Nút bật/tắt xem danh sách đơn hàng với icon và text tương phản cao */}
                  <button
                    type="button"
                    onClick={() => setShowOrderList((v) => !v)}
                    className="flex items-center gap-1.5 rounded-xl border border-[#16587B]/30 bg-[#16587B] px-3 py-1.5 text-xs font-black text-white shadow-sm transition-transform hover:bg-[#104460] active:scale-95"
                  >
                    <Eye size={14} className="text-white" />
                    <span>{showOrderList ? 'Thu gọn' : 'Xem chi tiết đơn'}</span>
                  </button>
                </div>

                <AnimatePresence>
                  {showOrderList && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 space-y-2 overflow-hidden"
                    >
                      {stats.orders.map((ord) => (
                        <div
                          key={ord.id}
                          className="flex flex-col gap-2 rounded-2xl border border-[#16587B]/15 bg-[#F5EEDD]/30 p-3.5 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="rounded-lg bg-[#16587B] px-2 py-0.5 text-[11px] font-black text-white">
                                {ord.code}
                              </span>
                              <b className="text-xs font-bold text-[#16587B]">{ord.customerName}</b>
                              {ord.customerContact && (
                                <span className="text-[11px] text-[#16587B]/60">({ord.customerContact})</span>
                              )}
                            </div>
                            <p className="mt-1 text-xs font-semibold text-[#16587B]/70">
                              {ord.items.map((i) => `${i.productName} (x${i.quantity})`).join(', ')}
                            </p>
                          </div>

                          <div className="text-right sm:shrink-0">
                            <b className="text-sm font-black text-[#385E26]">
                              {formatVNCurrency(ord.total)}
                            </b>
                            <span className="block text-[10px] font-bold text-[#16587B]/60">
                              {ord.itemCount} món
                            </span>
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            className="fixed left-1/2 top-20 z-[100] flex max-w-sm -translate-x-1/2 items-center gap-2 rounded-2xl bg-[#16587B] px-5 py-3 text-xs font-bold text-white shadow-xl"
          >
            <Check size={16} className="text-white" />
            <span>{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
      <BusinessBottomNav />
    </div>
  );
}
