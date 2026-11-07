'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/app/contexts/AuthContext';
import PieChart from '@/components/PieChart';

type Customer = { id: string; name: string; order_count?: number; total_spent?: number };
const money = (value: number) => `${value.toLocaleString('vi-VN')} đ`;

export default function CustomerStatistics() {
  const { token } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    let active = true;
    axios.get<Customer[]>('/api/sales/customers', { headers: { Authorization: `Bearer ${token}` } })
      .then(response => { if (active) { setCustomers(response.data); setError(''); } })
      .catch(() => { if (active) setError('Không tải được thống kê khách hàng. Vui lòng tải lại trang.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  return <section className="content-panel card-push mt-8 p-5" aria-labelledby="customer-statistics-title">
    <h2 id="customer-statistics-title" className="section-heading font-black">Thống kê khách hàng</h2>
    <p className="mb-5 text-sm">Tổng hợp toàn bộ lịch sử mua hàng, không giới hạn theo sổ tháng.</p>
    {loading ? <div role="status" className="flex justify-center py-12"><Loader2 className="animate-spin" aria-hidden="true"/><span className="sr-only">Đang tải thống kê khách hàng</span></div>
      : error ? <p role="alert">{error}</p>
      : <div className="grid gap-8 xl:grid-cols-2">
        <PieChart title="Tỷ lệ khách hàng quay lại" data={[
          { label: 'Đã quay lại', value: customers.filter(customer => (customer.order_count || 0) > 1).length },
          { label: 'Mua lần đầu', value: customers.filter(customer => customer.order_count === 1).length },
          { label: 'Chưa mua hàng', value: customers.filter(customer => !(customer.order_count || 0)).length },
        ]} formatValue={value => `${value} khách`}/>
        <PieChart title="Giá trị mua hàng theo khách" data={customers.map(customer => ({ label: customer.name, value: customer.total_spent || 0 }))} formatValue={money}/>
      </div>}
  </section>;
}
