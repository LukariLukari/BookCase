'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import {
  BadgeDollarSign,
  Boxes,
  Camera,
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

export default function BusinessClient() {
  const { user, token: authToken, isLoading: authLoading, logout } = useAuth();
  const router = useRouter();
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
  }, [user, authLoading, router]);

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

  const stats = [
    { label: 'Doanh thu', value: money(summary?.total_income || 0), icon: <TrendingUp size={18} />, tone: 'text-emerald-700' },
    { label: 'Chi phí', value: money((summary?.total_expense || 0) + (summary?.total_capital || 0) + (summary?.total_shipping || 0) + (summary?.total_other_fee || 0)), icon: <TrendingDown size={18} />, tone: 'text-rose-700' },
    { label: 'Lợi nhuận ròng', value: money(summary?.net_profit || 0), icon: <BadgeDollarSign size={18} />, tone: (summary?.net_profit || 0) >= 0 ? 'text-[#1B2A4A]' : 'text-rose-700' },
    { label: 'Tồn kho', value: `${summary?.stock_units || 0} món`, icon: <Boxes size={18} />, tone: 'text-[#57534E]' },
  ];

  return (
    <div className="min-h-screen bg-[#D8C9BB] text-[#2A2320] p-3 sm:p-5 md:p-6 lg:p-7 flex flex-col md:flex-row gap-5 font-sans selection:bg-[#E5DACD]">
      <Sidebar />

      <main className="flex-1 min-w-0 bg-[#FBF8F4] rounded-[36px] p-5 md:p-8 shadow-[0_16px_40px_rgba(120,100,85,0.12)] border border-[#EFE8DE]">
        <header className="pb-5 mb-6 border-b border-[#EFE8DE] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[#57534E] text-xs font-black uppercase tracking-[0.16em] mb-1.5">
              <WalletCards size={15} /> Private Business Ledger
            </div>
            <h1 className="text-xl md:text-2xl font-black text-[#2A2320] tracking-tight">Quản lý thu chi shop</h1>
            <p className="text-xs text-[#7A6F68] font-medium mt-0.5">Sản phẩm, đơn hàng, vốn, ship, chi phí khác và thông tin khách hàng trong cùng một nơi</p>
          </div>
          <div className="flex items-center gap-2 bg-[#EFE8DE] border border-[#E5DACD] rounded-2xl px-3 py-2 text-xs font-bold text-[#57534E]">
            <CircleDollarSign size={16} />
            {summary?.sold_units || 0} sản phẩm đã bán
          </div>
        </header>

        {isLoading ? (
          <div className="h-[55vh] flex items-center justify-center">
            <Loader2 className="animate-spin text-[#1B2A4A]" size={34} />
          </div>
        ) : (
          <div className="space-y-6">
            <section className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              {stats.map((stat) => (
                <div key={stat.label} className="bg-[#FAF6F0] border border-[#ECE2D5] rounded-3xl p-4">
                  <div className={`w-9 h-9 rounded-2xl bg-white border border-[#ECE2D5] flex items-center justify-center mb-3 ${stat.tone}`}>{stat.icon}</div>
                  <p className="text-[11px] text-[#7A6F68] font-bold uppercase tracking-wide">{stat.label}</p>
                  <p className="text-base md:text-lg font-black text-[#1C1917] mt-1 break-words">{stat.value}</p>
                </div>
              ))}
            </section>

            <section className="grid xl:grid-cols-[1fr_1.15fr] gap-5">
              <div className="bg-[#FAF6F0] border border-[#ECE2D5] rounded-[28px] p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-black text-[#1C1917] flex items-center gap-2"><PackagePlus size={18} /> {editingProductId ? 'Sửa sản phẩm' : 'Tạo sản phẩm'}</h2>
                  {editingProductId && (
                    <button onClick={resetProductForm} className="p-2 rounded-xl bg-white border border-[#ECE2D5] text-[#57534E] hover:text-[#1C1917] cursor-pointer">
                      <X size={16} />
                    </button>
                  )}
                </div>

                <div className="grid sm:grid-cols-[120px_1fr] gap-4">
                  <div className="aspect-square rounded-3xl bg-white border border-[#ECE2D5] overflow-hidden flex items-center justify-center relative">
                    {productForm.image_url ? (
                      <img src={productForm.image_url} alt="Ảnh sản phẩm" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="text-[#AFA190]" size={28} />
                    )}
                    <label className="absolute bottom-2 right-2 w-9 h-9 rounded-2xl bg-[#1B2A4A] text-white flex items-center justify-center cursor-pointer shadow-md">
                      <Camera size={15} />
                      <input type="file" accept="image/*" className="hidden" onChange={(event) => handleImageFile(event.target.files?.[0])} />
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <input value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} placeholder="Tên sản phẩm" className="col-span-2 rounded-2xl border border-[#E5DACD] bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-[#1B2A4A]" />
                    <input value={productForm.sku} onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })} placeholder="Mã/SKU" className="rounded-2xl border border-[#E5DACD] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1B2A4A]" />
                    <input value={productForm.category} onChange={(e) => setProductForm({ ...productForm, category: e.target.value })} placeholder="Nhóm hàng" className="rounded-2xl border border-[#E5DACD] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1B2A4A]" />
                    <input value={productForm.selling_price} onChange={(e) => setProductForm({ ...productForm, selling_price: e.target.value })} placeholder="Giá bán" inputMode="numeric" className="rounded-2xl border border-[#E5DACD] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1B2A4A]" />
                    <input value={productForm.unit_cost} onChange={(e) => setProductForm({ ...productForm, unit_cost: e.target.value })} placeholder="Vốn/món" inputMode="numeric" className="rounded-2xl border border-[#E5DACD] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1B2A4A]" />
                    <input value={productForm.stock_quantity} onChange={(e) => setProductForm({ ...productForm, stock_quantity: e.target.value })} placeholder="Tồn kho" inputMode="numeric" className="rounded-2xl border border-[#E5DACD] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1B2A4A]" />
                    <input value={productForm.social_link} onChange={(e) => setProductForm({ ...productForm, social_link: e.target.value })} placeholder="Link social/post" className="rounded-2xl border border-[#E5DACD] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1B2A4A]" />
                    <textarea value={productForm.customer_info} onChange={(e) => setProductForm({ ...productForm, customer_info: e.target.value })} placeholder="Tệp khách / thông tin khách hàng" className="col-span-2 min-h-20 rounded-2xl border border-[#E5DACD] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1B2A4A]" />
                    <textarea value={productForm.notes} onChange={(e) => setProductForm({ ...productForm, notes: e.target.value })} placeholder="Ghi chú sản phẩm, size, màu, nguồn hàng..." className="col-span-2 min-h-20 rounded-2xl border border-[#E5DACD] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1B2A4A]" />
                  </div>
                </div>

                <button onClick={saveProduct} disabled={savingProduct} className="mt-4 w-full btn-gradient rounded-full py-3 text-sm font-black flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60">
                  {savingProduct ? <Loader2 size={17} className="animate-spin" /> : <Plus size={17} />} {editingProductId ? 'Lưu thay đổi' : 'Thêm sản phẩm'}
                </button>
              </div>

              <div className="bg-[#FAF6F0] border border-[#ECE2D5] rounded-[28px] p-5">
                <h2 className="text-base font-black text-[#1C1917] flex items-center gap-2 mb-4"><ReceiptText size={18} /> Ghi thu chi</h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  <select value={transactionForm.type} onChange={(e) => setTransactionForm({ ...transactionForm, type: e.target.value as 'income' | 'expense', category: e.target.value === 'income' ? 'Bán hàng' : 'Chi phí' })} className="rounded-2xl border border-[#E5DACD] bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-[#1B2A4A]">
                    <option value="income">Thu tiền</option>
                    <option value="expense">Chi tiền</option>
                  </select>
                  <input type="date" value={transactionForm.transaction_date} onChange={(e) => setTransactionForm({ ...transactionForm, transaction_date: e.target.value })} className="rounded-2xl border border-[#E5DACD] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1B2A4A]" />
                  <select value={transactionForm.product_id} onChange={(e) => {
                    const product = products.find((item) => item.id === e.target.value);
                    setTransactionForm({
                      ...transactionForm,
                      product_id: e.target.value,
                      amount: transactionForm.amount || (product?.selling_price ? String(product.selling_price) : ''),
                      capital_cost: transactionForm.capital_cost || (product?.unit_cost ? String(product.unit_cost) : ''),
                    });
                  }} className="rounded-2xl border border-[#E5DACD] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1B2A4A]">
                    <option value="">Không gắn sản phẩm</option>
                    {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                  </select>
                  <input value={transactionForm.category} onChange={(e) => setTransactionForm({ ...transactionForm, category: e.target.value })} placeholder="Loại khoản" className="rounded-2xl border border-[#E5DACD] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1B2A4A]" />
                  <input value={transactionForm.amount} onChange={(e) => setTransactionForm({ ...transactionForm, amount: e.target.value })} placeholder="Số tiền thu/chi" inputMode="numeric" className="rounded-2xl border border-[#E5DACD] bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-[#1B2A4A]" />
                  <input value={transactionForm.quantity} onChange={(e) => setTransactionForm({ ...transactionForm, quantity: e.target.value })} placeholder="Số lượng" inputMode="numeric" className="rounded-2xl border border-[#E5DACD] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1B2A4A]" />
                  <input value={transactionForm.capital_cost} onChange={(e) => setTransactionForm({ ...transactionForm, capital_cost: e.target.value })} placeholder="Vốn bỏ ra" inputMode="numeric" className="rounded-2xl border border-[#E5DACD] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1B2A4A]" />
                  <input value={transactionForm.shipping_fee} onChange={(e) => setTransactionForm({ ...transactionForm, shipping_fee: e.target.value })} placeholder="Tiền ship" inputMode="numeric" className="rounded-2xl border border-[#E5DACD] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1B2A4A]" />
                  <input value={transactionForm.other_fee} onChange={(e) => setTransactionForm({ ...transactionForm, other_fee: e.target.value })} placeholder="Chi phí khác" inputMode="numeric" className="rounded-2xl border border-[#E5DACD] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1B2A4A]" />
                  <input value={transactionForm.customer_name} onChange={(e) => setTransactionForm({ ...transactionForm, customer_name: e.target.value })} placeholder="Tên khách" className="rounded-2xl border border-[#E5DACD] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1B2A4A]" />
                  <input value={transactionForm.customer_contact} onChange={(e) => setTransactionForm({ ...transactionForm, customer_contact: e.target.value })} placeholder="SĐT / IG / FB khách" className="rounded-2xl border border-[#E5DACD] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1B2A4A]" />
                  <input value={transactionForm.social_link} onChange={(e) => setTransactionForm({ ...transactionForm, social_link: e.target.value })} placeholder="Link tin nhắn / bài post" className="rounded-2xl border border-[#E5DACD] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1B2A4A]" />
                  <textarea value={transactionForm.note} onChange={(e) => setTransactionForm({ ...transactionForm, note: e.target.value })} placeholder="Ghi chú đơn hàng / chi phí" className="sm:col-span-2 min-h-20 rounded-2xl border border-[#E5DACD] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1B2A4A]" />
                </div>

                <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-[#ECE2D5] rounded-2xl px-4 py-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-[#7A6F68]">Dự tính lợi nhuận</p>
                    <p className={`text-lg font-black ${expectedProfit >= 0 ? 'text-[#1B2A4A]' : 'text-rose-700'}`}>{money(expectedProfit)}</p>
                  </div>
                  <button onClick={saveTransaction} disabled={savingTransaction} className="btn-gradient rounded-full px-5 py-3 text-sm font-black flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60">
                    {savingTransaction ? <Loader2 size={17} className="animate-spin" /> : <Plus size={17} />} Lưu giao dịch
                  </button>
                </div>
                {selectedProduct && <p className="text-[11px] text-[#7A6F68] font-medium mt-2">Đang gắn với {selectedProduct.name}, vốn gợi ý {money(selectedProduct.unit_cost)}, giá bán gợi ý {money(selectedProduct.selling_price)}.</p>}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="text-base font-black text-[#1C1917]">Sản phẩm</h2>
                <span className="text-xs font-bold text-[#7A6F68]">{products.length} sản phẩm</span>
              </div>
              <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {products.map((product) => (
                  <div key={product.id} className="bg-[#FAF6F0] border border-[#ECE2D5] rounded-3xl p-3">
                    <div className="aspect-[4/3] rounded-2xl bg-white border border-[#ECE2D5] overflow-hidden mb-3 flex items-center justify-center">
                      {product.image_url ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" /> : <Boxes className="text-[#AFA190]" size={28} />}
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-black text-sm text-[#1C1917] line-clamp-2">{product.name}</h3>
                        <p className="text-[11px] text-[#7A6F68] font-bold mt-0.5">{product.category || 'Chưa phân nhóm'} · tồn {product.stock_quantity}</p>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => fillProductForEdit(product)} className="p-2 rounded-xl bg-white border border-[#ECE2D5] text-[#57534E] hover:text-[#1C1917] cursor-pointer"><Pencil size={14} /></button>
                        <button onClick={() => deleteProduct(product.id)} className="p-2 rounded-xl bg-white border border-[#F2D2D2] text-rose-600 cursor-pointer"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                      <div className="bg-white border border-[#ECE2D5] rounded-2xl p-2">
                        <p className="text-[#7A6F68] font-bold">Giá bán</p>
                        <p className="font-black text-[#1C1917]">{money(product.selling_price)}</p>
                      </div>
                      <div className="bg-white border border-[#ECE2D5] rounded-2xl p-2">
                        <p className="text-[#7A6F68] font-bold">Lãi đã ghi</p>
                        <p className={`font-black ${product.total_profit >= 0 ? 'text-[#1B2A4A]' : 'text-rose-700'}`}>{money(product.total_profit)}</p>
                      </div>
                    </div>
                    {product.social_link && (
                      <a href={product.social_link} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#1B2A4A]">
                        <ExternalLink size={13} /> Link social
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-[#FAF6F0] border border-[#ECE2D5] rounded-[28px] p-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
                <h2 className="text-base font-black text-[#1C1917]">Lịch sử thu chi</h2>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7A6F68]" />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm khách, sản phẩm, ghi chú" className="w-full sm:w-72 rounded-2xl border border-[#E5DACD] bg-white pl-9 pr-3 py-2.5 text-sm outline-none focus:border-[#1B2A4A]" />
                  </div>
                  <div className="flex bg-white border border-[#E5DACD] rounded-2xl p-1">
                    {(['all', 'income', 'expense'] as const).map((item) => (
                      <button key={item} onClick={() => setFilter(item)} className={`px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer ${filter === item ? 'bg-[#1B2A4A] text-white' : 'text-[#57534E]'}`}>
                        {item === 'all' ? 'Tất cả' : item === 'income' ? 'Thu' : 'Chi'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] border-separate border-spacing-y-2 text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-[#7A6F68]">
                      <th className="px-3 py-2">Ngày</th>
                      <th className="px-3 py-2">Khoản</th>
                      <th className="px-3 py-2">Sản phẩm / Khách</th>
                      <th className="px-3 py-2 text-right">Thu/Chi</th>
                      <th className="px-3 py-2 text-right">Vốn + Ship + Khác</th>
                      <th className="px-3 py-2 text-right">Lãi ròng</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((item) => (
                      <tr key={item.id} className="bg-white border border-[#ECE2D5]">
                        <td className="px-3 py-3 rounded-l-2xl text-xs font-bold text-[#57534E]">{item.transaction_date ? new Date(item.transaction_date).toLocaleDateString('vi-VN') : '-'}</td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black ${item.type === 'income' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{item.type === 'income' ? 'Thu' : 'Chi'}</span>
                          <p className="text-xs font-bold text-[#1C1917] mt-1">{item.category}</p>
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-black text-[#1C1917]">{item.product_name || 'Khoản riêng'}</p>
                          <p className="text-xs text-[#7A6F68]">{item.customer_name || item.customer_contact || item.note || 'Không có ghi chú'}</p>
                        </td>
                        <td className="px-3 py-3 text-right font-black text-[#1C1917]">{money(item.amount)}</td>
                        <td className="px-3 py-3 text-right text-xs font-bold text-[#57534E]">{money((item.capital_cost || 0) + (item.shipping_fee || 0) + (item.other_fee || 0))}</td>
                        <td className={`px-3 py-3 text-right font-black ${item.net_profit >= 0 ? 'text-[#1B2A4A]' : 'text-rose-700'}`}>{money(item.net_profit)}</td>
                        <td className="px-3 py-3 rounded-r-2xl text-right">
                          <button onClick={() => deleteTransaction(item.id)} className="p-2 rounded-xl bg-[#FAF6F0] border border-[#F2D2D2] text-rose-600 cursor-pointer"><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredTransactions.length === 0 && (
                  <div className="py-10 text-center text-sm font-bold text-[#7A6F68]">Chưa có giao dịch nào khớp bộ lọc.</div>
                )}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
