'use client';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { Check, Copy, KeyRound, Loader2, Plus, RefreshCw, Trash2, UserPlus } from 'lucide-react';
import { useAuth } from '@/app/contexts/AuthContext';
import Sidebar from '@/components/Sidebar';
import AdminTabs from '@/components/AdminTabs';

type Code = { id:string; code:string; is_used:boolean; used_by_username:string|null; created_at:string; created_by:string|null };

export default function RegistrationCodesPage() {
  const { user, token, logout, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [codes, setCodes] = useState<Code[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const headers = { Authorization: `Bearer ${token || ''}` };
  const reportError = (value: unknown, fallback: string) => {
    if (axios.isAxiosError(value) && value.response?.status === 401) logout();
    setError(axios.isAxiosError(value) && typeof value.response?.data?.detail === 'string' ? value.response.data.detail : fallback);
  };
  useEffect(() => { if (!authLoading && (!user || user.role !== 'admin')) router.replace('/business'); }, [authLoading, user, router]);
  useEffect(() => {
    if (user?.role !== 'admin' || !token) return;
    let active = true;
    axios.get<Code[]>('/api/admin/registration-codes', { headers: { Authorization: `Bearer ${token}` } })
      .then(response => { if (active) setCodes(response.data); })
      .catch(value => { if (active) setError(axios.isAxiosError(value) && typeof value.response?.data?.detail === 'string' ? value.response.data.detail : 'Không thể tải danh sách mã đăng ký.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.role, token]);
  const copy = async (code: string) => { try { await navigator.clipboard.writeText(code); setNotice(`Đã sao chép mã ${code}`); } catch { setNotice(`Mã mới: ${code}`); } };
  const create = async () => { setCreating(true); setError(''); try { const item=(await axios.post<Code>('/api/admin/registration-codes',{}, {headers})).data; setCodes(v=>[item,...v]); await copy(item.code); } catch(e){reportError(e,'Không thể tạo mã.');} finally{setCreating(false);} };
  const regenerate = async (item: Code) => { setError(''); try { const next=(await axios.put<Code>(`/api/admin/registration-codes/${item.id}`,{}, {headers})).data; setCodes(v=>v.map(x=>x.id===item.id?next:x)); await copy(next.code); } catch(e){reportError(e,'Không thể đổi mã.');} };
  const remove = async (item: Code) => { if (!confirm(`Xóa mã ${item.code}?`)) return; try { await axios.delete(`/api/admin/registration-codes/${item.id}`,{headers}); setCodes(v=>v.filter(x=>x.id!==item.id)); setNotice('Đã xóa mã chưa sử dụng.'); } catch(e){reportError(e,'Không thể xóa mã.');} };
  if (authLoading || !user || user.role !== 'admin') return <div className="min-h-screen bg-[#D8C9BB]"/>;
  const unused = codes.filter(x=>!x.is_used).length;
  return <div className="min-h-[100dvh] bg-[#D8C9BB] p-3 pb-24 pt-20 text-[#292421] md:flex md:gap-5 md:p-6"><Sidebar/><main className="min-w-0 flex-1"><div className="mx-auto max-w-6xl space-y-4">
    <header className="rounded-3xl border border-[#E7DED4] bg-[#FAF7F2] p-5 shadow-sm md:p-7"><div className="flex flex-col justify-between gap-4 md:flex-row md:items-start"><div><p className="text-xs font-black uppercase tracking-[.15em] text-[#766B63]">Quản trị người dùng</p><h1 className="mt-1 text-2xl font-black md:text-3xl">Cấp tài khoản bán hàng</h1><p className="mt-1 text-sm font-medium text-[#6F655E]">Tạo mã dùng một lần, gửi cho nhân viên rồi họ đăng ký tại trang đăng ký.</p></div><AdminTabs/></div></header>
    <section className="rounded-3xl border border-[#E7DED4] bg-[#FAF7F2] p-4 shadow-sm md:p-6"><div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-2"><span className="rounded-full bg-white px-3 py-2 text-xs font-black">{unused} mã có thể dùng</span><span className="rounded-full bg-white px-3 py-2 text-xs font-black">{codes.length} mã tất cả</span></div><button onClick={create} disabled={creating} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#203354] px-5 text-sm font-black text-white disabled:opacity-50">{creating?<Loader2 className="animate-spin"/>:<Plus/>} Tạo và sao chép mã</button></div>
    {error&&<div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}{notice&&<div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-700"><Check size={17}/>{notice}</div>}
    {loading?<div className="flex min-h-48 items-center justify-center"><Loader2 className="animate-spin text-[#203354]"/></div>:codes.length===0?<div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-[#D5C9BC] bg-white/50 p-6 text-center"><UserPlus size={36} className="mb-3 text-[#766B63]"/><b>Chưa có mã đăng ký</b><p className="mt-1 text-sm text-[#766B63]">Tạo mã đầu tiên để cấp tài khoản cho người bán hàng.</p></div>:<div className="space-y-2">{codes.map(item=><article key={item.id} className="flex flex-col gap-3 rounded-2xl border border-[#E4D9CE] bg-white p-4 sm:flex-row sm:items-center"><div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${item.is_used?'bg-gray-100 text-gray-500':'bg-emerald-50 text-emerald-700'}`}><KeyRound size={20}/></div><div className="min-w-0 flex-1"><button onClick={()=>copy(item.code)} className="font-mono text-base font-black tracking-wider text-[#203354] hover:underline">{item.code}</button><p className="mt-1 text-xs font-semibold text-[#766B63]">{item.is_used?`Đã dùng bởi @${item.used_by_username||'không rõ'}`:'Sẵn sàng sử dụng'} · {new Date(item.created_at).toLocaleString('vi-VN')}</p></div><div className="flex gap-2"><button onClick={()=>copy(item.code)} title="Sao chép" className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#D9CFC4]"><Copy size={17}/></button>{!item.is_used&&<><button onClick={()=>regenerate(item)} title="Đổi mã" className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#D9CFC4]"><RefreshCw size={17}/></button><button onClick={()=>remove(item)} title="Xóa mã" className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 text-red-600"><Trash2 size={17}/></button></>}</div></article>)}</div>}
    </section></div></main></div>;
}
