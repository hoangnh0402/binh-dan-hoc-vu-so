import type { ApiErrorBody, TokenResponse } from './types';

/** Lỗi API theo định dạng SRS 08 §1.3. */
export class ApiError extends Error {
  status: number;
  code: string;
  fieldErrors: Record<string, string>;

  constructor(body: ApiErrorBody) {
    super(body.message);
    this.status = body.status;
    this.code = body.code;
    this.fieldErrors = Object.fromEntries((body.errors ?? []).map((e) => [e.field, e.message]));
  }
}

type Listener = (session: TokenResponse | null) => void;

let accessToken: string | null = null;
let refreshing: Promise<TokenResponse | null> | null = null;
const listeners = new Set<Listener>();

export function onSessionChange(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Cờ "đã từng đăng nhập" (không chứa bí mật) để khách không phải gọi /auth/refresh vô ích mỗi lần tải trang. */
const SESSION_FLAG = 'bdhvs.hasSession';

export function hasSessionHint() {
  try {
    return localStorage.getItem(SESSION_FLAG) === '1';
  } catch {
    return true;
  }
}

export function setSession(s: TokenResponse | null) {
  accessToken = s?.accessToken ?? null;
  try {
    if (s) localStorage.setItem(SESSION_FLAG, '1');
    else localStorage.removeItem(SESSION_FLAG);
  } catch {
    /* trình duyệt chặn lưu trữ */
  }
  listeners.forEach((l) => l(s));
}

/**
 * Làm mới phiên bằng cookie refresh_token (HttpOnly). Các lời gọi đồng thời dùng chung một promise,
 * vì backend xoay vòng refresh token và coi việc dùng lại token cũ là dấu hiệu bị đánh cắp.
 */
export function refreshSession(): Promise<TokenResponse | null> {
  if (!refreshing) {
    refreshing = fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'same-origin' })
      .then(async (r) => {
        const s = r.ok ? ((await r.json()) as TokenResponse) : null;
        setSession(s);
        return s;
      })
      .catch(() => {
        setSession(null);
        return null;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

interface Options {
  method?: string;
  body?: unknown;
  form?: FormData;
  auth?: boolean;
}

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const doFetch = () => {
    const headers: Record<string, string> = {};
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    return fetch(`/api/v1${path}`, {
      method: opts.method ?? 'GET',
      headers,
      credentials: 'same-origin',
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    });
  };
  let res = await doFetch();
  if (res.status === 401 && accessToken !== null && !path.startsWith('/auth/')) {
    const s = await refreshSession();
    if (s) res = await doFetch();
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    throw new ApiError(
      data && data.code ? data : { status: res.status, code: 'HTTP_' + res.status, message: 'Đã có lỗi xảy ra, vui lòng thử lại' },
    );
  }
  return data as T;
}

/** Tải tệp (CSV) kèm token. */
export async function download(path: string, filename: string) {
  const res = await fetch(`/api/v1${path}`, { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} });
  if (!res.ok) throw new ApiError({ status: res.status, code: 'DOWNLOAD_FAILED', message: 'Không tải được tệp' });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function qs(params: Record<string, string | number | boolean | undefined | null | (string | number)[]>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    if (Array.isArray(v)) {
      if (v.length) sp.set(k, v.join(','));
    } else sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
}
