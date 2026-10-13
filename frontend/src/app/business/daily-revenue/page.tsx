import DailyRevenueClient from '../daily/DailyRevenueClient';

export const metadata = {
  title: 'Thống kê Doanh Thu Ngày · Billy',
  description: 'Thống kê tổng số tiền doanh thu và biểu đồ món được gọi theo ngày.',
};

export default function DailyRevenueAliasPage() {
  return <DailyRevenueClient />;
}
