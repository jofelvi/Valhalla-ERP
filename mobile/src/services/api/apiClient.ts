import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { API_URL } from '../../config/env';
import { APP_VERSION } from '../../config/appVersion';

const DEFAULT_TIMEOUT_MS = 15_000;
const TOKEN_KEY = 'pos:accessToken';

// Headers de trazabilidad: permiten al backend distinguir origen (apk vs web)
// y correlacionar errores con version de cliente en logs.
const CLIENT_PLATFORM = Platform.OS; // 'android' | 'ios'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Error de red (timeout, conexión rechazada, DNS fallo, etc.).
 * Distinto de ApiError (4xx/5xx) para poder manejar el offline correctamente.
 */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

type UnauthorizedHandler = () => void | Promise<void>;
let onUnauthorized: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  onUnauthorized = handler;
}

export async function setAccessToken(token: string | null): Promise<void> {
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

async function buildHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Client-Type': 'apk',
    'X-Client-Platform': CLIENT_PLATFORM,
    'X-App-Version': APP_VERSION,
  };
  const token = await getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new NetworkError(`Request timeout after ${timeoutMs}ms: ${url}`);
    }
    // Otros errores de fetch son errores de red (conexión rechazada, DNS, etc.)
    const msg = err instanceof Error ? err.message : String(err);
    throw new NetworkError(msg);
  } finally {
    clearTimeout(timer);
  }
}

// Evitar recursion infinita: el cliente loga via /api/client-logs, no loggear ese path
function shouldSkipLog(path: string): boolean {
  return path.includes('/api/client-logs');
}

// Anti-spiral: en evento del 25 abril 2026 una APK con timeouts en cascada
// envio 15+ logs/s al backend, amplificando la saturacion. Tres protecciones:
// 1. Throttle por (source+path+status) — no repetir el mismo error en <2s.
// 2. Circuit breaker — si el POST a /api/client-logs falla, suspender 60s.
// 3. Hard rate cap — maximo 5 logs/segundo independientemente de la fuente.
const LOG_THROTTLE_MS = 2_000;
const LOG_CIRCUIT_MS = 60_000;
const LOG_MAX_PER_SEC = 5;
const lastSentByKey = new Map<string, number>();
let circuitOpenUntil = 0;
let secondWindowStart = 0;
let secondWindowCount = 0;

function shouldSendLog(key: string): boolean {
  const now = Date.now();
  if (now < circuitOpenUntil) return false;
  if (now - secondWindowStart >= 1000) {
    secondWindowStart = now;
    secondWindowCount = 0;
  }
  if (secondWindowCount >= LOG_MAX_PER_SEC) return false;
  const last = lastSentByKey.get(key) ?? 0;
  if (now - last < LOG_THROTTLE_MS) return false;
  lastSentByKey.set(key, now);
  secondWindowCount += 1;
  // Limpieza ocasional para no crecer sin limite
  if (lastSentByKey.size > 200) {
    const cutoff = now - 30_000;
    for (const [k, t] of lastSentByKey) {
      if (t < cutoff) lastSentByKey.delete(k);
    }
  }
  return true;
}

// Auto-log al backend (fire-and-forget). Usa fetch directo para evitar
// volver a entrar al apiClient.
async function sendAutoLog(
  level: 'info' | 'warn' | 'error',
  method: string,
  path: string,
  status: number | null,
  durationMs: number,
  errorMessage?: string,
): Promise<void> {
  const dedupKey = `${method}|${path}|${status ?? 'x'}`;
  if (!shouldSendLog(dedupKey)) return;
  try {
    const headers = await buildHeaders();
    const payload = {
      level,
      source: `apiClient.${method}`,
      message: errorMessage
        ? `${method} ${path} -> ${status ?? 'ERR'}: ${errorMessage}`
        : `${method} ${path} -> ${status} (${durationMs}ms)`,
      context: {
        method,
        path,
        status,
        durationMs,
      },
      platform: CLIENT_PLATFORM,
      appVersion: APP_VERSION,
      timestamp: new Date().toISOString(),
    };
    // 5s timeout, no esperar respuesta utilmente
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(`${API_URL}/api/client-logs`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      // Si el endpoint devuelve error (incluyendo 429 de rate-limit nginx),
      // abrir el circuito 60s para no insistir.
      if (!res.ok) {
        circuitOpenUntil = Date.now() + LOG_CIRCUIT_MS;
      }
    } catch {
      // Network error o timeout: abrir circuito
      circuitOpenUntil = Date.now() + LOG_CIRCUIT_MS;
    }
    clearTimeout(t);
  } catch {
    // ignorar - logging no debe romper nada
  }
}

