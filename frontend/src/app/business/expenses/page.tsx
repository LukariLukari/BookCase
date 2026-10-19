import FinanceClient from './FinanceClient';

export const metadata = { title: 'Quản lý chi tiêu · Billy' };

export default function ExpensesPage() {
  return <FinanceClient view="overview" />;
}
