import Link from 'next/link';
import { Ticket, Users } from 'lucide-react';

export default function CustomersNav({ view }: { view: 'customers' | 'vouchers' }) {
  return <nav aria-label="Khách hàng và voucher" className="customer-tabs">
    <Link href="/business/customers" aria-current={view === 'customers' ? 'page' : undefined}><Users size={18}/>Khách hàng</Link>
    <Link href="/business/customers/vouchers" aria-current={view === 'vouchers' ? 'page' : undefined}><Ticket size={18}/>Voucher</Link>
  </nav>;
}
