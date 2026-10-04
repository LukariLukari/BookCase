'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Banknote,
  Check,
  ChevronRight,
  Clock3,
  Loader2,
  PackageCheck,
  Search,
  Truck,
  WalletCards,
  X,
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/app/contexts/AuthContext';

type Order = {
  id: string;
  code: string;
  customer_name: string;
  customer_contact?: string;
  status: string;
  payment_status: string;
  ordered_at: string;
  total: number;
  items: { product_name: string; quantity: number }[];
};

const states = [
  {
    key: 'confirmed',
    label: 'Mới xác nhận',
    icon: Clock3,
    color: 'bg-blue-100 text-blue-900 border-2 border-[#203354]',
  },
  {
    key: 'packing',
    label: 'Đang đóng gói',
    icon: PackageCheck,
    color: 'bg-amber-100 text-amber-950 border-2 border-[#203354]',
  },
  {
    key: 'shipping',
    label: 'Đang giao',
    icon: Truck,
    color: 'bg-purple-100 text-purple-950 border-2 border-[#203354]',
  },
  {
    key: 'completed',
    label: 'Hoàn tất',
    icon: Check,
    color: 'bg-emerald-100 text-emerald-950 border-2 border-[#203354]',
  },
];

const money = (v = 0) => `${v.toLocaleString('vi-VN')} đ`;

