export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') || '';

type FetchJsonOptions = RequestInit & {
  timeoutMs?: number;
};

export async function fetchJson<T>(path: string, options: FetchJsonOptions = {}): Promise<T> {
  const { timeoutMs = 8000, signal, ...fetchOptions } = options;
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
