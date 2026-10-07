'use client';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { Check, Copy, KeyRound, Loader2, Plus, RefreshCw, RotateCcw, ShieldAlert, Store, Trash2, UserCheck, UserPlus, Users } from 'lucide-react';
import { useAuth } from '@/app/contexts/AuthContext';
import Sidebar from '@/components/Sidebar';
import AdminTabs from '@/components/AdminTabs';
import ResetAccountModal from '@/components/ResetAccountModal';

type Code = { id:string; code:string; is_used:boolean; used_by_username:string|null; created_at:string; created_by:string|null };

type AccountUser = {
  id: string;
  username: string;
  email: string | null;
  role: string;
  createdAt: string;
  _count?: {
    products: number;
    orders: number;
    customers: number;
    ledgers: number;
  };
};

export default function RegistrationCodesPage() {
  const { user, token, logout, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [codes, setCodes] = useState<Code[]>([]);
  const [users, setUsers] = useState<AccountUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [resetTargetUser, setResetTargetUser] = useState<AccountUser | null>(null);

  const headers = { Authorization: `Bearer ${token || ''}` };

  const reportError = (value: unknown, fallback: string) => {
    if (axios.isAxiosError(value) && value.response?.status === 401) logout();
    setError(axios.isAxiosError(value) && typeof value.response?.data?.detail === 'string' ? value.response.data.detail : fallback);
  };

  useEffect(() => { if (!authLoading && (!user || user.role !== 'admin')) router.replace('/business'); }, [authLoading, user, router]);

  const loadCodes = async () => {
    try {
      const response = await axios.get<Code[]>('/api/admin/registration-codes', { headers });
      setCodes(response.data);
    } catch (value) {
      reportError(value, 'Không thể tải danh sách mã đăng ký.');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await axios.get<AccountUser[]>('/api/backend/api/admin/users', { headers });
      setUsers(response.data);
    } catch {
      // ignore
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (user?.role !== 'admin' || !token) return;
    loadCodes();
    loadUsers();
  }, [user?.role, token]);

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setNotice(`Đã sao chép mã ${code}`);
    } catch {
      setNotice(`Mã mới: ${code}`);
    }
  };

  const create = async () => {
    setCreating(true);
    setError('');
    try {
      const item = (await axios.post<Code>('/api/admin/registration-codes', {}, { headers })).data;
      setCodes(v => [item, ...v]);
      await copy(item.code);
    } catch (e) {
      reportError(e, 'Không thể tạo mã.');
    } finally {
      setCreating(false);
    }
  };

  const regenerate = async (item: Code) => {
    setError('');
    try {
      const next = (await axios.put<Code>(`/api/admin/registration-codes/${item.id}`, {}, { headers })).data;
      setCodes(v => v.map(x => x.id === item.id ? next : x));
      await copy(next.code);
    } catch (e) {
      reportError(e, 'Không thể đổi mã.');
    }
  };

  const remove = async (item: Code) => {
    if (!confirm(`Xóa mã ${item.code}?`)) return;
    try {
      await axios.delete(`/api/admin/registration-codes/${item.id}`, { headers });
      setCodes(v => v.filter(x => x.id !== item.id));
      setNotice('Đã xóa mã chưa sử dụng.');
    } catch (e) {
      reportError(e, 'Không thể xóa mã.');
    }
  };

  if (authLoading || !user || user.role !== 'admin') return <div className="min-h-screen bg-[#E0E0E0]" />;

  const unused = codes.filter(x => !x.is_used).length;

  return (
    <div className="min-h-screen bg-[#E0E0E0] p-3 pb-[calc(12rem+env(safe-area-inset-bottom))] pt-[calc(4.75rem+env(safe-area-inset-top,0px))] text-[#2B2B2B] md:flex md:gap-5 md:p-6 md:pt-6 md:pb-8">
      <Sidebar />
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl space-y-4">
          <header className="card-push rounded-3xl p-5 md:p-7">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
              <div>
                <p className="text-xs font-black uppercase tracking-[.15em] text-[#565656]">Quản trị hệ thống</p>
                <h1 className="mt-1 text-2xl font-black md:text-3xl text-[#2B2B2B]">Tài khoản & Mô hình kinh doanh</h1>
                <p className="mt-1 text-sm font-medium text-[#565656]">
                  Cấp mã tài khoản mới, xem danh sách cửa hàng và xóa sạch dữ liệu hệ thống khi chủ doanh nghiệp muốn đổi mô hình kinh doanh.
                </p>
              </div>
              <AdminTabs />
            </div>
          </header>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
          {notice && <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-700"><Check size={17} />{notice}</div>}

          {/* Section: Danh sách tài khoản cửa hàng & Clear hệ thống */}
          <section className="card-push rounded-3xl p-4 md:p-6">
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Users size={20} className="text-[#2B2B2B]" />
                <h2 className="text-lg font-black text-[#2B2B2B]">Danh sách tài khoản cửa hàng</h2>
              </div>
              <span className="text-xs font-bold text-[#565656] bg-white rounded-full px-3 py-1 border border-[#848484] w-fit">
                {users.length} tài khoản trong hệ thống
              </span>
            </div>

            <p className="mb-4 text-xs font-semibold leading-relaxed text-[#565656]">
              Mỗi tài khoản là một cửa hàng riêng biệt. Khi chủ shop muốn chuyển sang mô hình kinh doanh khác, bấm nút <b className="text-red-700">"Clear dữ liệu (Đổi mô hình)"</b> để xóa sạch dữ liệu của riêng tài khoản đó. Các tài khoản khác tuyệt đối không bị đụng đến.
            </p>

            {loadingUsers ? (
              <div className="flex min-h-24 items-center justify-center">
                <Loader2 className="animate-spin text-[#2B2B2B]" />
              </div>
            ) : users.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#848484] bg-white/50 p-5 text-center text-sm text-[#848484]">
                Chưa có tài khoản nào được đăng ký.
              </div>
            ) : (
              <div className="space-y-2.5">
                {users.map(u => {
                  const isCurrent = u.id === user.id;
                  const prodCount = u._count?.products ?? 0;
                  const orderCount = u._count?.orders ?? 0;

                  return (
                    <article
                      key={u.id}
                      className="flex flex-col gap-3 rounded-2xl border border-[#848484]/30 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${u.role === 'admin' ? 'bg-[#2B2B2B] text-white' : 'bg-[#E0E0E0] text-[#2B2B2B]'}`}>
                          <Store size={20} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-base font-black text-[#2B2B2B]">@{u.username}</span>
                            {isCurrent && (
                              <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800">
                                Bạn
                              </span>
                            )}
                            <span className={`rounded-md px-2 py-0.5 text-[10px] font-black ${u.role === 'admin' ? 'bg-amber-100 text-amber-900' : 'bg-[#E0E0E0] text-[#2B2B2B]'}`}>
                              {u.role === 'admin' ? 'Admin' : 'Người bán'}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs font-semibold text-[#848484]">
                            Đã tạo: {new Date(u.createdAt).toLocaleDateString('vi-VN')} · {prodCount} sản phẩm · {orderCount} đơn hàng
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setResetTargetUser(u)}
                          className="btn-push-danger flex h-10 items-center gap-2 rounded-full px-4 text-xs font-black text-[#9B3B30]"
                          title={`Clear toàn bộ hệ thống của @${u.username} để đổi sang mô hình kinh doanh mới`}
                        >
                          <RotateCcw size={14} className="text-[#9B3B30]" />
                          <span>Clear dữ liệu (Đổi mô hình)</span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* Section: Cấp mã đăng ký tài khoản */}
          <section className="card-push rounded-3xl p-4 md:p-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-2">
                <span className="btn-push flex items-center rounded-full px-3 py-1.5 text-xs font-black pointer-events-none">{unused} mã có thể dùng</span>
                <span className="btn-push flex items-center rounded-full px-3 py-1.5 text-xs font-black pointer-events-none">{codes.length} mã tất cả</span>
              </div>
              <button
                onClick={create}
                disabled={creating}
                className="btn-push-primary flex h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-black disabled:opacity-50"
              >
                {creating ? <Loader2 className="animate-spin" /> : <Plus />} Tạo và sao chép mã
              </button>
            </div>

            {loading ? (
              <div className="flex min-h-48 items-center justify-center">
                <Loader2 className="animate-spin text-[#2B2B2B]" />
              </div>
            ) : codes.length === 0 ? (
              <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-[#848484] bg-white/50 p-6 text-center">
                <UserPlus size={36} className="mb-3 text-[#848484]" />
                <b>Chưa có mã đăng ký</b>
                <p className="mt-1 text-sm text-[#848484]">Tạo mã đầu tiên để cấp tài khoản cho người bán hàng.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {codes.map(item => (
                  <article key={item.id} className="flex flex-col gap-3 rounded-2xl border border-[#848484]/30 bg-white p-4 sm:flex-row sm:items-center">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${item.is_used ? 'bg-gray-100 text-gray-500' : 'bg-emerald-50 text-emerald-700'}`}>
                      <KeyRound size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <button onClick={() => copy(item.code)} className="font-mono text-base font-black tracking-wider text-[#2B2B2B] hover:underline">
                        {item.code}
                      </button>
                      <p className="mt-1 text-xs font-semibold text-[#848484]">
                        {item.is_used ? `Đã dùng bởi @${item.used_by_username || 'không rõ'}` : 'Sẵn sàng sử dụng'} · {new Date(item.created_at).toLocaleString('vi-VN')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => copy(item.code)} title="Sao chép" className="btn-push flex h-10 w-10 items-center justify-center rounded-xl text-[#2B2B2B]">
                        <Copy size={17} />
                      </button>
                      {!item.is_used && (
                        <>
                          <button onClick={() => regenerate(item)} title="Đổi mã" className="btn-push flex h-10 w-10 items-center justify-center rounded-xl text-[#2B2B2B]">
                            <RefreshCw size={17} />
                          </button>
                          <button onClick={() => remove(item)} title="Xóa mã" className="btn-push-danger flex h-10 w-10 items-center justify-center rounded-xl text-[#9B3B30]">
                            <Trash2 size={17} />
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Modal Clear Dữ liệu */}
      {resetTargetUser && (
        <ResetAccountModal
          isOpen={!!resetTargetUser}
          onClose={() => setResetTargetUser(null)}
          targetUsername={resetTargetUser.username}
          targetUserId={resetTargetUser.id}
          token={token}
          onSuccess={msg => {
            setNotice(msg);
            loadUsers();
          }}
        />
      )}
    </div>
  );
}
