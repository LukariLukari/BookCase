// Only retry reads. Transaction writes use their existing idempotent write queue.
export async function fetchFinanceData<T>(url: string, headers: Record<string, string>, signal?: AbortSignal): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), 12_000);
    const abort = () => timeout.abort();
    signal?.addEventListener('abort', abort, { once: true });
    try {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const response = await fetch(url, { headers, signal: timeout.signal, cache: 'no-store' });
      if (attempt === 0 && [502, 503, 504].includes(response.status)) {
        await response.body?.cancel();
        continue;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Không tải được dữ liệu chi tiêu.');
      return data as T;
    } catch (error) {
      if (signal?.aborted) throw error;
      if (attempt === 0 && (error instanceof TypeError || timeout.signal.aborted)) continue;
      if (timeout.signal.aborted) throw new Error('Kết nối đang chậm. Vui lòng thử lại.');
      throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }
}
