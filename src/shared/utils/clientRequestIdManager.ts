/**
 * Manager para idempotencia de pagos y órdenes.
 *
 * Genera y persiste un clientRequestId por intento, de forma que sobreviva
 * a reintentos (doble clic, F5 a mitad de camino). El ID se reutiliza mientras
 * el flujo esté abierto, y se limpia al terminar (éxito o error definitivo).
 *
 * Usa sessionStorage para que persista solo dentro de la misma sesión de
 * navegador, no entre pestañas ni después de un cierre de sesión.
 */

import { generateAttemptId } from './printAudit';

const STORAGE_KEY_PREFIX = 'pos:clientRequestId:';

/**
 * Obtiene o genera un clientRequestId para un intento específico.
 *
 * @param context - Identificador del contexto (ej: 'payment:orderId', 'order:tableId')
 * @returns ID estable para reintentos del mismo intento
 */
export function getOrGenerateClientRequestId(context: string): string {
  const key = `${STORAGE_KEY_PREFIX}${context}`;

  try {
    const stored =
      typeof sessionStorage !== 'undefined' && sessionStorage.getItem(key);
    if (stored) return stored;
  } catch {
    // sessionStorage no disponible o private mode
  }

  const newId = generateAttemptId();
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(key, newId);
    }
  } catch {
    // sessionStorage no disponible: continuar sin persistencia
  }

  return newId;
}

/**
 * Limpia el clientRequestId de un contexto tras terminar el intento.
 *
 * @param context - Mismo identificador del contexto
 */
export function clearClientRequestId(context: string): void {
  const key = `${STORAGE_KEY_PREFIX}${context}`;
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(key);
    }
  } catch {
    // sessionStorage no disponible
  }
}
