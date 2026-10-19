import FinanceClient from '../FinanceClient';

export const metadata = { title: 'Giao dịch chi tiêu · Billy' };

export default function ExpenseTransactionsPage() {
  return <FinanceClient view="transactions" />;
}
