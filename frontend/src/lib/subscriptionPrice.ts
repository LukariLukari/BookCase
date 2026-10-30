// Keep the raw decimal string for the API; grouping is only for display.
export function formatSubscriptionPrice(value: string) {
  const [integer, fraction] = value.split('.');
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction === undefined ? '' : `.${fraction}`);
}

export function parseSubscriptionPrice(value: string): string | null {
  const raw = value.replace(/,/g, '');
  return /^(?:\d{1,12}(?:\.\d{0,2})?)?$/.test(raw) ? raw : null;
}
