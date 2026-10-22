import { decidePrintServiceKey } from './print-service-key';

describe('decidePrintServiceKey', () => {
  const clave = 'k-1234567890';

  it('sin clave configurada deja pasar todo (comportamiento de hoy)', () => {
    expect(decidePrintServiceKey(undefined, {})).toEqual({ action: 'allow' });
    expect(
      decidePrintServiceKey('cualquiera', { PRINT_SERVICE_KEY: '  ' }),
    ).toEqual({
      action: 'allow',
    });
  });

  it('con la clave correcta deja pasar', () => {
    expect(
      decidePrintServiceKey(clave, {
        PRINT_SERVICE_KEY: clave,
        PRINT_SERVICE_KEY_ENFORCE: 'true',
      }),
    ).toEqual({ action: 'allow' });
  });

  it('sin ENFORCE audita a quien llega sin clave o con una equivocada', () => {
    expect(
      decidePrintServiceKey(undefined, { PRINT_SERVICE_KEY: clave }),
    ).toEqual({
      action: 'audit',
      reason: 'sin clave del print-service',
    });
    expect(decidePrintServiceKey('otra', { PRINT_SERVICE_KEY: clave })).toEqual(
      {
        action: 'audit',
        reason: 'clave del print-service invalida',
      },
    );
  });

  it('con ENFORCE=true rechaza', () => {
    const env = { PRINT_SERVICE_KEY: clave, PRINT_SERVICE_KEY_ENFORCE: 'TRUE' };
    expect(decidePrintServiceKey(undefined, env).action).toBe('deny');
    expect(decidePrintServiceKey(`${clave}x`, env).action).toBe('deny');
    expect(decidePrintServiceKey(['no-string'], env).action).toBe('deny');
  });
});
