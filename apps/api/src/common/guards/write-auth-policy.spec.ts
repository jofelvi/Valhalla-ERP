import {
  decideWriteAuth,
  isEnforceEnabled,
  readAuthMode,
} from './write-auth-policy';

const decide = (over: Partial<Parameters<typeof decideWriteAuth>[0]> = {}) =>
  decideWriteAuth({
    method: 'POST',
    hasUser: false,
    hasAuthHeader: false,
    enforce: false,
    readMode: 'open',
    ...over,
  });

describe('decideWriteAuth', () => {
  describe('con sesion valida', () => {
    it('deja pasar cualquier metodo', () => {
      for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) {
        expect(decide({ method, hasUser: true }).action).toBe('allow');
      }
    });

    it('deja pasar tambien en modo enforce', () => {
      expect(decide({ hasUser: true, enforce: true }).action).toBe('allow');
    });
  });

  describe('lecturas sin sesion (siguen abiertas por la transicion)', () => {
    it('GET pasa incluso en enforce', () => {
      expect(decide({ method: 'GET', enforce: true }).action).toBe('allow');
    });

    it('HEAD y OPTIONS pasan', () => {
      expect(decide({ method: 'HEAD', enforce: true }).action).toBe('allow');
      expect(decide({ method: 'OPTIONS', enforce: true }).action).toBe('allow');
    });

    it('el metodo en minuscula tambien se reconoce como lectura', () => {
      expect(decide({ method: 'get', enforce: true }).action).toBe('allow');
    });
  });

  describe('escrituras sin sesion', () => {
    it('en modo auditoria deja pasar pero marca para registrar', () => {
      const d = decide({ method: 'POST', enforce: false });
      expect(d.action).toBe('audit');
      expect(d.reason).toContain('sin header');
    });

    it('en modo enforce las rechaza', () => {
      expect(decide({ method: 'POST', enforce: true }).action).toBe('deny');
      expect(decide({ method: 'PATCH', enforce: true }).action).toBe('deny');
      expect(decide({ method: 'DELETE', enforce: true }).action).toBe('deny');
    });

    it('distingue token invalido de token ausente (es mas grave)', () => {
      const conToken = decide({ hasAuthHeader: true });
      expect(conToken.reason).toContain('invalido o expirado');

      const sinToken = decide({ hasAuthHeader: false });
      expect(sinToken.reason).toContain('sin header');
    });
  });
});

describe('lecturas sin sesion segun AUTH_ENFORCE_READS', () => {
  it('open: GET pasa (comportamiento de hoy)', () => {
    expect(decide({ method: 'GET', readMode: 'open' }).action).toBe('allow');
  });

  it('audit: GET pasa pero queda auditado', () => {
    const d = decide({ method: 'GET', readMode: 'audit' });
    expect(d.action).toBe('audit');
    expect(d.reason).toMatch(/lectura/);
  });

  it('enforce: GET sin sesion se rechaza', () => {
    expect(decide({ method: 'GET', readMode: 'enforce' }).action).toBe('deny');
  });

  it('OPTIONS (preflight CORS) pasa siempre', () => {
    expect(decide({ method: 'OPTIONS', readMode: 'enforce' }).action).toBe(
      'allow',
    );
  });

  it('con sesion valida un GET pasa aunque sea enforce', () => {
    expect(
      decide({ method: 'GET', hasUser: true, readMode: 'enforce' }).action,
    ).toBe('allow');
  });
});

describe('readAuthMode', () => {
  it.each([
    [undefined, 'enforce'],
    ['', 'enforce'],
    ['true', 'enforce'],
    ['cualquier', 'enforce'],
    ['audit', 'audit'],
    ['AUDIT', 'audit'],
    ['open', 'open'],
    ['false', 'open'],
  ])('%s -> %s', (v, esperado) => {
    expect(readAuthMode({ AUTH_ENFORCE_READS: v })).toBe(esperado);
  });
});

describe('isEnforceEnabled', () => {
  it('por defecto está activo: una instalación nueva rechaza escrituras sin sesión', () => {
    expect(isEnforceEnabled({})).toBe(true);
    expect(isEnforceEnabled({ AUTH_ENFORCE_WRITES: '' })).toBe(true);
    expect(isEnforceEnabled({ AUTH_ENFORCE_WRITES: 'true' })).toBe(true);
    expect(isEnforceEnabled({ AUTH_ENFORCE_WRITES: '1' })).toBe(true);
  });

  it('solo un valor explícito de apagado vuelve a la auditoría', () => {
    expect(isEnforceEnabled({ AUTH_ENFORCE_WRITES: 'false' })).toBe(false);
    expect(isEnforceEnabled({ AUTH_ENFORCE_WRITES: 'OFF' })).toBe(false);
    expect(isEnforceEnabled({ AUTH_ENFORCE_WRITES: 'audit' })).toBe(false);
  });
});
