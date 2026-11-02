import FinanceClient from '../FinanceClient';

export const metadata = { title: 'Thống kê thu chi · Billy' };

export default function FinanceStatisticsPage() {
  return <FinanceClient view="statistics" />;
}
