const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ||
  'https://agripod-backend.onrender.com';

const TOKEN_KEY = 'agripod.officer.token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string | null) =>
  t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  opts: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const { method = 'GET', body, auth = true } = opts;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const t = getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, `Cannot reach the backend (${API_BASE})`);
  }

  const text = await res.text();
  const json = text ? safeParse(text) : null;
  if (!res.ok) {
    if (res.status === 401) setToken(null);
    throw new ApiError(res.status, json?.error?.message ?? `Request failed (${res.status})`);
  }
  return json as T;
}

const safeParse = (t: string) => {
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
};

export const api = {
  base: API_BASE,
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown, auth = true) =>
    request<T>(path, { method: 'POST', body, auth }),
};
