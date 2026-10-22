import {
  signLinkToken,
  verifyLinkToken,
  generateLinkNonce,
  LINK_TOKEN_PREFIX,
} from './link-token.util';

describe('link token', () => {
  const secret = 's3cr3t';

  it('firma y verifica ida y vuelta', () => {
    const nonce = generateLinkNonce();
    const tok = signLinkToken('order1', nonce, secret);
    expect(tok.startsWith(`${LINK_TOKEN_PREFIX}.`)).toBe(true);
    expect(verifyLinkToken(tok, secret)).toEqual({ orderId: 'order1', nonce });
  });

  it('genera nonce de 8 chars hex', () => {
    expect(generateLinkNonce()).toMatch(/^[0-9a-f]{8}$/);
  });

  it('rechaza token manipulado o de otro secreto', () => {
    const tok = signLinkToken('o', generateLinkNonce(), secret);
    expect(verifyLinkToken(tok + 'x', secret)).toBeNull();
    expect(verifyLinkToken(tok, 'otro')).toBeNull();
  });

  it('rechaza un token de ficha (prefijo AR1), no de link', () => {
    expect(verifyLinkToken('AR1.o.n.sig', secret)).toBeNull();
  });

  it('rechaza basura', () => {
    expect(verifyLinkToken('', secret)).toBeNull();
    expect(verifyLinkToken('ARL1.solo.dos', secret)).toBeNull();
  });
});
