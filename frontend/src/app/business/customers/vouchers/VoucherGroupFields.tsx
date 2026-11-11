'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import StyledSelect from '@/components/StyledSelect';
import type { BuyXPayYRule } from '@/lib/vouchers';

type Product = { id: string; name: string; sellingPrice: number; trackStock: boolean; isActive: boolean };

export default function VoucherGroupFields({ rule, onChange, disabled, token }: {
  rule: BuyXPayYRule;
  onChange: (rule: BuyXPayYRule) => void;
  disabled: boolean;
  token: string | null;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState('');
  useEffect(() => {
    if (!token) return;
    let active = true;
    axios.get<Product[]>('/api/sales/vouchers/products', { headers: { Authorization: `Bearer ${token}` } })
      .then(response => { if (active) { setProducts(response.data); setError(''); } })
      .catch(() => { if (active) setError('Không tải được danh sách gói áp dụng.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, reload]);
  const shown = products.filter(product => (product.isActive || rule.eligibleProductIds.includes(product.id)) && product.name.toLocaleLowerCase('vi-VN').includes(query.trim().toLocaleLowerCase('vi-VN')));
  const missingIds = rule.eligibleProductIds.filter(id => !products.some(product => product.id === id));
  const toggle = (id: string) => onChange({ ...rule, eligibleProductIds: rule.eligibleProductIds.includes(id) ? rule.eligibleProductIds.filter(value => value !== id) : [...rule.eligibleProductIds, id] });
  return <fieldset disabled={disabled} className="min-w-0 space-y-4 md:col-span-3">
    <legend className="mb-3 text-sm font-bold">Ưu đãi theo nhóm người</legend>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block min-w-0"><span className="mb-2 block text-sm font-bold">Số người đi (X)</span><input required type="number" min="2" max="10000" step="1" value={rule.requiredQuantity || ''} onChange={event => onChange({ ...rule, requiredQuantity: Number(event.target.value) })} className="input-push h-12 w-full px-3"/></label>
      <label className="block min-w-0"><span className="mb-2 block text-sm font-bold">Số người tính tiền (Y)</span><input required type="number" min="1" max={Math.max(1, rule.requiredQuantity - 1)} step="1" value={rule.paidQuantity || ''} onChange={event => onChange({ ...rule, paidQuantity: Number(event.target.value) })} className="input-push h-12 w-full px-3"/></label>
      <label className="block min-w-0"><span className="mb-2 block text-sm font-bold">Cách gom nhóm</span><StyledSelect value={rule.grouping} disabled={disabled} onChange={event => onChange({ ...rule, grouping: event.target.value as BuyXPayYRule['grouping'] })} className="input-push min-h-12 w-full px-3"><option value="mixed">Gộp nhiều gói được chọn</option><option value="same_product">Đủ người trong cùng một gói</option></StyledSelect></label>
      <label className="block min-w-0"><span className="mb-2 block text-sm font-bold">Số suất miễn tối đa / đơn</span><input type="number" min="1" max="2147483647" step="1" value={rule.maxFreeQuantity ?? ''} placeholder="Không giới hạn" onChange={event => onChange({ ...rule, maxFreeQuantity: event.target.value === '' ? null : Number(event.target.value) })} className="input-push h-12 w-full px-3"/></label>
    </div>
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm"><input type="checkbox" checked={rule.repeatable} onChange={event => onChange({ ...rule, repeatable: event.target.checked })} className="h-5 w-5 shrink-0"/><span>Áp dụng lặp theo số nhóm đủ điều kiện</span></label>
    <p className="text-xs">{rule.repeatable ? 'Ví dụ đi 4 tính 3: 8 người được miễn 2 suất.' : 'Chỉ áp dụng một nhóm trong toàn bộ đơn. Nếu nhiều gói đủ điều kiện, ưu tiên nhóm có số tiền miễn thấp nhất.'} Luôn miễn suất có giá thấp nhất; phí ship và phí khác được tính riêng.</p>
    <fieldset className="min-w-0 space-y-3">
      <legend className="mb-2 text-sm font-bold">Gói / sản phẩm được áp dụng ({rule.eligibleProductIds.length} đã chọn)</legend>
      <input type="search" aria-label="Tìm gói áp dụng voucher" value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm tên gói, sản phẩm..." className="input-push h-11 w-full min-w-0 px-3"/>
      {loading ? <p role="status" className="text-sm">Đang tải danh sách gói...</p> : error ? <div role="alert"><p className="text-sm text-red-700">{error}</p><button type="button" onClick={() => { setLoading(true); setReload(value => value + 1); }} className="btn-push mt-2 px-3 py-2 text-xs">Thử lại</button></div> : <>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onChange({ ...rule, eligibleProductIds: [...new Set([...rule.eligibleProductIds, ...shown.filter(product => product.isActive).map(product => product.id)])] })} className="btn-push px-3 py-2 text-xs">Chọn tất cả đang hiển thị</button>
          <button type="button" onClick={() => onChange({ ...rule, eligibleProductIds: [] })} className="btn-push px-3 py-2 text-xs">Bỏ chọn tất cả</button>
        </div>
        <div className="max-h-64 space-y-2 overflow-y-auto p-1">
          {shown.map(product => <label key={product.id} className="flex min-h-12 cursor-pointer items-center gap-3 border-b p-2 text-sm"><input type="checkbox" checked={rule.eligibleProductIds.includes(product.id)} onChange={() => toggle(product.id)} className="h-5 w-5 shrink-0"/><span className="min-w-0 break-words"><b>{product.name}</b><span className="mt-1 block text-xs">{product.sellingPrice.toLocaleString('vi-VN')} đ · {product.trackStock ? 'Sản phẩm' : 'Dịch vụ'}{!product.isActive && ' · Đã ngừng bán'}</span></span></label>)}
          {!shown.length && <p className="text-sm">{query.trim() ? 'Không tìm thấy gói phù hợp.' : 'Chưa có gói. Hãy tạo gói trong danh sách sản phẩm / dịch vụ trước.'}</p>}
          {missingIds.map(id => <label key={id} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked onChange={() => toggle(id)} className="h-5 w-5 shrink-0"/><span>Gói không còn tồn tại — bỏ chọn để lưu lại voucher.</span></label>)}
        </div>
      </>}
    </fieldset>
    <p className="text-xs">Mỗi đơn vị số lượng của gói tương ứng một suất/người. Với workshop, nhập những người cùng buổi vào một đơn. Gói bán theo cặp hoặc theo bàn cần tách thành suất/người trước khi áp dụng.</p>
  </fieldset>;
}
