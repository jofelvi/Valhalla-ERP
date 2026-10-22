import { createHmac, timingSafeEqual, randomBytes } from 'crypto';

// Token de VINCULO cliente↔orden. Mismo esquema HMAC que la ficha de barra
// pero con prefijo propio: asi el escaner del cliente distingue un QR de mesa
// (ARL1) de una ficha de barra (AR1) o de un barcode de producto.
export const LINK_TOKEN_PREFIX = 'ARL1';

// nonce corto aleatorio. Vive en order.linkNonce; rotarlo revoca el QR mostrado.
export function generateLinkNonce(): string {
  return randomBytes(4).toString('hex'); // 8 chars hex
}

function computeSignature(
  orderId: string,
  nonce: string,
  secret: string,
): string {
  return createHmac('sha256', secret)
    .update(`${orderId}.${nonce}`)
    .digest('base64url')
    .slice(0, 16);
}

export function signLinkToken(
  orderId: string,
  nonce: string,
  secret: string,
): string {
  const sig = computeSignature(orderId, nonce, secret);
  return `${LINK_TOKEN_PREFIX}.${orderId}.${nonce}.${sig}`;
}

export interface LinkTokenParts {
  orderId: string;
  nonce: string;
}

// Devuelve null si el token no valida. No consulta la base: solo recomputa el
// HMAC. Comparacion en tiempo constante.
export function verifyLinkToken(
  token: string,
  secret: string,
): LinkTokenParts | null {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [prefix, orderId, nonce, sig] = parts;
  if (prefix !== LINK_TOKEN_PREFIX) return null;
  if (!orderId || !nonce || !sig) return null;

  const expected = computeSignature(orderId, nonce, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;

  return { orderId, nonce };
}
