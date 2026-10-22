import { getSession, signIn } from 'next-auth/react';
import { WEB_VERSION } from '@/shared/utils/appVersion';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const DEFAULT_TIMEOUT_MS = 15_000;

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Header de trazabilidad: el backend identifica por X-Client-Type si la request
// viene de web (Next.js POS) o de apk (React Native). Permite correlacionar
// errores en logs con el origen real sin parsear user-agent.
// La version sale de `next.config.ts`, que la inyecta en build desde
// package.json. El fallback anterior era el literal '1.0.0' y
// NEXT_PUBLIC_APP_VERSION nunca se declaro en el VPS, asi que el backend
// guardaba '1.0.0' en `users.lastAppVersion` para TODA la web: la
// telemetria del APK servia y la de la web no, sin que nada fallara.
const APP_VERSION = WEB_VERSION;

// Circuit breaker para 401: cuando la sesion expira, todas las queries de
// React Query empiezan a fallar y se reintentan en loop. El loop puede
// llegar a 100+ req/s desde un solo navegador y tumbar el backend (paso real
// en evento del 25 abril 2026). Si recibimos 401, abrimos el circuito por
// 30s — durante ese rango ninguna request toca al backend, fallan local
// con 401 inmediato. Al mismo tiempo redirigimos al login una sola vez.
let unauthorizedSince = 0;
const UNAUTH_CIRCUIT_MS = 30_000;
let signInTriggered = false;

function isAuthCircuitOpen(): boolean {
  return (
    unauthorizedSince > 0 && Date.now() - unauthorizedSince < UNAUTH_CIRCUIT_MS
  );
}

function tripAuthCircuit(): void {
  unauthorizedSince = Date.now();
  if (typeof window !== 'undefined' && !signInTriggered) {
    signInTriggered = true;
    // Disparar relogin sin bloquear el throw que sigue
    void signIn(undefined, { callbackUrl: window.location.pathname });
  }
}

/**
 * Cache del token de sesion, en memoria.
 *
 * `getSession()` de next-auth NO cachea nada: cada llamada es un
 * `GET /api/auth/session` completo. Y como `getAuthHeaders()` corre en CADA
 * peticion, la web hacia dos viajes por cada dato que pedia. Medido con
 * Playwright en modo usuario: hasta 37 `/api/auth/session` en una sola carga
 * de pantalla. Encima cada uno dispara el callback `jwt` del servidor, que
 * decodifica el JWT y puede salir a `/api/auth/refresh`.
 *
 * Duele el doble cuando el local corre sobre los datos del telefono del
 * dueno durante un corte de internet: es el doble de consumo y el doble de
 * espera por cada toque de pantalla.
 *
 * Se guarda el token unos minutos (tope corto para que un cambio de rol o un
 * cierre de sesion en otra pestana no se quede pegado), nunca pasado su
 * vencimiento real, y se tira a la basura en cuanto llega un 401. La
 * renovacion del backend sigue ocurriendo igual: al vencer el cache se vuelve
 * a preguntar y el callback `jwt` renueva si hace falta.
 */
const TOPE_CACHE_SESION_MS = 5 * 60_000;
const MARGEN_ANTES_DE_VENCER_MS = 30_000;

let tokenCacheado: string | undefined;
let tokenValidoHasta = 0;
let sesionEnVuelo: Promise<string | undefined> | null = null;

function vencimientoDelJwt(token: string): number | null {
  try {
    const carga = token.split('.')[1];
    if (!carga) return null;
    const json = JSON.parse(
      atob(carga.replace(/-/g, '+').replace(/_/g, '/')),
    ) as { exp?: number };
    return typeof json.exp === 'number' ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

function olvidarSesion(): void {
  tokenCacheado = undefined;
  tokenValidoHasta = 0;
}

/**
 * El token del backend para la sesion actual, servido del cache cuando se
 * puede. Varias peticiones simultaneas comparten una sola consulta.
 */
export async function tokenDeSesion(): Promise<string | undefined> {
  if (tokenCacheado && Date.now() < tokenValidoHasta) return tokenCacheado;

  sesionEnVuelo ??= (async () => {
    try {
      const session = await getSession();
      const token = (session as { accessToken?: string } | null)?.accessToken;
      if (!token) {
        olvidarSesion();
        return undefined;
      }
      const vence = vencimientoDelJwt(token);
      const tope = Date.now() + TOPE_CACHE_SESION_MS;
      tokenCacheado = token;
      tokenValidoHasta =
        vence === null
          ? tope
          : Math.min(tope, vence - MARGEN_ANTES_DE_VENCER_MS);
      return token;
    } finally {
      sesionEnVuelo = null;
    }
  })();

  return sesionEnVuelo;
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-Client-Type': 'web',
    'X-App-Version': APP_VERSION,
  };

  const accessToken = await tokenDeSesion();
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  return headers;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  // Cortocircuito: si el circuito de auth esta abierto, no tocar al backend.
  if (isAuthCircuitOpen()) {
    throw new ApiError(401, 'Sesion expirada, recarga la pagina');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(408, `Request timeout after ${timeoutMs}ms: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function checkResponse(res: Response): void {
  if (res.status === 401) {
    // El token cacheado ya no sirve: si no se tira, los reintentos lo
    // seguirian mandando hasta que venza el cache.
    olvidarSesion();
    tripAuthCircuit();
  }
}

export const api = {
  async get<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
  ): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) url.searchParams.set(k, String(v));
      });
    }
    const res = await fetchWithTimeout(url.toString(), {
      headers: await getAuthHeaders(),
    });
    if (!res.ok) {
      checkResponse(res);
      throw new ApiError(res.status, await res.text());
    }
    // Leer siempre como texto primero para manejar body vacio aun con
    // content-type JSON. NestJS devuelve 200 sin body cuando el handler
    // retorna null (ej. checkReferenceUsed), y res.json() tira SyntaxError
    // sobre strings vacios. El contrato del endpoint puede mapear null -> null.
    const text = await res.text();
    if (!text) return null as T;
    const ct = res.headers.get('content-type') ?? '';
    if (ct.includes('application/json')) return JSON.parse(text) as T;
    return text as unknown as T;
  },

  async post<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetchWithTimeout(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      checkResponse(res);
      throw new ApiError(res.status, await res.text());
    }
    return res.json();
  },

  async patch<T>(path: string, body: unknown): Promise<T> {
    const res = await fetchWithTimeout(`${BASE_URL}${path}`, {
      method: 'PATCH',
      headers: await getAuthHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      checkResponse(res);
      throw new ApiError(res.status, await res.text());
    }
    return res.json();
  },

  // `body` opcional: algunas bajas exigen justificarse (quitar un descuento
  // pide motivo + PIN admin). DELETE con cuerpo es valido y Nest lo lee.
  async del<T>(path: string, body?: unknown): Promise<T | null> {
    const res = await fetchWithTimeout(`${BASE_URL}${path}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      checkResponse(res);
      throw new ApiError(res.status, await res.text());
    }
    // 204 No Content no tiene body — res.json() tiraría SyntaxError
    if (res.status === 204 || res.headers.get('content-length') === '0') {
      return null;
    }
    return res.json();
  },
};

export { ApiError };
