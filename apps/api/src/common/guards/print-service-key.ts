import { timingSafeEqual } from 'crypto';

/**
 * Clave compartida del print-service de la caja.
 *
 * La cola de impresion lleva el `qrData` de cada ficha de barra (el token que
 * permite entregar), y hasta ahora salia sin autenticar por dos puertas:
 * GET /api/print-queue/pending y el WebSocket /print, que se lo reparte a
 * quien se conecte. El print-service corre como SYSTEM y no tiene sesion, asi
 * que se identifica con una clave del .env.
 *
 * Se prende en tres tiempos, como AUTH_ENFORCE_*:
 *   - sin PRINT_SERVICE_KEY en la API     → todo pasa (comportamiento de hoy)
 *   - con la clave y sin ENFORCE          → pasa, pero se registra quien llega
 *                                           sin ella (auditoria)
 *   - PRINT_SERVICE_KEY_ENFORCE=true      → se rechaza
 */
export const PRINT_SERVICE_KEY_HEADER = 'x-print-service-key';

export interface PrintServiceKeyEnv {
  PRINT_SERVICE_KEY?: string;
  PRINT_SERVICE_KEY_ENFORCE?: string;
}

export type PrintServiceKeyDecision =
  | { action: 'allow' }
  | { action: 'audit' | 'deny'; reason: string };

const mismaClave = (recibida: string, esperada: string): boolean => {
  const a = Buffer.from(recibida);
  const b = Buffer.from(esperada);
  return a.length === b.length && timingSafeEqual(a, b);
};

export const decidePrintServiceKey = (
  recibida: unknown,
  env: PrintServiceKeyEnv,
): PrintServiceKeyDecision => {
  const esperada = (env.PRINT_SERVICE_KEY ?? '').trim();
  if (!esperada) return { action: 'allow' };

  const valor = typeof recibida === 'string' ? recibida.trim() : '';
  if (valor && mismaClave(valor, esperada)) return { action: 'allow' };

  const reason = valor
    ? 'clave del print-service invalida'
    : 'sin clave del print-service';
  const enforce =
    String(env.PRINT_SERVICE_KEY_ENFORCE ?? '').toLowerCase() === 'true';
  return { action: enforce ? 'deny' : 'audit', reason };
};
