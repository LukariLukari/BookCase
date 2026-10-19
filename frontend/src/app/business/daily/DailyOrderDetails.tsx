export type OrderSummary = {
  id: string;
  code: string;
  customerName: string;
  customerContact?: string | null;
  socialLink?: string | null;
  orderedAt: string;
  status: string;
  paymentStatus: string;
  note?: string | null;
  subtotal: number;
  capitalCost: number;
  shippingFee: number;
  shippingCost: number;
  discount: number;
  otherFee: number;
  total: number;
  profit: number;
  itemCount: number;
  items: { productName: string; quantity: number; unitPrice: number; unitCost: number }[];
};

const money = (value: number) => `${Math.round(value).toLocaleString('vi-VN')} đ`;
const statuses: Record<string, string> = {
  confirmed: 'Mới xác nhận', packing: 'Đang đóng gói', shipping: 'Đang giao',
  completed: 'Hoàn tất', delivered: 'Đã giao', cancelled: 'Đã hủy',
};
const payments: Record<string, string> = {
  paid: 'Đã thanh toán', unpaid: 'Chưa thanh toán', partial: 'Thanh toán một phần',
};

export default function DailyOrderDetails({ orders, items, soldUnits }: {
  orders: OrderSummary[];
  items: { productId: string; productName: string; quantity: number; revenue: number }[];
  soldUnits: number;
}) {
  if (!orders.length) return <p className="border-2 p-4 text-center">Chưa có đơn hàng trong ngày này.</p>;

  return (
    <div className="space-y-5">
      <section className="border-2 border-[#585556] bg-white p-3 sm:p-4" aria-label="Tổng hợp các món">
        <h3 className="font-bold">Tổng các món: {soldUnits} món</h3>
        <div className="mt-3 divide-y divide-[#585556]/20">
          {items.map((item) => (
            <div key={item.productId || item.productName} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="min-w-0 flex-1 break-words font-semibold">{item.productName}</span>
              <b>{item.quantity} món</b>
              <span>{money(item.revenue)}</span>
            </div>
          ))}
        </div>
      </section>

      <h3 className="font-bold">Chi tiết {orders.length} đơn hàng</h3>
      {orders.map((order) => (
        <article key={order.id} className="space-y-3 border-2 border-[#585556] bg-white p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-black break-all">{order.code}</h4>
            <time dateTime={order.orderedAt} className="text-sm">
              {new Date(order.orderedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
            </time>
          </div>
          <div className="space-y-1 break-words">
            <p>Khách hàng: <b>{order.customerName || 'Khách lẻ'}</b></p>
            {order.customerContact && <p>Liên hệ: {order.customerContact}</p>}
            {order.socialLink && <p>Mạng xã hội: {order.socialLink}</p>}
            <p>{statuses[order.status] || order.status} · {payments[order.paymentStatus] || order.paymentStatus}</p>
          </div>

          <ul className="divide-y divide-[#585556]/20 border-y border-[#585556]/30">
            {order.items.map((item, index) => (
              <li key={index} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <b className="min-w-0 break-words">{item.productName} × {item.quantity}</b>
                  <b className="shrink-0">{money(item.quantity * item.unitPrice)}</b>
                </div>
                <p className="mt-1 text-sm">Đơn giá: {money(item.unitPrice)} · Giá vốn: {money(item.unitCost)}</p>
              </li>
            ))}
          </ul>

          <dl className="space-y-2">
            {([
              ['Tiền món', order.subtotal], ['Phí giao hàng thu khách', order.shippingFee],
              ['Giảm giá', order.discount], ['Tổng thanh toán', order.total],
              ['Tổng giá vốn', order.capitalCost], ['Chi phí giao hàng', order.shippingCost],
              ['Chi phí khác', order.otherFee], ['Lợi nhuận', order.profit],
            ] as const).map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt>{label}</dt><dd className="shrink-0 font-bold">{money(value)}</dd>
              </div>
            ))}
          </dl>
          <p className="font-bold">Tổng: {order.itemCount} món</p>
          {order.note && <p className="whitespace-pre-wrap break-words border-t pt-3">Ghi chú: {order.note}</p>}
        </article>
      ))}
    </div>
  );
}
