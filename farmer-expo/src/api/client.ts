import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { API_BASE_URL } from '../config';
import { cache } from './cache';

const TOKEN_KEY = 'agripod.token';

let inMemoryToken: string | null = null;

export async function loadToken(): Promise<string | null> {
  if (inMemoryToken) return inMemoryToken;
  inMemoryToken = await AsyncStorage.getItem(TOKEN_KEY);
  return inMemoryToken;
}

export async function setToken(token: string | null): Promise<void> {
  inMemoryToken = token;
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  auth?: boolean;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, auth = true } = opts;

  let url = `${API_BASE_URL}${path}`;
  if (query) {
    const qs = Object.entries(query)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    if (qs) url += `?${qs}`;
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = await loadToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new ApiError(0, `Cannot reach the server. Is the backend running?\n(${API_BASE_URL})`);
  }

  const text = await res.text();
  const json = text ? safeParse(text) : null;

  if (!res.ok) {
    const err = json?.error ?? {};
    throw new ApiError(res.status, err.message ?? `Request failed (${res.status})`, err.code, err.details);
  }
  // Any successful write invalidates the read cache so lists refresh on next focus.
  if (method !== 'GET') cache.clear();
  return json as T;
}

/**
 * Multipart upload for the scan image.
 *
 * Uses expo-file-system's native uploader instead of fetch + FormData — RN's
 * fetch throws "Network request failed" on multipart file bodies often enough
 * that it never worked reliably here. The native uploader streams the file
 * straight from disk.
 */
async function upload<T>(
  path: string,
  file: { uri: string; name: string; type: string },
  fields: Record<string, string> = {},
): Promise<T> {
  const token = await loadToken();
  let result: FileSystem.FileSystemUploadResult;
  try {
    result = await FileSystem.uploadAsync(`${API_BASE_URL}${path}`, file.uri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'image',
      mimeType: file.type,
      parameters: fields,
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch (e) {
    throw new ApiError(0, `Cannot reach the server. Is the backend running?\n(${API_BASE_URL})`);
  }
  const json = result.body ? safeParse(result.body) : null;
  if (result.status < 200 || result.status >= 300) {
    const err = json?.error ?? {};
    throw new ApiError(result.status, err?.message ?? `Upload failed (${result.status})`, err?.code);
  }
  cache.clear();
  return json as T;
}

function safeParse(t: string): any {
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

export const api = { request, upload };
