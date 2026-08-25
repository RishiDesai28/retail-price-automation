export type ApiError = Error & {
  status?: number;
  detail?: string;
};

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL && String(import.meta.env.VITE_API_BASE_URL).trim()) ||
  (import.meta.env.VITE_API_URL && String(import.meta.env.VITE_API_URL).trim()) ||
  '';

function buildUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (!API_BASE_URL) {
    return normalizedPath;
  }

  const base = API_BASE_URL.replace(/\/+$/, '');
  return new URL(normalizedPath.replace(/^\/+/, ''), `${base}/`).toString();
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;

  try {
    response = await fetch(buildUrl(path), {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body && !(init.headers instanceof Headers) ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch (error) {
    const networkError = new Error('Failed to fetch') as ApiError;
    networkError.detail = 'Failed to fetch';
    throw networkError;
  }

  const text = await response.text();
  let payload: unknown = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;

    if (payload && typeof payload === 'object') {
      const record = payload as Record<string, unknown>;
      if (typeof record.detail === 'string') {
        detail = record.detail;
      } else if (Array.isArray(record.detail)) {
        detail = record.detail.map((entry) => String(entry)).join(', ');
      } else if (typeof record.message === 'string') {
        detail = record.message;
      }
    }

    const error = new Error(detail) as ApiError;
    error.status = response.status;
    error.detail = detail;
    throw error;
  }

  return payload as T;
}

export { API_BASE_URL };
