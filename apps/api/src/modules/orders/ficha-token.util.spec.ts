import {
  FICHA_TOKEN_PREFIX,
  generateFichaNonce,
  signFichaToken,
  verifyFichaToken,
} from './ficha-token.util';

describe('ficha-token.util', () => {
  const secret = 'test-secret-123';
  const orderId = '507f1f77bcf86cd799439011';

  it('genera un nonce hex de 8 chars', () => {
    const nonce = generateFichaNonce();
    expect(nonce).toMatch(/^[0-9a-f]{8}$/);
  });

  it('firma con el prefijo AR1 y 4 segmentos', () => {
    const token = signFichaToken(orderId, 'abcd1234', secret);
    const parts = token.split('.');
    expect(parts[0]).toBe(FICHA_TOKEN_PREFIX);
    expect(parts).toHaveLength(4);
    expect(parts[1]).toBe(orderId);
    expect(parts[2]).toBe('abcd1234');
  });

  it('verifica un token válido y devuelve orderId + nonce', () => {
    const token = signFichaToken(orderId, 'abcd1234', secret);
    expect(verifyFichaToken(token, secret)).toEqual({
      orderId,
      nonce: 'abcd1234',
    });
  });

  it('rechaza firma manipulada', () => {
    const token = signFichaToken(orderId, 'abcd1234', secret);
    const tampered = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A');
    expect(verifyFichaToken(tampered, secret)).toBeNull();
  });

  it('rechaza secreto distinto', () => {
    const token = signFichaToken(orderId, 'abcd1234', secret);
    expect(verifyFichaToken(token, 'otro-secret')).toBeNull();
  });

  it('rechaza prefijo desconocido', () => {
    expect(
      verifyFichaToken(`ZZZ.${orderId}.abcd1234.deadbeef`, secret),
    ).toBeNull();
  });

  it('rechaza formato inválido', () => {
    expect(verifyFichaToken('no-es-un-token', secret)).toBeNull();
    expect(verifyFichaToken('AR1.solo.tres', secret)).toBeNull();
  });
});
