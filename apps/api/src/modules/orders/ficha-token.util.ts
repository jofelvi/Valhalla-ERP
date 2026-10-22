import { createHmac, timingSafeEqual, randomBytes } from 'crypto';

// Prefijo de version del token. Permite (a) distinguir una ficha de un
// barcode de producto en el escaner de barra y (b) migrar el formato despues
// sin romper fichas viejas.
export const FICHA_TOKEN_PREFIX = 'AR1';

// nonce corto aleatorio. Vive en order.fichaNonce; rotarlo revoca la ficha.
export function generateFichaNonce(): string {
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

export function signFichaToken(
  orderId: string,
  nonce: string,
  secret: string,
): string {
  const sig = computeSignature(orderId, nonce, secret);
  return `${FICHA_TOKEN_PREFIX}.${orderId}.${nonce}.${sig}`;
}

export interface FichaTokenParts {
  orderId: string;
  nonce: string;
}

// Devuelve null si el token no valida. NO consulta la base de datos: solo
// recomputa el HMAC. Comparacion en tiempo constante.
export function verifyFichaToken(
  token: string,
  secret: string,
): FichaTokenParts | null {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [prefix, orderId, nonce, sig] = parts;
  if (prefix !== FICHA_TOKEN_PREFIX) return null;
  if (!orderId || !nonce || !sig) return null;

  const expected = computeSignature(orderId, nonce, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;

  return { orderId, nonce };
}
