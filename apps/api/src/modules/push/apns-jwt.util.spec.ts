import { generateKeyPairSync, verify } from 'node:crypto';
import { signApnsJwt } from './apns-jwt.util';

const b64urlToBuf = (s: string): Buffer =>
  Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

describe('signApnsJwt', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'P-256',
  });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

  it('arma un JWT de 3 partes con header ES256 + kid y claims iss/iat', () => {
    const jwt = signApnsJwt('KEY123', 'TEAM456', pem, 1_700_000_000);
    const [h, c, s] = jwt.split('.');
    expect(h && c && s).toBeTruthy();

    const header = JSON.parse(b64urlToBuf(h).toString());
    expect(header).toEqual({ alg: 'ES256', kid: 'KEY123' });

    const claims = JSON.parse(b64urlToBuf(c).toString());
    expect(claims).toEqual({ iss: 'TEAM456', iat: 1_700_000_000 });
  });

  it('la firma verifica con la clave publica (ES256 raw R||S)', () => {
    const jwt = signApnsJwt('K', 'T', pem, 1_700_000_000);
    const [h, c, s] = jwt.split('.');
    const ok = verify(
      'SHA256',
      Buffer.from(`${h}.${c}`),
      { key: publicKey, dsaEncoding: 'ieee-p1363' },
      b64urlToBuf(s),
    );
    expect(ok).toBe(true);
  });

  it('la firma raw tiene 64 bytes (P-256)', () => {
    const jwt = signApnsJwt('K', 'T', pem, 1);
    const sig = b64urlToBuf(jwt.split('.')[2]);
    expect(sig.length).toBe(64);
  });
});
