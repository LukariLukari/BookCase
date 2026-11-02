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

// Binary search the insertion point; copy once and preserve references to unchanged rows.
export function mergeTransaction<T extends SavedTransaction>(items: T[], saved: T): T[] {
  const remaining = items.filter(item => item.id !== saved.id);
  let low = 0, high = remaining.length;
  while (low < high) {
    const middle = (low + high) >>> 1, item = remaining[middle];
    if (item.date > saved.date || (item.date === saved.date && item.createdAt >= saved.createdAt)) low = middle + 1;
    else high = middle;
  }
  remaining.splice(low, 0, saved);
  return remaining;
}

export function overlayTransactions<T extends SavedTransaction>(items: T[], pending: T[]): T[] {
  if (!pending.length) return items;
  // A snapshot can already contain an in-flight write. The UUID is the identity.
  const known = new Set(items.map(item => item.id));
  let result = items;
  for (const item of pending) if (!known.has(item.id)) {
    result = mergeTransaction(result, item);
    known.add(item.id);
  }
  return result;
}
