import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { API_BASE_URL } from '../config';
import { cache } from './cache';
import { logEvent } from '../debug/eventlog';

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
  /** Override the default request timeout, in ms. */
  timeoutMs?: number;
}

/**
 * Generous, but never infinite. The free Render instance can take tens of
 * seconds to wake, so this must not be tight — but a request with no timeout at
 * all can hang forever, and anything awaiting it (the launch sequence, for one)
 * hangs with it.
 */
const DEFAULT_TIMEOUT_MS = 30_000;

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, auth = true, timeoutMs = DEFAULT_TIMEOUT_MS } = opts;

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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  const tag = `${method} ${path}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    const err = e as Error;
    const aborted =
      err?.name === 'AbortError' || /abort/i.test(err?.message ?? '') || controller.signal.aborted;
    logEvent('error', tag, aborted ? `timeout after ${timeoutMs}ms` : 'network unreachable');
    throw new ApiError(
      0,
      aborted
        ? `The server took too long to answer (${Math.round(timeoutMs / 1000)}s).\n(${API_BASE_URL})`
        : `Cannot reach the server. Is the backend running?\n(${API_BASE_URL})`,
    );
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  const json = text ? safeParse(text) : null;
  logEvent(res.ok ? 'net' : 'error', tag, `${res.status} · ${Date.now() - started}ms`);

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
  const started = Date.now();
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
    logEvent('error', `POST ${path}`, 'upload — network unreachable');
    throw new ApiError(0, `Cannot reach the server. Is the backend running?\n(${API_BASE_URL})`);
  }
  const json = result.body ? safeParse(result.body) : null;
  logEvent(
    result.status < 300 ? 'net' : 'error',
    `POST ${path}`,
    `${result.status} · ${Date.now() - started}ms (upload)`,
  );
  if (result.status < 200 || result.status >= 300) {
    const err = json?.error ?? {};
    throw new ApiError(result.status, err?.message ?? `Upload failed (${result.status})`, err?.code);
  }
  cache.clear();
  return json as T;
}

/**
 * Send a recorded voice note for transcription.
 *
 * Same native uploader as the scan image, under a different multipart field.
 * Kept separate from the scan submit so the farmer sees the transcript and can
 * fix it before anything is diagnosed.
 */
const AUDIO_MIME: Record<string, string> = {
  m4a: 'audio/m4a',
  mp4: 'audio/mp4',
  aac: 'audio/aac',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  webm: 'audio/webm',
  ogg: 'audio/ogg',
  opus: 'audio/opus',
  caf: 'audio/x-caf',
};

async function transcribe(
  uri: string,
  opts: { mimeType?: string; language?: string } = {},
): Promise<{ transcript: string; language: string | null }> {
  // Derive from the recording's own extension rather than assuming m4a — the
  // preset differs by platform. (The native uploader still labels the multipart
  // part application/octet-stream, so the server falls back to the filename.)
  const ext = uri.split('.').pop()?.toLowerCase() ?? '';
  const mimeType = opts.mimeType ?? AUDIO_MIME[ext] ?? 'audio/m4a';
  const token = await loadToken();
  let result: FileSystem.FileSystemUploadResult;
  try {
    result = await FileSystem.uploadAsync(`${API_BASE_URL}/api/scans/transcribe`, uri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'audio',
      mimeType,
      parameters: opts.language ? { language: opts.language } : {},
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch {
    logEvent('error', 'POST /api/scans/transcribe', 'network unreachable');
    throw new ApiError(0, 'Could not reach the server to transcribe your recording.');
  }
  const json = result.body ? safeParse(result.body) : null;
  logEvent(result.status < 300 ? 'net' : 'error', 'POST /api/scans/transcribe', `${result.status}`);
  if (result.status < 200 || result.status >= 300) {
    throw new ApiError(
      result.status,
      json?.error?.message ?? `Transcription failed (${result.status})`,
      json?.error?.code,
    );
  }
  return json as { transcript: string; language: string | null };
}

function safeParse(t: string): any {
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

/**
 * Nudge the backend awake at launch.
 *
 * The free Render instance sleeps after ~15 minutes idle and takes tens of
 * seconds to come back. Firing this while fonts load and the cached UI paints
 * means the wake-up overlaps with startup instead of following it. Cheap,
 * unauthenticated, and failure is irrelevant.
 */
export function warmUp(): void {
  fetch(`${API_BASE_URL}/health`).catch(() => {});
}

export const api = { request, upload, transcribe };
