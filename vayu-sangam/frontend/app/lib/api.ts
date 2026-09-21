export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') || '';

type FetchJsonOptions = RequestInit & {
  timeoutMs?: number;
};

const GET_CACHE_TTL_MS = 30_000;
const getCache = new Map<string, { expiresAt: number; value: Promise<unknown> }>();

export async function fetchJson<T>(path: string, options: FetchJsonOptions = {}): Promise<T> {
  const { timeoutMs = 5000, signal, ...fetchOptions } = options;
  const method = (fetchOptions.method || 'GET').toUpperCase();
  const cacheKey = method === 'GET' ? `${method}:${path}` : '';
  if (cacheKey) {
    const cached = getCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as Promise<T>;
    }
    getCache.delete(cacheKey);
  }

  const request = fetchJsonUncached<T>(path, timeoutMs, signal, fetchOptions);
  if (cacheKey) {
    getCache.set(cacheKey, { expiresAt: Date.now() + GET_CACHE_TTL_MS, value: request });
    request.catch(() => getCache.delete(cacheKey));
  }
  return request;
}

async function fetchJsonUncached<T>(
  path: string,
  timeoutMs: number,
  signal: AbortSignal | null | undefined,
  fetchOptions: RequestInit,
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      cache: 'no-store',
      ...fetchOptions,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    return response.json() as Promise<T>;
  } finally {
    window.clearTimeout(timeout);
  }
}
