import { baseUrlDeSolicitud, reanclarUploads } from './base-url.util';

describe('reanclarUploads', () => {
  const base = 'https://pos-api.ejemplo.com';

  it('lleva una URL subida a la base pública actual', () => {
    expect(
      reanclarUploads(
        'http://203.0.113.10:3201/uploads/generic/marca/a.png',
        base,
      ),
    ).toBe('https://pos-api.ejemplo.com/uploads/generic/marca/a.png');
  });

  it('respeta URLs ajenas, vacías o sin base', () => {
    expect(reanclarUploads('https://cdn.otro.com/logo.png', base)).toBe(
      'https://cdn.otro.com/logo.png',
    );
    expect(reanclarUploads('', base)).toBe('');
    expect(reanclarUploads('http://x.com/uploads/a.png', '')).toBe(
      'http://x.com/uploads/a.png',
    );
  });

  it('no toca URLs con parámetros o que no cuelgan de /uploads/', () => {
    expect(reanclarUploads('http://x.com/uploads/a.png?v=1', base)).toBe(
      'http://x.com/uploads/a.png?v=1',
    );
    expect(reanclarUploads('http://x.com/otra/uploads/a.png', base)).toBe(
      'http://x.com/otra/uploads/a.png',
    );
  });
});

describe('baseUrlDeSolicitud', () => {
  it('usa el protocolo y host que dejó nginx', () => {
    expect(
      baseUrlDeSolicitud({
        protocol: 'http',
        headers: {
          host: '127.0.0.1:3201',
          'x-forwarded-host': 'api.example.com',
          'x-forwarded-proto': 'https',
        },
      }),
    ).toBe('https://api.example.com');
  });

  it('sin proxy usa el host de la petición', () => {
    expect(
      baseUrlDeSolicitud({
        protocol: 'http',
        headers: { host: 'localhost:3201' },
      }),
    ).toBe('http://localhost:3201');
  });

  it('toma el primer valor de una lista y acepta arreglos', () => {
    expect(
      baseUrlDeSolicitud({
        headers: {
          host: 'a.example.com',
          'x-forwarded-proto': ['https', 'http'],
        },
      }),
    ).toBe('https://a.example.com');
  });

  it('un host con caracteres raros no se usa', () => {
    expect(
      baseUrlDeSolicitud({ headers: { host: 'evil.com/"><script>' } }),
    ).toBe('');
    expect(baseUrlDeSolicitud({ headers: {} })).toBe('');
  });

  it('un protocolo desconocido cae en http', () => {
    expect(
      baseUrlDeSolicitud({
        headers: { host: 'a.example.com', 'x-forwarded-proto': 'javascript' },
      }),
    ).toBe('http://a.example.com');
  });
});
