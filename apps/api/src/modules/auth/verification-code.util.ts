import { createHash, randomInt } from 'node:crypto';

/**
 * Verificacion de email por codigo de 6 digitos.
 *
 * El codigo NUNCA se guarda en claro: se almacena su hash SHA-256 mas una fecha
 * de expiracion. Al verificar se rehashea la entrada y se compara. Es de un solo
 * uso: quien verifica limpia el hash.
 */

export const VERIFICATION_CODE_TTL_MS = 15 * 60 * 1000; // 15 minutos

/** Codigo numerico de 6 digitos, con ceros a la izquierda ("004521"). */
export function generateVerificationCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** Hash estable del codigo para guardarlo sin exponerlo. */
export function hashVerificationCode(code: string): string {
  return createHash('sha256').update(code.trim()).digest('hex');
}

/** Fecha de expiracion a partir de "ahora". */
export function verificationExpiry(now: Date): Date {
  return new Date(now.getTime() + VERIFICATION_CODE_TTL_MS);
}

/**
 * True si el codigo ingresado coincide con el hash guardado y aun no expira.
 * Devuelve false ante cualquier dato faltante en vez de lanzar.
 */
export function isVerificationCodeValid(
  input: string | null | undefined,
  storedHash: string | null | undefined,
  expiresAt: Date | null | undefined,
  now: Date,
): boolean {
  if (!input || !storedHash || !expiresAt) return false;
  if (now.getTime() > new Date(expiresAt).getTime()) return false;
  return hashVerificationCode(input) === storedHash;
}
