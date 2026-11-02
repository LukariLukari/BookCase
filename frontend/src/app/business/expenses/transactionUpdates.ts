type SavedTransaction = {
  id: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  categoryId: string | null;
  date: string;
  createdAt: string;
  account: { id: string };
  destinationAccount: { id: string } | null;
};

export function accountDelta(id: string, saved: SavedTransaction, previous: SavedTransaction | null = null) {
  const effect = (item: SavedTransaction | null) => {
    if (!item) return { balance: 0, count: 0 };
    const source = item.account.id === id;
    const destination = item.type === 'transfer' && item.destinationAccount?.id === id;
    return {
      balance: (source ? (item.type === 'income' ? item.amount : -item.amount) : 0) + (destination ? item.amount : 0),
      count: Number(source) + Number(destination),
    };
  };
  const next = effect(saved), old = effect(previous);
  return { balance: next.balance - old.balance, count: next.count - old.count };
}

export function categoryDelta(id: string, saved: SavedTransaction, previous: SavedTransaction | null = null) {
  return Number(saved.categoryId === id) - Number(previous?.categoryId === id);
}

// Merge only the server-confirmed row; preserve the same ordering as the API.
export function mergeTransaction<T extends SavedTransaction>(items: T[], saved: T): T[] {
  const remaining = items.filter(item => item.id !== saved.id);
  const before = remaining.findIndex(item => item.date < saved.date || (item.date === saved.date && item.createdAt < saved.createdAt));
  remaining.splice(before < 0 ? remaining.length : before, 0, saved);
  return remaining;
}
