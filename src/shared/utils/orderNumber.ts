/**
 * Generador de numero de orden legible para humanos.
 *
 * Formato: `<LETRA><###>-<DD>-<MM>-<YYYY>`
 *
 *   A001-08-04-2026  (orden #1 del 8 de abril)
 *   A100-08-04-2026  (orden #100)
 *   B001-08-04-2026  (orden #101)
 *   Z100-08-04-2026  (orden #2600)
 *   AA001-08-04-2026 (orden #2601 — overflow con doble letra)
 *
 * Race-safe: usa MongoDB atomic findOneAndUpdate via NestJS API.
 */

import { api } from '@/services/api/apiClient';
import { Order } from '@odin6/types';

/**
 * Convierte un correlativo (1, 2, ..., 2600, 2601, ...) en su prefijo legible.
 */
export function correlativoToPrefix(count: number): string {
  if (count < 1) throw new Error('count debe ser >= 1');

  // Single letter: A-Z (1-2600)
  if (count <= 2600) {
    const letterIdx = Math.floor((count - 1) / 100); // 0-25
    const num = ((count - 1) % 100) + 1; // 1-100
    const letter = String.fromCharCode(65 + letterIdx);
    return `${letter}${String(num).padStart(3, '0')}`;
  }

  // Double letter: AA-ZZ (2601-67200)
  const eff = count - 2600;
  const blockIdx = Math.floor((eff - 1) / 100);
  const num = ((eff - 1) % 100) + 1;
  const l1 = Math.floor(blockIdx / 26);
  const l2 = blockIdx % 26;
  if (l1 >= 26) {
    return `Z${count.toString(16).toUpperCase().padStart(3, '0')}`;
  }
  const letters = String.fromCharCode(65 + l1) + String.fromCharCode(65 + l2);
  return `${letters}${String(num).padStart(3, '0')}`;
}

/**
 * Genera el siguiente numero de orden de manera atomica via NestJS API.
 */
export async function generateOrderNumber(): Promise<string> {
  const result = await api.post<{ orderNumber: string }>(
    '/api/orders/generate-order-number',
  );
  return result.orderNumber;
}

/**
 * Devuelve el numero de orden legible. Si la orden no tiene `orderNumber`
 * (ordenes viejas pre-feature), devuelve los ultimos 8 chars del ID en
 * mayuscula como fallback.
 */
export function getDisplayOrderNumber(
  order:
    | Pick<Order, 'id' | 'orderNumber'>
    | { id: string; orderNumber?: string | null },
): string {
  if (order.orderNumber) return order.orderNumber;
  return order.id.slice(-8).toUpperCase();
}
