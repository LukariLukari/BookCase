'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import axios from 'axios';
import {
  ArrowLeft,
  BadgeDollarSign,
  Boxes,
  Camera,
  ChevronRight,
  CircleDollarSign,
  ExternalLink,
  Loader2,
  PackagePlus,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  WalletCards,
  X,
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/app/contexts/AuthContext';

type BusinessView = 'dashboard' | 'products' | 'transactions';

type Product = {
  id: string;
  name: string;
  sku?: string | null;
  category?: string | null;
  image_url?: string | null;
  selling_price: number;
  unit_cost: number;
  stock_quantity: number;
  social_link?: string | null;
  supplier_info?: string | null;
  customer_info?: string | null;
  notes?: string | null;
  is_active: boolean;
  total_income: number;
  total_expense: number;
  total_profit: number;
  sold_quantity: number;
};

type Transaction = {
  id: string;
  product_id?: string | null;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  quantity: number;
  capital_cost: number;
  shipping_fee: number;
  other_fee: number;
  customer_name?: string | null;
  customer_contact?: string | null;
  social_link?: string | null;
  note?: string | null;
  transaction_date?: string | null;
  product_name?: string | null;
  product_image_url?: string | null;
  net_profit: number;
};

type Summary = {
  total_income: number;
  total_expense: number;
  total_capital: number;
  total_shipping: number;
  total_other_fee: number;
  gross_profit: number;
  net_profit: number;
  active_products: number;
  stock_units: number;
  sold_units: number;
  recent_transactions: Transaction[];
  top_products: Product[];
};

type ProductForm = {
  name: string;
  sku: string;
  category: string;
  image_url: string;
  selling_price: string;
  unit_cost: string;
  stock_quantity: string;
  social_link: string;
  supplier_info: string;
  customer_info: string;
  notes: string;
};

type TransactionForm = {
  product_id: string;
  type: 'income' | 'expense';
  category: string;
  amount: string;
  quantity: string;
  capital_cost: string;
  shipping_fee: string;
  other_fee: string;
  customer_name: string;
  customer_contact: string;
  social_link: string;
  note: string;
  transaction_date: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const emptyProductForm: ProductForm = {
  name: '',
  sku: '',
  category: '',
  image_url: '',
  selling_price: '',
  unit_cost: '',
  stock_quantity: '',
  social_link: '',
  supplier_info: '',
  customer_info: '',
  notes: '',
};

const emptyTransactionForm: TransactionForm = {
  product_id: '',
  type: 'income',
  category: 'Bán hàng',
  amount: '',
  quantity: '1',
  capital_cost: '',
  shipping_fee: '',
  other_fee: '',
  customer_name: '',
  customer_contact: '',
  social_link: '',
  note: '',
  transaction_date: new Date().toISOString().slice(0, 10),
};

function money(value: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value || 0);
}

function asNumber(value: string) {
  const parsed = Number(String(value || '0').replace(/[^\d-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateLabel(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('vi-VN') : '-';
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wide text-[#7A6F68]">{label}</span>
      {children}
    </label>
  );
}

function inputClass(extra = '') {
  return `h-12 w-full rounded-2xl border border-[#E5DACD] bg-white px-3 text-[16px] text-[#1C1917] outline-none transition focus:border-[#1B2A4A] ${extra}`;
}

function areaClass(extra = '') {
  return `min-h-24 w-full rounded-2xl border border-[#E5DACD] bg-white px-3 py-3 text-[16px] text-[#1C1917] outline-none transition focus:border-[#1B2A4A] ${extra}`;
}

function MobileBack({ title }: { title: string }) {
  return (
    <div className="mb-4 flex items-center gap-3 md:hidden">
      <Link href="/business" className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#E5DACD] bg-[#FAF6F0] text-[#1C1917]">
        <ArrowLeft size={18} />
      </Link>
      <h1 className="text-lg font-black text-[#1C1917]">{title}</h1>
    </div>
  );
}

function TransactionRow({ item, onDelete }: { item: Transaction; onDelete: (id: string) => void }) {
  const costs = (item.capital_cost || 0) + (item.shipping_fee || 0) + (item.other_fee || 0);

  return (
    <article className="rounded-3xl border border-[#ECE2D5] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${item.type === 'income' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
              {item.type === 'income' ? 'Thu' : 'Chi'}
            </span>
            <span className="text-xs font-bold text-[#7A6F68]">{dateLabel(item.transaction_date)}</span>
          </div>
          <h3 className="mt-2 line-clamp-1 text-sm font-black text-[#1C1917]">{item.product_name || item.category}</h3>
          <p className="mt-0.5 line-clamp-1 text-xs font-medium text-[#7A6F68]">
            {item.customer_name || item.customer_contact || item.note || item.category}
          </p>
        </div>
        <button onClick={() => onDelete(item.id)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#F2D2D2] bg-[#FFF8F8] text-rose-600">
          <Trash2 size={15} />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-2xl bg-[#FAF6F0] p-2">
          <p className="font-bold text-[#7A6F68]">Tiền</p>
          <p className="mt-0.5 font-black text-[#1C1917]">{money(item.amount)}</p>
        </div>
        <div className="rounded-2xl bg-[#FAF6F0] p-2">
          <p className="font-bold text-[#7A6F68]">Phí</p>
          <p className="mt-0.5 font-black text-[#1C1917]">{money(costs)}</p>
        </div>
        <div className="rounded-2xl bg-[#FAF6F0] p-2">
          <p className="font-bold text-[#7A6F68]">Lãi</p>
          <p className={`mt-0.5 font-black ${item.net_profit >= 0 ? 'text-[#1B2A4A]' : 'text-rose-700'}`}>{money(item.net_profit)}</p>
        </div>
      </div>
    </article>
  );
}

export default function BusinessClient({ view = 'dashboard' }: { view?: BusinessView }) {
  const { user, token: authToken, isLoading: authLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingProduct, setSavingProduct] = useState(false);
  const [savingTransaction, setSavingTransaction] = useState(false);
  const [productForm, setProductForm] = useState<ProductForm>(emptyProductForm);
  const [transactionForm, setTransactionForm] = useState<TransactionForm>(emptyTransactionForm);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');

  const token = authToken || (typeof window !== 'undefined' ? localStorage.getItem('token') || localStorage.getItem('access_token') : null);
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const loadBusinessData = async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      const [summaryRes, productsRes, transactionsRes] = await Promise.all([
        axios.get<Summary>(`${API_URL}/api/business/summary`, { headers }),
        axios.get<Product[]>(`${API_URL}/api/business/products`, { headers }),
        axios.get<Transaction[]>(`${API_URL}/api/business/transactions`, { headers }),
      ]);
      setSummary(summaryRes.data);
      setProducts(productsRes.data);
      setTransactions(transactionsRes.data);
    } catch (err: any) {
      console.error(err);
      if (err.response?.status === 401) logout();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    } else if (user) {
      loadBusinessData();
    }
  }, [user, authLoading, pathname, router]);

  const filteredTransactions = transactions.filter((item) => {
    const matchesType = filter === 'all' || item.type === filter;
    const q = search.toLowerCase().trim();
    const matchesSearch = !q || [item.product_name, item.category, item.customer_name, item.customer_contact, item.note]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q));
    return matchesType && matchesSearch;
  });

  const selectedProduct = products.find((product) => product.id === transactionForm.product_id);
  const expectedProfit = transactionForm.type === 'income'
    ? asNumber(transactionForm.amount) - asNumber(transactionForm.capital_cost) - asNumber(transactionForm.shipping_fee) - asNumber(transactionForm.other_fee)
    : -asNumber(transactionForm.amount);

  const fillProductForEdit = (product: Product) => {
    setEditingProductId(product.id);
    setProductForm({
      name: product.name || '',
      sku: product.sku || '',
      category: product.category || '',
      image_url: product.image_url || '',
      selling_price: String(product.selling_price || ''),
      unit_cost: String(product.unit_cost || ''),
      stock_quantity: String(product.stock_quantity || ''),
      social_link: product.social_link || '',
      supplier_info: product.supplier_info || '',
      customer_info: product.customer_info || '',
      notes: product.notes || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetProductForm = () => {
    setEditingProductId(null);
    setProductForm(emptyProductForm);
  };

  const handleImageFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setProductForm((prev) => ({ ...prev, image_url: String(reader.result || '') }));
    reader.readAsDataURL(file);
  };

  const saveProduct = async () => {
    if (!productForm.name.trim()) {
      alert('Nhập tên sản phẩm trước đã.');
      return;
    }
    setSavingProduct(true);
    try {
      const payload = {
        ...productForm,
        selling_price: asNumber(productForm.selling_price),
        unit_cost: asNumber(productForm.unit_cost),
        stock_quantity: asNumber(productForm.stock_quantity),
        is_active: true,
      };
      if (editingProductId) {
        await axios.put(`${API_URL}/api/business/products/${editingProductId}`, payload, { headers });
      } else {
        await axios.post(`${API_URL}/api/business/products`, payload, { headers });
      }
      resetProductForm();
      await loadBusinessData();
    } catch (err) {
      console.error(err);
      alert('Không lưu được sản phẩm.');
    } finally {
      setSavingProduct(false);
    }
  };

  const saveTransaction = async () => {
    if (!transactionForm.category.trim() || !transactionForm.amount.trim()) {
      alert('Nhập loại khoản và số tiền trước đã.');
      return;
    }
    setSavingTransaction(true);
    try {
      const payload = {
        ...transactionForm,
        product_id: transactionForm.product_id || null,
        amount: asNumber(transactionForm.amount),
        quantity: asNumber(transactionForm.quantity) || 1,
        capital_cost: asNumber(transactionForm.capital_cost),
        shipping_fee: asNumber(transactionForm.shipping_fee),
        other_fee: asNumber(transactionForm.other_fee),
        transaction_date: transactionForm.transaction_date ? new Date(transactionForm.transaction_date).toISOString() : null,
      };
      await axios.post(`${API_URL}/api/business/transactions`, payload, { headers });
      setTransactionForm(emptyTransactionForm);
      await loadBusinessData();
    } catch (err) {
      console.error(err);
      alert('Không lưu được giao dịch.');
    } finally {
      setSavingTransaction(false);
    }
  };

  const deleteProduct = async (productId: string) => {
    if (!confirm('Xóa sản phẩm này và các giao dịch gắn với nó?')) return;
    await axios.delete(`${API_URL}/api/business/products/${productId}`, { headers });
    await loadBusinessData();
  };

  const deleteTransaction = async (transactionId: string) => {
    if (!confirm('Xóa khoản thu/chi này?')) return;
    await axios.delete(`${API_URL}/api/business/transactions/${transactionId}`, { headers });
    await loadBusinessData();
  };

  if (authLoading || !user) {
    return <div className="min-h-screen bg-[#D8C9BB] flex items-center justify-center font-bold text-[#7A6F68]">Đang tải...</div>;
  }

  const totalCost = (summary?.total_expense || 0) + (summary?.total_capital || 0) + (summary?.total_shipping || 0) + (summary?.total_other_fee || 0);
  const stats = [
    { label: 'Doanh thu', value: money(summary?.total_income || 0), icon: <TrendingUp size={18} />, tone: 'text-emerald-700' },
    { label: 'Chi phí', value: money(totalCost), icon: <TrendingDown size={18} />, tone: 'text-rose-700' },
    { label: 'Lãi ròng', value: money(summary?.net_profit || 0), icon: <BadgeDollarSign size={18} />, tone: (summary?.net_profit || 0) >= 0 ? 'text-[#1B2A4A]' : 'text-rose-700' },
    { label: 'Tồn kho', value: `${summary?.stock_units || 0}`, icon: <Boxes size={18} />, tone: 'text-[#57534E]' },
  ];

  const shell = (content: React.ReactNode) => (
    <div className="min-h-screen bg-[#D8C9BB] text-[#2A2320] p-3 pt-20 sm:p-5 md:p-6 lg:p-7 md:pt-6 flex flex-col md:flex-row gap-5 font-sans selection:bg-[#E5DACD]">
      <Sidebar />
      <main className="flex-1 min-w-0">
        {content}
      </main>
    </div>
  );

  if (isLoading) {
    return shell(
      <div className="min-h-[70vh] rounded-[32px] border border-[#EFE8DE] bg-[#FBF8F4] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#1B2A4A]" size={34} />
      </div>
    );
  }

  if (view === 'products') {
    return shell(
      <div className="mx-auto max-w-5xl space-y-5">
        <MobileBack title="Sản phẩm" />
        <section className="rounded-[28px] border border-[#EFE8DE] bg-[#FBF8F4] p-4 md:p-6">
          <div className="mb-5 hidden items-center justify-between md:flex">
            <div>
              <h1 className="text-2xl font-black text-[#1C1917]">Sản phẩm</h1>
              <p className="mt-1 text-sm font-medium text-[#7A6F68]">{products.length} sản phẩm trong shop</p>
            </div>
            <Link href="/business" className="rounded-full border border-[#E5DACD] bg-[#FAF6F0] px-4 py-2 text-sm font-bold text-[#57534E]">Tổng quan</Link>
          </div>

          <div className="rounded-3xl border border-[#ECE2D5] bg-[#FAF6F0] p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-black text-[#1C1917]"><PackagePlus size={18} /> {editingProductId ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}</h2>
              {editingProductId && (
                <button onClick={resetProductForm} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#ECE2D5] bg-white text-[#57534E]">
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-[148px_1fr]">
              <div className="relative aspect-square overflow-hidden rounded-3xl border border-[#E5DACD] bg-white">
                {productForm.image_url ? (
                  <img src={productForm.image_url} alt="Ảnh sản phẩm" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[#AFA190]"><Camera size={30} /></div>
                )}
                <label className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1B2A4A] text-white shadow-md">
                  <Camera size={17} />
                  <input type="file" accept="image/*" className="hidden" onChange={(event) => handleImageFile(event.target.files?.[0])} />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Tên sản phẩm">
                  <input value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} className={inputClass('font-bold md:col-span-2')} />
                </Field>
                <Field label="Mã / SKU">
                  <input value={productForm.sku} onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })} className={inputClass()} />
                </Field>
                <Field label="Nhóm hàng">
                  <input value={productForm.category} onChange={(e) => setProductForm({ ...productForm, category: e.target.value })} className={inputClass()} />
                </Field>
                <Field label="Giá bán">
                  <input value={productForm.selling_price} onChange={(e) => setProductForm({ ...productForm, selling_price: e.target.value })} inputMode="numeric" className={inputClass()} />
                </Field>
                <Field label="Vốn / món">
                  <input value={productForm.unit_cost} onChange={(e) => setProductForm({ ...productForm, unit_cost: e.target.value })} inputMode="numeric" className={inputClass()} />
                </Field>
                <Field label="Tồn kho">
                  <input value={productForm.stock_quantity} onChange={(e) => setProductForm({ ...productForm, stock_quantity: e.target.value })} inputMode="numeric" className={inputClass()} />
                </Field>
                <Field label="Link social">
                  <input value={productForm.social_link} onChange={(e) => setProductForm({ ...productForm, social_link: e.target.value })} className={inputClass()} />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Thông tin khách / nguồn hàng">
                    <textarea value={productForm.customer_info} onChange={(e) => setProductForm({ ...productForm, customer_info: e.target.value })} className={areaClass()} />
                  </Field>
                </div>
                <div className="md:col-span-2">
                  <Field label="Ghi chú">
                    <textarea value={productForm.notes} onChange={(e) => setProductForm({ ...productForm, notes: e.target.value })} className={areaClass()} />
                  </Field>
                </div>
              </div>
            </div>

            <button onClick={saveProduct} disabled={savingProduct} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1B2A4A] px-5 text-sm font-black text-white shadow-md disabled:opacity-60">
              {savingProduct ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />} {editingProductId ? 'Lưu thay đổi' : 'Thêm sản phẩm'}
            </button>
          </div>
        </section>

        <section className="space-y-3">
          {products.map((product) => (
            <article key={product.id} className="rounded-[28px] border border-[#ECE2D5] bg-[#FBF8F4] p-4">
              <div className="flex gap-3">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-[#ECE2D5] bg-[#FAF6F0]">
                  {product.image_url ? <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-[#AFA190]"><Boxes size={24} /></div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="line-clamp-2 text-sm font-black text-[#1C1917]">{product.name}</h3>
                      <p className="mt-0.5 text-xs font-bold text-[#7A6F68]">{product.category || 'Chưa phân nhóm'} · tồn {product.stock_quantity}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => fillProductForEdit(product)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#ECE2D5] bg-[#FAF6F0] text-[#57534E]"><Pencil size={14} /></button>
                      <button onClick={() => deleteProduct(product.id)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#F2D2D2] bg-[#FFF8F8] text-rose-600"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-2xl bg-[#FAF6F0] p-2"><p className="font-bold text-[#7A6F68]">Giá</p><p className="font-black text-[#1C1917]">{money(product.selling_price)}</p></div>
                    <div className="rounded-2xl bg-[#FAF6F0] p-2"><p className="font-bold text-[#7A6F68]">Vốn</p><p className="font-black text-[#1C1917]">{money(product.unit_cost)}</p></div>
                    <div className="rounded-2xl bg-[#FAF6F0] p-2"><p className="font-bold text-[#7A6F68]">Lãi</p><p className={`font-black ${product.total_profit >= 0 ? 'text-[#1B2A4A]' : 'text-rose-700'}`}>{money(product.total_profit)}</p></div>
                  </div>
                  {product.social_link && (
                    <a href={product.social_link} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#1B2A4A]">
                      <ExternalLink size={13} /> Link social
                    </a>
                  )}
                </div>
              </div>
            </article>
          ))}
          {products.length === 0 && (
            <div className="rounded-[28px] border border-[#ECE2D5] bg-[#FBF8F4] p-8 text-center text-sm font-bold text-[#7A6F68]">Chưa có sản phẩm nào.</div>
          )}
        </section>
      </div>
    );
  }

  if (view === 'transactions') {
    return shell(
      <div className="mx-auto max-w-5xl space-y-5">
        <MobileBack title="Thu chi" />
        <section className="rounded-[28px] border border-[#EFE8DE] bg-[#FBF8F4] p-4 md:p-6">
          <div className="mb-5 hidden items-center justify-between md:flex">
            <div>
              <h1 className="text-2xl font-black text-[#1C1917]">Thu chi</h1>
              <p className="mt-1 text-sm font-medium text-[#7A6F68]">{transactions.length} giao dịch đã lưu</p>
            </div>
            <Link href="/business" className="rounded-full border border-[#E5DACD] bg-[#FAF6F0] px-4 py-2 text-sm font-bold text-[#57534E]">Tổng quan</Link>
          </div>

          <div className="rounded-3xl border border-[#ECE2D5] bg-[#FAF6F0] p-4">
            <h2 className="mb-4 flex items-center gap-2 text-base font-black text-[#1C1917]"><ReceiptText size={18} /> Ghi giao dịch</h2>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[#E5DACD] bg-white p-1">
                <button onClick={() => setTransactionForm({ ...transactionForm, type: 'income', category: 'Bán hàng' })} className={`h-11 rounded-xl text-sm font-black ${transactionForm.type === 'income' ? 'bg-[#1B2A4A] text-white' : 'text-[#57534E]'}`}>Thu tiền</button>
                <button onClick={() => setTransactionForm({ ...transactionForm, type: 'expense', category: 'Chi phí' })} className={`h-11 rounded-xl text-sm font-black ${transactionForm.type === 'expense' ? 'bg-[#1B2A4A] text-white' : 'text-[#57534E]'}`}>Chi tiền</button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Ngày">
                  <input type="date" value={transactionForm.transaction_date} onChange={(e) => setTransactionForm({ ...transactionForm, transaction_date: e.target.value })} className={inputClass()} />
                </Field>
                <Field label="Sản phẩm">
                  <select value={transactionForm.product_id} onChange={(e) => {
                    const product = products.find((item) => item.id === e.target.value);
                    setTransactionForm({
                      ...transactionForm,
                      product_id: e.target.value,
                      amount: transactionForm.amount || (product?.selling_price ? String(product.selling_price) : ''),
                      capital_cost: transactionForm.capital_cost || (product?.unit_cost ? String(product.unit_cost) : ''),
                    });
                  }} className={inputClass()}>
                    <option value="">Không gắn sản phẩm</option>
                    {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                  </select>
                </Field>
                <Field label="Loại khoản">
                  <input value={transactionForm.category} onChange={(e) => setTransactionForm({ ...transactionForm, category: e.target.value })} className={inputClass()} />
                </Field>
                <Field label="Số tiền">
                  <input value={transactionForm.amount} onChange={(e) => setTransactionForm({ ...transactionForm, amount: e.target.value })} inputMode="numeric" className={inputClass('font-bold')} />
                </Field>
                <Field label="Số lượng">
                  <input value={transactionForm.quantity} onChange={(e) => setTransactionForm({ ...transactionForm, quantity: e.target.value })} inputMode="numeric" className={inputClass()} />
                </Field>
                <Field label="Vốn">
                  <input value={transactionForm.capital_cost} onChange={(e) => setTransactionForm({ ...transactionForm, capital_cost: e.target.value })} inputMode="numeric" className={inputClass()} />
                </Field>
                <Field label="Ship">
                  <input value={transactionForm.shipping_fee} onChange={(e) => setTransactionForm({ ...transactionForm, shipping_fee: e.target.value })} inputMode="numeric" className={inputClass()} />
                </Field>
                <Field label="Chi phí khác">
                  <input value={transactionForm.other_fee} onChange={(e) => setTransactionForm({ ...transactionForm, other_fee: e.target.value })} inputMode="numeric" className={inputClass()} />
                </Field>
                <Field label="Tên khách">
                  <input value={transactionForm.customer_name} onChange={(e) => setTransactionForm({ ...transactionForm, customer_name: e.target.value })} className={inputClass()} />
                </Field>
                <Field label="Liên hệ khách">
                  <input value={transactionForm.customer_contact} onChange={(e) => setTransactionForm({ ...transactionForm, customer_contact: e.target.value })} className={inputClass()} />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Link / ghi chú">
                    <textarea value={transactionForm.note} onChange={(e) => setTransactionForm({ ...transactionForm, note: e.target.value })} className={areaClass()} />
                  </Field>
                </div>
              </div>

              <div className="rounded-3xl border border-[#ECE2D5] bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-wide text-[#7A6F68]">Dự tính lãi</p>
                    <p className={`mt-1 text-xl font-black ${expectedProfit >= 0 ? 'text-[#1B2A4A]' : 'text-rose-700'}`}>{money(expectedProfit)}</p>
                  </div>
                  <button onClick={saveTransaction} disabled={savingTransaction} className="flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-[#1B2A4A] px-5 text-sm font-black text-white shadow-md disabled:opacity-60">
                    {savingTransaction ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />} Lưu
                  </button>
                </div>
                {selectedProduct && <p className="mt-2 text-xs font-medium text-[#7A6F68]">{selectedProduct.name} · giá {money(selectedProduct.selling_price)} · vốn {money(selectedProduct.unit_cost)}</p>}
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="rounded-[28px] border border-[#EFE8DE] bg-[#FBF8F4] p-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7A6F68]" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} className={inputClass('pl-10')} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl border border-[#E5DACD] bg-[#FAF6F0] p-1">
              {(['all', 'income', 'expense'] as const).map((item) => (
                <button key={item} onClick={() => setFilter(item)} className={`h-10 rounded-xl text-xs font-black ${filter === item ? 'bg-[#1B2A4A] text-white' : 'text-[#57534E]'}`}>
                  {item === 'all' ? 'Tất cả' : item === 'income' ? 'Thu' : 'Chi'}
                </button>
              ))}
            </div>
          </div>

          {filteredTransactions.map((item) => <TransactionRow key={item.id} item={item} onDelete={deleteTransaction} />)}
          {filteredTransactions.length === 0 && (
            <div className="rounded-[28px] border border-[#ECE2D5] bg-[#FBF8F4] p-8 text-center text-sm font-bold text-[#7A6F68]">Chưa có giao dịch nào.</div>
          )}
        </section>
      </div>
    );
  }

  return shell(
    <div className="mx-auto max-w-5xl space-y-5">
      <section className="rounded-[30px] border border-[#EFE8DE] bg-[#FBF8F4] p-5 md:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[#7A6F68]">
              <WalletCards size={15} /> Shop Ledger
            </div>
            <h1 className="text-2xl font-black tracking-tight text-[#1C1917] md:text-3xl">Thu chi shop</h1>
          </div>
          <div className="hidden rounded-2xl border border-[#E5DACD] bg-[#FAF6F0] px-3 py-2 text-xs font-black text-[#57534E] md:block">
            {summary?.sold_units || 0} đã bán
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-3xl border border-[#ECE2D5] bg-[#FAF6F0] p-4">
              <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-2xl border border-[#ECE2D5] bg-white ${stat.tone}`}>{stat.icon}</div>
              <p className="text-[11px] font-black uppercase tracking-wide text-[#7A6F68]">{stat.label}</p>
              <p className="mt-1 break-words text-base font-black text-[#1C1917]">{stat.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <Link href="/business/products" className="group rounded-[28px] border border-[#ECE2D5] bg-[#FBF8F4] p-4 transition hover:-translate-y-0.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1B2A4A] text-white"><PackagePlus size={20} /></div>
            <ChevronRight className="text-[#AFA190] group-hover:text-[#1B2A4A]" size={20} />
          </div>
          <h2 className="mt-4 text-base font-black text-[#1C1917]">Sản phẩm</h2>
          <p className="mt-1 text-sm font-bold text-[#7A6F68]">{products.length} sản phẩm · tồn {summary?.stock_units || 0}</p>
        </Link>

        <Link href="/business/transactions" className="group rounded-[28px] border border-[#ECE2D5] bg-[#FBF8F4] p-4 transition hover:-translate-y-0.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1B2A4A] text-white"><ReceiptText size={20} /></div>
            <ChevronRight className="text-[#AFA190] group-hover:text-[#1B2A4A]" size={20} />
          </div>
          <h2 className="mt-4 text-base font-black text-[#1C1917]">Thu chi</h2>
          <p className="mt-1 text-sm font-bold text-[#7A6F68]">{transactions.length} giao dịch đã ghi</p>
        </Link>

        <div className="rounded-[28px] border border-[#ECE2D5] bg-[#1B2A4A] p-4 text-white">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/12"><CircleDollarSign size={21} /></div>
          <h2 className="mt-4 text-base font-black">Dòng tiền</h2>
          <p className="mt-1 text-sm font-bold text-white/75">Vốn {money(summary?.total_capital || 0)} · ship {money(summary?.total_shipping || 0)}</p>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-[28px] border border-[#EFE8DE] bg-[#FBF8F4] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-black text-[#1C1917]">Gần đây</h2>
            <Link href="/business/transactions" className="text-xs font-black text-[#1B2A4A]">Xem tất cả</Link>
          </div>
          <div className="space-y-3">
            {(summary?.recent_transactions || []).slice(0, 4).map((item) => <TransactionRow key={item.id} item={item} onDelete={deleteTransaction} />)}
            {(summary?.recent_transactions || []).length === 0 && <div className="rounded-3xl bg-[#FAF6F0] p-6 text-center text-sm font-bold text-[#7A6F68]">Chưa có giao dịch.</div>}
          </div>
        </div>

        <div className="rounded-[28px] border border-[#EFE8DE] bg-[#FBF8F4] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-black text-[#1C1917]">Sản phẩm nổi bật</h2>
            <Link href="/business/products" className="text-xs font-black text-[#1B2A4A]">Quản lý</Link>
          </div>
          <div className="space-y-3">
            {(summary?.top_products || []).slice(0, 5).map((product) => (
              <div key={product.id} className="flex items-center gap-3 rounded-3xl bg-[#FAF6F0] p-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-[#ECE2D5] bg-white">
                  {product.image_url ? <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-[#AFA190]"><Boxes size={20} /></div>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-black text-[#1C1917]">{product.name}</p>
                  <p className="text-xs font-bold text-[#7A6F68]">Đã bán {product.sold_quantity} · tồn {product.stock_quantity}</p>
                </div>
                <p className={`text-sm font-black ${product.total_profit >= 0 ? 'text-[#1B2A4A]' : 'text-rose-700'}`}>{money(product.total_profit)}</p>
              </div>
            ))}
            {(summary?.top_products || []).length === 0 && <div className="rounded-3xl bg-[#FAF6F0] p-6 text-center text-sm font-bold text-[#7A6F68]">Chưa có sản phẩm.</div>}
          </div>
        </div>
      </section>
    </div>
  );
}
