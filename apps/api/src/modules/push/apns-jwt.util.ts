import { sign } from 'node:crypto';

/**
 * Provider JWT para APNs (token-based auth, ES256).
 *
 * Apple pide un JWT firmado con la APNs Auth Key (.p8, curva P-256). El header
 * lleva el Key ID; los claims el Team ID y la fecha. Se reusa hasta ~1h (Apple
 * rechaza tokens de mas de 60min y tira si se regeneran demasiado seguido).
 *
 * La firma ES256 debe ser el par (R||S) crudo de 64 bytes, no el DER que
 * produce OpenSSL por defecto: `dsaEncoding: 'ieee-p1363'` da justo ese formato.
 */

const base64url = (input: Buffer | string): string =>
  Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

export function signApnsJwt(
  keyId: string,
  teamId: string,
  privateKeyPem: string,
  iatSeconds: number,
): string {
  const header = base64url(JSON.stringify({ alg: 'ES256', kid: keyId }));
  const claims = base64url(JSON.stringify({ iss: teamId, iat: iatSeconds }));
  const signingInput = `${header}.${claims}`;
  const signature = sign('SHA256', Buffer.from(signingInput), {
    key: privateKeyPem,
    dsaEncoding: 'ieee-p1363',
  });
  return `${signingInput}.${base64url(signature)}`;
}
