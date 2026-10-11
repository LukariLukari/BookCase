'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Camera, Check, Loader2, PackageOpen, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/app/contexts/AuthContext';

const API = process.env.NEXT_PUBLIC_API_URL || '/api/backend';
const input = 'h-12 w-full rounded-xl border border-[#16587B]/25 bg-white px-3 text-sm font-bold text-[#16587B] outline-none focus:border-[#16587B]';
type Product = { id:string; name:string; sku?:string; category?:string; image_url?:string; selling_price:number; unit_cost:number; track_stock?:boolean; notes?:string };
type Draft = { id:string; name:string; sku:string; category:string; image_url:string; selling_price:string; unit_cost:string; notes:string };
const blank = ():Draft => ({id:'',name:'',sku:'',category:'',image_url:'',selling_price:'',unit_cost:'',notes:''});
const numberValue = (value:string) => Number(value.replace(/\D/g,'')) || 0;
const money = (value:number) => `${Math.round(value).toLocaleString('vi-VN')} đ`;

export default function ProductCatalogClient(){
  const {user,token:contextToken,logout,isLoading}=useAuth();
  const router=useRouter();
  const token=contextToken||(typeof window!=='undefined'?(localStorage.getItem('token')||localStorage.getItem('access_token')):null);
  const headers=useMemo(()=>({Authorization:`Bearer ${token}`}),[token]);
  const [products,setProducts]=useState<Product[]>([]),[draft,setDraft]=useState<Draft>(blank),[editing,setEditing]=useState(false),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[search,setSearch]=useState(''),[message,setMessage]=useState('');
  const notify=(text:string)=>{setMessage(text);window.setTimeout(()=>setMessage(''),2400)};

  useEffect(()=>{if(!isLoading&&!user)router.replace('/login')},[isLoading,user,router]);
  useEffect(()=>{if(!token||!user)return;let active=true;axios.get<Product[]>(`${API}/api/business/products`,{headers}).then(response=>{if(active)setProducts(response.data.filter(product=>product.track_stock===false))}).catch(error=>{if(error?.response?.status===401)logout();else notify('Không tải được danh mục món bán POS.')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[token,user,headers,logout]);

  const shown=products.filter(product=>`${product.name} ${product.sku||''} ${product.category||''}`.toLowerCase().includes(search.trim().toLowerCase()));
  const edit=(product:Product)=>{setDraft({id:product.id,name:product.name,sku:product.sku||'',category:product.category||'',image_url:product.image_url||'',selling_price:String(product.selling_price||''),unit_cost:String(product.unit_cost||''),notes:product.notes||''});setEditing(true);window.scrollTo({top:0,behavior:'smooth'})};
  const pickImage=(file?:File)=>{if(!file)return;const reader=new FileReader();reader.onload=()=>setDraft(current=>({...current,image_url:String(reader.result)}));reader.readAsDataURL(file)};
  const save=async()=>{if(!draft.name.trim())return notify('Nhập tên món bán.');setSaving(true);try{const payload={name:draft.name.trim(),sku:draft.sku||null,category:draft.category||null,image_url:draft.image_url||null,selling_price:numberValue(draft.selling_price),unit_cost:numberValue(draft.unit_cost),stock_quantity:0,track_stock:false,batch_id:null,notes:draft.notes||null,is_active:true};const response=draft.id?await axios.put<Product>(`${API}/api/business/products/${draft.id}`,payload,{headers}):await axios.post<Product>(`${API}/api/business/products`,payload,{headers});setProducts(current=>draft.id?current.map(item=>item.id===draft.id?response.data:item):[response.data,...current]);setDraft(blank());setEditing(false);notify(draft.id?'Đã cập nhật món bán.':'Đã thêm món bán POS.')}catch(error){if(axios.isAxiosError(error)&&error.response?.status===401)logout();else notify('Không lưu được món bán.')}finally{setSaving(false)}};
  const remove=async(product:Product)=>{if(!confirm(`Xóa món "${product.name}" khỏi danh mục POS?`))return;try{await axios.delete(`${API}/api/business/products/${product.id}`,{headers});setProducts(current=>current.filter(item=>item.id!==product.id));notify('Đã xóa món bán.')}catch{notify('Không xóa được món bán này.')}};

  if(isLoading||!user)return <div className="min-h-screen"/>;
  return <div className="min-h-screen w-full p-3 pb-20 pt-[calc(4.75rem+env(safe-area-inset-top,0px))] text-[#16587B] md:flex md:gap-5 md:p-6">
    <Sidebar/>
    <main className="min-w-0 flex-1"><div className="mx-auto max-w-6xl">
      <header className="mb-6"><p className="text-[11px] font-black uppercase tracking-[.2em] text-[#16587B]/55">Danh mục POS</p><h1 className="mt-1 text-2xl font-black">Món bán tại quầy</h1><p className="mt-1 text-sm font-semibold text-[#16587B]/65">Quản lý menu bán nhanh riêng, không cộng hoặc trừ số lượng tồn kho.</p></header>
      {editing?<section className="rounded-2xl border border-white/40 bg-[#F5EEDD] p-4 shadow-lg md:p-6">
        <div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-black">{draft.id?'Sửa món bán':'Thêm món bán POS'}</h2><p className="text-xs font-semibold text-[#16587B]/60">Món này sẽ xuất hiện trên màn hình bán hàng tại quầy.</p></div><button onClick={()=>{setEditing(false);setDraft(blank())}} className="flex h-10 w-10 items-center justify-center rounded-full border bg-white"><X/></button></div>
        <div className="grid gap-4 md:grid-cols-[260px_1fr]"><div><span className="mb-2 block text-xs font-black">Ảnh món bán</span><label className="flex aspect-[4/3] cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed bg-white">{draft.image_url?<img src={draft.image_url} alt="Xem trước" className="h-full w-full object-cover"/>:<span className="flex flex-col items-center gap-2 text-xs font-bold text-[#16587B]/55"><Camera/>Chọn ảnh</span>}<input type="file" accept="image/*" className="hidden" onChange={event=>pickImage(event.target.files?.[0])}/></label></div>
          <div className="grid gap-4 md:grid-cols-2"><label className="md:col-span-2"><span className="mb-2 block text-xs font-black">Tên món</span><input className={input} value={draft.name} onChange={event=>setDraft({...draft,name:event.target.value})} placeholder="Ví dụ: Cà phê sữa"/></label><label><span className="mb-2 block text-xs font-black">Nhóm món</span><input className={input} value={draft.category} onChange={event=>setDraft({...draft,category:event.target.value})} placeholder="Đồ uống, bánh..."/></label><label><span className="mb-2 block text-xs font-black">Mã / SKU</span><input className={input} value={draft.sku} onChange={event=>setDraft({...draft,sku:event.target.value})}/></label><label><span className="mb-2 block text-xs font-black">Giá bán</span><input inputMode="numeric" className={input} value={draft.selling_price} onChange={event=>setDraft({...draft,selling_price:event.target.value})}/></label><label><span className="mb-2 block text-xs font-black">Cost ước tính</span><input inputMode="numeric" className={input} value={draft.unit_cost} onChange={event=>setDraft({...draft,unit_cost:event.target.value})}/></label><label className="md:col-span-2"><span className="mb-2 block text-xs font-black">Ghi chú</span><textarea className={`${input} min-h-24 py-3`} value={draft.notes} onChange={event=>setDraft({...draft,notes:event.target.value})}/></label></div></div>
        <button onClick={save} disabled={saving} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#84221D] px-5 text-sm font-black text-[#FAF5EB] disabled:opacity-50">{saving?<Loader2 className="animate-spin"/>:<Check/>} Lưu món bán</button>
      </section>:<>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-3.5 h-5 text-[#16587B]/50"/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Tìm tên món, SKU hoặc nhóm" className={`${input} pl-10`}/></div><button onClick={()=>{setDraft(blank());setEditing(true)}} className="flex h-12 items-center justify-center gap-2 rounded-full bg-[#84221D] px-5 text-sm font-black text-[#FAF5EB]"><Plus/> Thêm món POS</button></div>
        {loading?<div className="h-44 animate-pulse rounded-2xl bg-white/60"/>:shown.length?<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{shown.map(product=><article key={product.id} className="overflow-hidden rounded-2xl border border-white/50 bg-[#F5EEDD] shadow-md"><div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-white">{product.image_url?<img src={product.image_url} alt={product.name} className="h-full w-full object-cover"/>:<PackageOpen className="h-12 w-12 text-[#16587B]/30"/>}</div><div className="p-4"><p className="text-[10px] font-black uppercase tracking-wider text-[#16587B]/50">{product.category||'Món POS'}</p><h2 className="mt-1 truncate font-black">{product.name}</h2><b className="mt-2 block text-lg text-moss-money text-[#385E26]">{money(product.selling_price)}</b><div className="mt-4 grid grid-cols-2 gap-2"><button onClick={()=>edit(product)} className="flex h-10 items-center justify-center gap-2 rounded-full border bg-white text-xs font-black"><Pencil size={15}/> Sửa</button><button onClick={()=>remove(product)} className="flex h-10 items-center justify-center gap-2 rounded-full border border-red-200 bg-white text-xs font-black text-red-700"><Trash2 size={15}/> Xóa</button></div></div></article>)}</div>:<div className="flex min-h-52 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#16587B]/20 bg-white/50 p-6 text-center"><PackageOpen className="mb-3 h-10 w-10 text-[#16587B]/35"/><b>Chưa có món bán POS</b><p className="mt-1 text-sm font-semibold text-[#16587B]/55">Thêm menu đầu tiên để bắt đầu bán tại quầy.</p></div>}
      </>}
    </div></main>
    {message&&<div className="fixed left-1/2 top-20 z-[100] -translate-x-1/2 rounded-full bg-[#16587B] px-5 py-3 text-sm font-bold text-white shadow-xl">{message}</div>}
  </div>;
}
