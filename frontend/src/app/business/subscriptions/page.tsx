import type { Metadata } from 'next';
import SubscriptionsClient from './SubscriptionsClient';
import './subscriptions.css';

export const metadata: Metadata = { title: 'Lịch gia hạn · Billy' };

export default function SubscriptionsPage() {
  return <SubscriptionsClient />;
}
