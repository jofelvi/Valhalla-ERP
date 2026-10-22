import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api/apiClient';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

type LogLevel = 'info' | 'warn' | 'error';

interface ClientLogPayload {
  level: LogLevel;
  source: string;
  message: string;
  context?: Record<string, unknown>;
  stack?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  clientTime?: string; // ISO capturado cuando ocurrió el evento
}

interface EnrichedLog extends ClientLogPayload {
  platform: string;
  appVersion: string;
  timestamp: string; // timestamp del servidor (para compat)
  clientTime: string; // ISO del cliente (cuando ocurrió realmente)
}

const APP_VERSION =
  (Constants.expoConfig?.version as string | undefined) ?? '1.0.0';

const QUEUE_KEY = 'pos:clientLogQueue';
const MAX_QUEUE_SIZE = 100; // evitamos crecer sin limite en clientes offline
const FLUSH_INTERVAL_MS = 30_000;
const BATCH_SIZE = 25;

let flushTimer: ReturnType<typeof setInterval> | null = null;
let isFlushing = false;

function enrich(payload: ClientLogPayload): EnrichedLog {
  return {
    ...payload,
    platform: Platform.OS,
    appVersion: APP_VERSION,
    timestamp: new Date().toISOString(),
    // clientTime: capturado CUANDO ocurrio, no cuando se envia (para medir
    // cortes reales, no queue-distortion). Por defecto: ahora.
    clientTime: payload.clientTime ?? new Date().toISOString(),
  };
}

async function readQueue(): Promise<EnrichedLog[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: EnrichedLog[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    // sin AsyncStorage no podemos persistir — se pierden en crash
  }
}

async function enqueue(log: EnrichedLog): Promise<void> {
  const queue = await readQueue();
  queue.push(log);
  // Si excedemos el limite, descartamos los mas viejos (FIFO)
  if (queue.length > MAX_QUEUE_SIZE) {
    queue.splice(0, queue.length - MAX_QUEUE_SIZE);
  }
  await writeQueue(queue);
}

/**
 * Flush de la queue al backend. Envia en batches de BATCH_SIZE. Si el backend
 * responde OK, limpia esos items de la queue. Si falla, los deja para el
 * siguiente intento.
 */
export async function flushClientLogQueue(): Promise<void> {
  if (isFlushing) return;
  isFlushing = true;
  try {
    let queue = await readQueue();
    while (queue.length > 0) {
      const batch = queue.slice(0, BATCH_SIZE);
      try {
        await api.post(
          '/api/client-logs/batch',
          { items: batch },
          { timeoutMs: 8_000 },
        );
      } catch {
        // Network down o backend caido: salimos, reintentamos despues.
        break;
      }
      // Remover el batch que se envio OK
      queue = queue.slice(batch.length);
      await writeQueue(queue);
    }
  } finally {
    isFlushing = false;
  }
}

/**
 * Envia un log al backend. Primero intenta envio directo (fire-and-forget);
 * si falla o demora, lo encola en AsyncStorage para reintento posterior.
 * Nunca lanza error ni bloquea.
 */
export async function logClientEvent(payload: ClientLogPayload): Promise<void> {
  const enriched = enrich(payload);

  // Log local a consola en dev
  const logFn =
    payload.level === 'error'
      ? console.error
      : payload.level === 'warn'
        ? console.warn
        : console.log;
  logFn(
    `[client-log] ${payload.source}: ${payload.message}`,
    payload.context ?? '',
  );

  // Para info, best-effort sin persistir queue (no es critico).
  // Para warn/error, si el envio directo falla lo encolamos.
  try {
    await api.post('/api/client-logs', enriched, { timeoutMs: 5_000 });
    return;
  } catch {
    if (payload.level === 'info') return;
    await enqueue(enriched).catch(() => undefined);
  }
}

/**
 * Inicia el flush periodico de la queue. Se llama una vez desde App.tsx.
 * Hace un flush inicial al arranque y luego cada FLUSH_INTERVAL_MS.
 */
export function startClientLogFlusher(): void {
  if (flushTimer) return;
  // Flush inicial (fire-and-forget) para limpiar lo que quedo de sesiones previas.
  void flushClientLogQueue();
  flushTimer = setInterval(() => {
    void flushClientLogQueue();
  }, FLUSH_INTERVAL_MS);
}

export function stopClientLogFlusher(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}
