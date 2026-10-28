import FinanceClient from '../FinanceClient';

export const metadata = { title: 'Khoản tiền · Billy' };

export default function FinanceAccountsPage() {
  return <FinanceClient view="accounts" />;
}
