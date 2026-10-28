'use client';

import Link from 'next/link';
import { Check, Loader2, Pencil, Plus, Tags, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/app/contexts/AuthContext';
import FinanceCategoryIcon from './FinanceCategoryIcon';
import { categoryColors, categoryIconGroups, type CategoryIconName, type FinanceCategory } from './categoryData';

const iconLabels: Record<CategoryIconName, string> = {
  heart: 'Tình yêu', utensils: 'Ăn uống', house: 'Gia đình', users: 'Bạn bè',
  'wallet-cards': 'Tiền bạc', 'shopping-bag': 'Mua sắm', dumbbell: 'Thể thao',
  car: 'Ô tô', bus: 'Di chuyển', plane: 'Du lịch', 'graduation-cap': 'Học tập',
  'briefcase-business': 'Công việc', gift: 'Quà tặng', 'gamepad-2': 'Trò chơi',
  music: 'Âm nhạc', film: 'Phim ảnh', coffee: 'Cà phê', 'paw-print': 'Thú cưng',
  baby: 'Trẻ em', shirt: 'Quần áo', smartphone: 'Điện thoại', wifi: 'Internet',
  pill: 'Thuốc', stethoscope: 'Sức khỏe', sparkles: 'Làm đẹp', leaf: 'Thiên nhiên',
  banknote: 'Tiền mặt', 'piggy-bank': 'Tiết kiệm', landmark: 'Ngân hàng',
  'chart-no-axes-combined': 'Đầu tư', 'circle-ellipsis': 'Khác',
  apple: 'Trái cây', 'badge-dollar-sign': 'Thu nhập', bath: 'Nhà tắm', beer: 'Đồ uống',
  bike: 'Xe đạp', 'book-open': 'Sách', 'building-2': 'Công ty', cake: 'Sinh nhật',
  camera: 'Nhiếp ảnh', church: 'Tín ngưỡng', coins: 'Tiền xu', 'cooking-pot': 'Nấu ăn',
  'flower-2': 'Hoa', fuel: 'Nhiên liệu', glasses: 'Kính mắt', 'hand-heart': 'Từ thiện',
  headphones: 'Tai nghe', hospital: 'Bệnh viện', hotel: 'Khách sạn', 'key-round': 'Nhà cửa',
  laptop: 'Máy tính', lightbulb: 'Ý tưởng', 'map-pin': 'Địa điểm', palette: 'Nghệ thuật',
  'party-popper': 'Tiệc tùng', pizza: 'Đồ ăn nhanh', receipt: 'Hóa đơn', school: 'Trường học',
  scissors: 'Cắt tóc', 'shopping-cart': 'Siêu thị', smile: 'Giải trí', sprout: 'Làm vườn',
  ticket: 'Vé', train: 'Tàu điện', trophy: 'Giải thưởng', wrench: 'Sửa chữa', zap: 'Điện',
  'credit-card': 'Thẻ tín dụng', vault: 'Két tiền', 'hand-coins': 'Nhận tiền',
  'circle-dollar-sign': 'Tài chính', 'badge-cent': 'Cent', 'badge-euro': 'Euro',
  'badge-pound-sterling': 'Bảng Anh', 'badge-japanese-yen': 'Yên Nhật', bitcoin: 'Tiền số',
  percent: 'Lãi suất', calculator: 'Tính toán', 'trending-up': 'Tăng trưởng', 'trending-down': 'Sụt giảm',
};

const blank = () => ({ id: '', name: '', type: 'expense' as 'income' | 'expense', icon: 'utensils' as CategoryIconName, color: '#FFB4A2' });
const card = 'border-2 border-black bg-[#fffaf0] shadow-[4px_4px_0_#000]';

export default function FinanceCategoriesClient() {
  const { token, logout } = useAuth();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }), [token]);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [form, setForm] = useState(blank);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<FinanceCategory | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetch('/api/business/finance/categories', { headers });
      if (response.status === 401) return logout();
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Không tải được danh mục.');
      setCategories(data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không tải được danh mục.');
    } finally { setLoading(false); }
  }, [headers, logout, token]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || saving) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const response = await fetch(form.id ? `/api/business/finance/categories/${form.id}` : '/api/business/finance/categories', {
        method: form.id ? 'PUT' : 'POST', headers, body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Không lưu được danh mục.');
      setCategories(current => form.id ? current.map(item => item.id === data.id ? data : item) : [...current, data]);
      setForm(blank());
      setMessage(form.id ? 'Đã cập nhật danh mục.' : 'Đã tạo danh mục mới.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không lưu được danh mục.'); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    if (!deleteTarget || saving) return;
    setSaving(true); setError('');
    try {
      const response = await fetch(`/api/business/finance/categories/${deleteTarget.id}`, { method: 'DELETE', headers });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Không xóa được danh mục.');
      setCategories(current => current.filter(item => item.id !== deleteTarget.id));
      if (form.id === deleteTarget.id) setForm(blank());
      setDeleteTarget(null); setMessage('Đã xóa danh mục. Giao dịch cũ vẫn được giữ nguyên.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không xóa được danh mục.'); }
    finally { setSaving(false); }
  };

  const groups: Array<{ type: 'expense' | 'income'; title: string }> = [{ type: 'expense', title: 'Danh mục chi' }, { type: 'income', title: 'Danh mục thu' }];

  return <div className="min-h-screen bg-[#f4ead6] p-3 pb-16 pt-[calc(4.75rem+env(safe-area-inset-top,0px))] font-sans text-[#171513] md:flex md:gap-5 md:p-6" style={{backgroundImage:'linear-gradient(rgba(23,21,19,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(23,21,19,.055) 1px,transparent 1px)',backgroundSize:'28px 28px'}}>
    <Sidebar/><main className="min-w-0 flex-1"><div className="mx-auto max-w-7xl">
      <header className={`${card} p-5 md:p-7`}><p className="text-xs font-black uppercase tracking-[.2em]">Tùy chỉnh thu & chi</p><h1 className="mt-1 text-3xl font-black uppercase text-[#df5b2a] md:text-5xl">Danh mục của bạn</h1><p className="mt-2 text-sm font-semibold">Tự tạo danh mục bằng màu sắc và biểu tượng phù hợp với cách bạn quản lý tiền.</p></header>
      <nav className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-4 md:w-fit md:gap-3"><Link href="/business/expenses" className="finance-nav-link">Tổng quan</Link><Link href="/business/expenses/transactions" className="finance-nav-link">Giao dịch</Link><Link href="/business/expenses/accounts" className="finance-nav-link">Khoản tiền</Link><Link href="/business/expenses/categories" className="finance-nav-link is-active"><Tags/> Danh mục</Link></nav>

      <div className="mt-7 grid gap-7 lg:grid-cols-[.8fr_1.2fr]">
        <form onSubmit={save} className={`${card} h-fit p-4 md:p-6`}>
          <div className="finance-category-name-editor">
            <FinanceCategoryIcon name={form.icon} color={form.color}/>
            <label className="min-w-0 flex-1"><span>{form.id ? 'Sửa tên danh mục' : 'Đặt tên danh mục'}</span><input autoFocus={false} maxLength={40} required value={form.name} onChange={event=>setForm({...form,name:event.target.value})} placeholder="Ăn trưa, Lương, Du lịch..."/></label>
            <button disabled={saving||!form.name.trim()} className="finance-category-save" type="submit" aria-label={form.id?'Lưu thay đổi':'Tạo danh mục'} title={form.id?'Lưu thay đổi':'Tạo danh mục'}>{saving?<Loader2 className="animate-spin"/>:form.id?<Check/>:<Plus/>}</button>
          </div>
          {form.id&&<button type="button" className="finance-category-cancel mt-3" onClick={()=>setForm(blank())}><X/> Hủy chỉnh sửa</button>}
          <div className="mt-5"><span className="mb-2 block text-xs font-black uppercase">Loại danh mục</span><div className="grid grid-cols-2 gap-3"><button type="button" aria-pressed={form.type==='expense'} onClick={()=>setForm({...form,type:'expense'})} className="finance-category-type expense">Khoản chi</button><button type="button" aria-pressed={form.type==='income'} onClick={()=>setForm({...form,type:'income'})} className="finance-category-type income">Khoản thu</button></div></div>
          <fieldset className="mt-5"><legend className="mb-2 text-xs font-black uppercase">Chọn biểu tượng</legend><div className="finance-category-icon-groups">{categoryIconGroups.map(group=><section key={group.label}><h3>{group.label}</h3><div className="finance-category-icon-grid">{group.icons.map(icon=><button type="button" key={icon} title={iconLabels[icon]} aria-label={iconLabels[icon]} aria-pressed={form.icon===icon} onClick={()=>setForm({...form,icon})}><FinanceCategoryIcon name={icon} color={form.color}/></button>)}</div></section>)}</div></fieldset>
          <fieldset className="mt-5"><legend className="mb-2 text-xs font-black uppercase">Màu pastel</legend><div className="finance-category-color-grid">{categoryColors.map(color=><button type="button" key={color} aria-label={`Màu ${color}`} aria-pressed={form.color===color} style={{backgroundColor:color}} onClick={()=>setForm({...form,color})}>{form.color===color&&<Check/>}</button>)}<label className="finance-custom-color" title="Tự chọn màu khác" aria-label="Tự chọn màu khác"><Plus/><input type="color" value={form.color} onChange={event=>setForm({...form,color:event.target.value.toUpperCase()})}/></label></div></fieldset>
          {error&&<p role="alert" className="mt-4 border-2 border-black bg-[#ffc9ba] p-3 text-sm font-bold">{error}</p>}
          {message&&<p role="status" className="mt-4 border-2 border-black bg-[#c9f1d5] p-3 text-sm font-bold">{message}</p>}
        </form>

        <section className="space-y-6">{loading?<div className={`${card} grid min-h-48 place-items-center`}><Loader2 className="animate-spin"/></div>:groups.map(group=>{
          const items=categories.filter(item=>item.type===group.type);
          return <article className={`${card} overflow-hidden`} key={group.type}><header className={`border-b-2 border-black p-4 ${group.type==='expense'?'bg-[#ffb29f]':'bg-[#aee9c0]'}`}><h2 className="font-black uppercase">{group.title}</h2><p className="text-xs font-bold">{items.length} danh mục tự tạo</p></header>{items.length?<div>{items.map(item=><div className="finance-category-row" key={item.id}><FinanceCategoryIcon name={item.icon} color={item.color}/><b className="min-w-0 flex-1 truncate">{item.name}</b><button type="button" aria-label={`Sửa ${item.name}`} onClick={()=>{setForm({...item,icon:item.icon as CategoryIconName});window.scrollTo({top:0,behavior:'smooth'})}}><Pencil/></button><button type="button" aria-label={`Xóa ${item.name}`} onClick={()=>setDeleteTarget(item)}><Trash2/></button></div>)}</div>:<div className="p-8 text-center"><Tags className="mx-auto opacity-40"/><b className="mt-3 block">Chưa có danh mục</b><p className="mt-1 text-sm font-semibold opacity-60">Danh mục hệ thống không còn được tạo tự động.</p></div>}</article>
        })}</section>
      </div>
    </div></main>
    {deleteTarget&&<div className="finance-picker-backdrop" onMouseDown={()=>!saving&&setDeleteTarget(null)}><section className="finance-picker-panel p-5" role="alertdialog" aria-modal="true" aria-label="Xóa danh mục" onMouseDown={event=>event.stopPropagation()}><div className="flex items-center gap-3"><FinanceCategoryIcon name={deleteTarget.icon} color={deleteTarget.color}/><div><h2 className="font-black uppercase">Xóa “{deleteTarget.name}”?</h2><p className="mt-1 text-sm font-semibold">Danh mục sẽ bị xóa, nhưng các giao dịch cũ vẫn được giữ nguyên.</p></div></div><div className="mt-6 grid grid-cols-2 gap-3"><button type="button" className="finance-category-dialog-button" disabled={saving} onClick={()=>setDeleteTarget(null)}>Hủy</button><button type="button" className="finance-category-dialog-button danger" disabled={saving} onClick={()=>void remove()}>{saving?<Loader2 className="animate-spin"/>:<Trash2/>} Xóa</button></div></section></div>}
  </div>;
}