/**
 * Wrapper que ejecuta una request y la registra en el backend.
 * - Errores HTTP (4xx/5xx) o exceptions → log nivel 'error'
 * - Writes (POST/PATCH/PUT/DELETE) exitosos → log nivel 'info'
 * - GET exitosos → no se loguean (saturarian)
 */
async function executeWithLog<T>(
  method: string,
  path: string,
  fn: () => Promise<Response>,
): Promise<T> {
  const start = Date.now();
  const skip = shouldSkipLog(path);
  try {
    const res = await fn();
    const dur = Date.now() - start;
    const isWrite = method !== 'GET';
    if (!skip && isWrite && res.ok) {
      void sendAutoLog('info', method, path, res.status, dur);
    }
    return await handleResponseInternal<T>(res, method, path, dur, skip);
  } catch (err) {
    const dur = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    // Solo log de ApiError (status HTTP real). NetworkError se trata diferente.
    const status = err instanceof ApiError ? err.status : null;
    if (!skip && status !== null) {
      void sendAutoLog('error', method, path, status, dur, msg);
    }
    throw err;
  }
}

async function handleResponseInternal<T>(
  res: Response,
  method: string,
  path: string,
  durationMs: number,
  skipLog: boolean,
): Promise<T> {
  if (res.status === 401 && onUnauthorized) {
    await onUnauthorized();
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (!skipLog) {
      void sendAutoLog(
        'error',
        method,
        path,
        res.status,
        durationMs,
        text.slice(0, 300) || `HTTP ${res.status}`,
      );
    }
    throw new ApiError(res.status, text || `HTTP ${res.status}`);
  }
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) return res.json();
  return undefined as T;
}

// Mantenido para retrocompat con codigo que aun no usa executeWithLog
async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 401 && onUnauthorized) {
    await onUnauthorized();
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ApiError(res.status, text || `HTTP ${res.status}`);
  }
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) return res.json();
  return undefined as T;
}

function buildUrl(
  path: string,
  params?: Record<string, string | undefined>,
): string {
  const base = `${API_URL}${path}`;
  if (!params) return base;
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(
      ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`,
    )
    .join('&');
  return qs ? `${base}?${qs}` : base;
}

export const api = {
  async get<T>(
    path: string,
    params?: Record<string, string | undefined>,
  ): Promise<T> {
    return executeWithLog<T>('GET', path, async () =>
      fetchWithTimeout(buildUrl(path, params), {
        method: 'GET',
        headers: await buildHeaders(),
      }),
    );
  },

  async post<T>(
    path: string,
    body?: unknown,
    opts?: { timeoutMs?: number },
  ): Promise<T> {
    return executeWithLog<T>('POST', path, async () =>
      fetchWithTimeout(
        `${API_URL}${path}`,
        {
          method: 'POST',
          headers: await buildHeaders(),
          body: body ? JSON.stringify(body) : undefined,
        },
        opts?.timeoutMs,
      ),
    );
  },

  async patch<T>(path: string, body: unknown): Promise<T> {
    return executeWithLog<T>('PATCH', path, async () =>
      fetchWithTimeout(`${API_URL}${path}`, {
        method: 'PATCH',
        headers: await buildHeaders(),
        body: JSON.stringify(body),
      }),
    );
  },

  async put<T>(path: string, body: unknown): Promise<T> {
    return executeWithLog<T>('PUT', path, async () =>
      fetchWithTimeout(`${API_URL}${path}`, {
        method: 'PUT',
        headers: await buildHeaders(),
        body: JSON.stringify(body),
      }),
    );
  },

  async del<T>(path: string): Promise<T> {
    return executeWithLog<T>('DELETE', path, async () =>
      fetchWithTimeout(`${API_URL}${path}`, {
        method: 'DELETE',
        headers: await buildHeaders(),
      }),
    );
  },
};
