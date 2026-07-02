import { SERVER_CACHE_API_URL } from '@/lib/server-env';

export async function cacheFetch<T = any>(path: string, params?: Record<string, string>): Promise<T | null> {
  try {
    const url = new URL(path, SERVER_CACHE_API_URL);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }
    const response = await fetch(url.toString());
    if (!response.ok) return null;
    return response.json() as Promise<T>;
  } catch {
    return null;
  }
}

export async function cacheInvalidate(keys: string[]): Promise<void> {
  try {
    await fetch(`${SERVER_CACHE_API_URL}/api/cache/invalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys }),
    });
  } catch {}
}