export default function WorkflowClient() {
  const { user, token, isLoading } = useAuth();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [payment, setPayment] = useState<Order | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('transfer');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!token) return;
    let active = true;
    axios
      .get<Order[]>('/api/backend/api/business/orders?limit=100', { headers })
      .then((r) => {
        if (active) setOrders(r.data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, headers]);

  const shown = orders.filter(
    (o) =>
      o.status !== 'cancelled' &&
      `${o.code} ${o.customer_name} ${o.customer_contact || ''}`
        .toLowerCase()
        .includes(search.toLowerCase())
  );

  const move = async (order: Order, status: string) => {
    try {
      await axios.patch(`/api/sales/orders/${order.id}/status`, { status }, { headers });
      setOrders((old) => old.map((o) => (o.id === order.id ? { ...o, status } : o)));
      setToast('Đã cập nhật trạng thái đơn.');
      setTimeout(() => setToast(''), 1800);
    } catch (e) {
      setToast(
        axios.isAxiosError(e)
          ? e.response?.data?.detail || 'Không thể cập nhật.'
          : 'Không thể cập nhật.'
      );
    }
  };

  const pay = async () => {
    if (!payment || !Number(amount)) return;
    setSaving(true);
    try {
      await axios.post(
        `/api/sales/orders/${payment.id}/payments`,
        { amount: Number(amount), method },
        { headers }
      );
      setOrders((old) =>
        old.map((o) =>
          o.id === payment.id
            ? { ...o, payment_status: Number(amount) >= o.total ? 'paid' : 'partial' }
            : o
        )
      );
      setPayment(null);
      setAmount('');
      setToast('Đã ghi nhận thanh toán.');
      setTimeout(() => setToast(''), 1800);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !user) return <div className="min-h-screen bg-[#D8C9BB]" />;

  const pending = orders.filter((o) => o.payment_status !== 'paid' && o.status !== 'cancelled');

  return (
    <div className="min-h-[100dvh] bg-[#D8C9BB] p-3 pb-24 pt-20 text-[#292421] md:flex md:gap-5 md:p-6 md:pt-6">
      <Sidebar />
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1500px]">
          {/* Header 3D Card */}
          <header className="card-push mb-6 p-6 md:p-8">
            <p className="text-[11px] font-black uppercase tracking-[.2em] text-[#766B63]">
              Trung tâm vận hành
            </p>
            <h1 className="mt-1 text-2xl font-black md:text-3xl text-[#203354]">
              Theo dõi và xử lý đơn
            </h1>
            <p className="mt-1 text-sm font-semibold text-[#6F655E]">
              Nhìn toàn bộ tiến độ, chuyển bước và thu công nợ ngay tại một màn hình.
            </p>

            {/* 4 Chunky 3D Stat Cards */}
            <div className="mt-6 grid grid-cols-2 gap-3.5 md:grid-cols-4">
              {[
                ['Cần đóng gói', orders.filter((o) => o.status === 'confirmed').length],
                ['Đang giao', orders.filter((o) => o.status === 'shipping').length],
                ['Chưa thu đủ', pending.length],
                ['Công nợ', money(pending.reduce((s, o) => s + o.total, 0))],
              ].map(([l, v]) => (
                <div
                  key={String(l)}
                  className="card-push-subtle p-4 flex flex-col justify-between"
                >
                  <p className="text-[10px] font-black uppercase tracking-wider text-[#7B7067]">
                    {l}
                  </p>
                  <b className="mt-1.5 block text-lg font-black text-[#203354] md:text-xl">
                    {v}
                  </b>
                </div>
              ))}
            </div>
          </header>

          {/* 3D Search Bar */}
          <div className="input-push mb-6 flex items-center px-4 py-1.5">
            <Search className="h-5 w-5 shrink-0 text-[#203354]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm mã đơn, khách hàng hoặc số điện thoại..."
              className="h-11 w-full bg-transparent pl-3 pr-2 text-sm font-bold text-[#203354] placeholder-[#8E8379] outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="btn-push h-8 w-8 rounded-full text-xs"
                title="Xóa tìm kiếm"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Kanban Board Columns */}
          {loading ? (
            <div className="card-push my-12 flex min-h-[300px] items-center justify-center p-8">
              <Loader2 className="animate-spin text-[#203354]" size={36} />
            </div>
          ) : (
            <section className="grid gap-4 xl:grid-cols-4">
              {states.map((state, index) => {
                const Icon = state.icon;
                const list = shown.filter((o) => (o.status || 'confirmed') === state.key);
                return (
                  <div
                    key={state.key}
                    className="min-w-0 rounded-3xl border-2 border-[#203354] bg-[#FAF7F2]/90 p-4 shadow-[0_5px_0_0_#203354]"
                  >
                    {/* Column Header */}
                    <div className="mb-4 flex items-center justify-between">
                      <div className="badge-push flex items-center gap-2 px-3.5 py-1.5">
                        <span className={`flex h-6 w-6 items-center justify-center rounded-full ${state.color}`}>
                          <Icon size={14} />
                        </span>
                        <b className="text-xs font-black text-[#203354]">{state.label}</b>
                      </div>
                      <span className="rounded-full border-2 border-[#203354] bg-white px-3 py-0.5 text-xs font-black text-[#203354] shadow-[0_2px_0_0_#203354]">
                        {list.length}
                      </span>
                    </div>

                    {/* Order Cards List */}
                    <div className="space-y-3.5">
                      {list.map((order) => (
                        <article
                          key={order.id}
                          className="card-push-subtle p-4 space-y-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <b className="block truncate text-sm font-extrabold text-[#203354]">
                                {order.customer_name}
                              </b>
                              <p className="text-[10px] font-black text-[#7B7067]">
                                {order.code} · {new Date(order.ordered_at).toLocaleDateString('vi-VN')}
                              </p>
                            </div>
                            <b className="shrink-0 text-xs font-black text-[#203354]">
                              {money(order.total)}
                            </b>
                          </div>

                          <p className="line-clamp-2 text-xs font-semibold text-[#70665E]">
                            {order.items.map((i) => `${i.product_name} ×${i.quantity}`).join(', ')}
                          </p>

                          {/* 3D Push Action Buttons */}
                          <div className="flex items-center gap-2 pt-1">
                            {order.payment_status !== 'paid' ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setPayment(order);
                                  setAmount(String(order.total));
                                }}
                                className="btn-push-amber flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-xs font-black"
                              >
                                <Banknote size={15} /> Thu tiền
                              </button>
                            ) : (
                              <span className="btn-push-emerald flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-xs font-black">
                                <Check size={14} /> Đã thu
                              </span>
                            )}

                            {index < states.length - 1 && (
                              <button
                                type="button"
                                onClick={() => move(order, states[index + 1].key)}
                                title={`Chuyển sang ${states[index + 1].label}`}
                                className="btn-push-primary flex h-10 w-11 shrink-0 items-center justify-center rounded-full"
                              >
                                <ChevronRight size={18} />
                              </button>
                            )}
                          </div>
                        </article>
                      ))}

                      {!list.length && (
                        <div className="rounded-2xl border-2 border-dashed border-[#D2C5B8] p-6 text-center text-xs font-extrabold text-[#887B71]">
                          Không có đơn
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </section>
          )}
        </div>
      </main>

      {/* 3D Toast Notification */}
      {toast && (
        <div className="btn-push-primary fixed left-1/2 top-20 z-[120] flex -translate-x-1/2 items-center gap-2 px-6 py-3 rounded-full text-sm font-black">
          <Check size={18} />
          {toast}
        </div>
      )}

      {/* Payment Modal with 3D Pop Elevation */}
      {payment && (
        <div
          className="fixed inset-0 z-[100] flex items-end bg-black/40 backdrop-blur-[2px] md:items-center md:justify-center md:p-5"
          onMouseDown={() => setPayment(null)}
        >
          <div
            className="card-push w-full max-h-[92vh] overflow-y-auto rounded-t-3xl p-6 md:max-w-md md:rounded-[32px]"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-black text-[#203354]">Ghi nhận thanh toán</h2>
                <p className="text-xs font-semibold text-[#70665E]">
                  {payment.code} · {payment.customer_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPayment(null)}
                className="btn-push flex h-9 w-9 items-center justify-center rounded-full"
                title="Đóng"
              >
                <X size={18} />
              </button>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-black text-[#203354]">Số tiền</span>
              <div className="input-push px-4 py-1.5 rounded-2xl">
                <input
                  value={Number(amount || 0).toLocaleString('vi-VN')}
                  onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                  inputMode="numeric"
                  className="h-10 w-full bg-transparent text-lg font-black text-[#203354] outline-none"
                />
              </div>
            </label>

            <label className="mt-4 block">
              <span className="mb-1.5 block text-xs font-black text-[#203354]">Phương thức</span>
              <div className="input-push px-4 py-1.5 rounded-2xl">
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="h-10 w-full bg-transparent text-sm font-bold text-[#203354] outline-none cursor-pointer"
                >
                  <option value="transfer">Chuyển khoản</option>
                  <option value="cash">Tiền mặt</option>
                  <option value="cod">COD</option>
                  <option value="wallet">Ví điện tử</option>
                </select>
              </div>
            </label>

            <button
              type="button"
              onClick={pay}
              disabled={saving}
              className="btn-push-primary mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full font-black text-sm disabled:opacity-50"
            >
              <WalletCards size={18} />
              {saving ? 'Đang lưu...' : 'Xác nhận thanh toán'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
