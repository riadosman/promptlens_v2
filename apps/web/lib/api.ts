const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly requestId?: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      code?: string;
      message?: string;
      requestId?: string;
      details?: unknown;
    } | null;
    throw new ApiError(
      payload?.message ?? `Request failed (${response.status}).`,
      response.status,
      payload?.code,
      payload?.requestId,
      payload?.details,
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function apiDownload(path: string): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(`${API_URL}${path}`, { credentials: 'include' });
  if (!response.ok) throw new Error(`Download failed (${response.status}).`);
  const disposition = response.headers.get('content-disposition') ?? '';
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'promptlens-export';
  return { blob: await response.blob(), filename };
}
