import { decideRoleAuth, isRoleEnforceEnabled } from './role-auth-policy';

const decide = (over: Partial<Parameters<typeof decideRoleAuth>[0]> = {}) =>
  decideRoleAuth({
    requiresRoles: true,
    hasUser: false,
    userRole: undefined,
    requiredRoles: ['admin', 'manager'],
    enforce: false,
    ...over,
  });

describe('decideRoleAuth', () => {
  describe('rutas sin @Roles', () => {
    it('pasan siempre, aun sin usuario y en enforce', () => {
      expect(
        decide({ requiresRoles: false, hasUser: false, enforce: true }).action,
      ).toBe('allow');
    });
  });

  describe('anonimo en ruta que exige rol', () => {
    it('en auditoria (default) deja pasar pero marca para registrar', () => {
      const d = decide({ hasUser: false, enforce: false });
      expect(d.action).toBe('audit');
      expect(d.reason).toContain('no hay sesion');
    });

    it('en enforce lo rechaza', () => {
      expect(decide({ hasUser: false, enforce: true }).action).toBe('deny');
    });
  });

  describe('usuario autenticado (no depende del flag)', () => {
    it('rol que coincide pasa', () => {
      expect(decide({ hasUser: true, userRole: 'admin' }).action).toBe('allow');
    });

    it('rol que NO coincide se rechaza incluso en auditoria', () => {
      const d = decide({ hasUser: true, userRole: 'waiter', enforce: false });
      expect(d.action).toBe('deny');
      expect(d.reason).toContain('no autorizado');
    });

    it('rol que NO coincide se rechaza tambien en enforce', () => {
      expect(
        decide({ hasUser: true, userRole: 'waiter', enforce: true }).action,
      ).toBe('deny');
    });
  });
});

describe('isRoleEnforceEnabled', () => {
  it('por defecto está activo: el anónimo no pasa donde se exige rol', () => {
    expect(isRoleEnforceEnabled({})).toBe(true);
    expect(isRoleEnforceEnabled({ AUTH_ENFORCE_ROLES: '' })).toBe(true);
    expect(isRoleEnforceEnabled({ AUTH_ENFORCE_ROLES: 'true' })).toBe(true);
  });

  it('solo un valor explícito de apagado vuelve a la auditoría', () => {
    expect(isRoleEnforceEnabled({ AUTH_ENFORCE_ROLES: 'false' })).toBe(false);
    expect(isRoleEnforceEnabled({ AUTH_ENFORCE_ROLES: '0' })).toBe(false);
    expect(isRoleEnforceEnabled({ AUTH_ENFORCE_ROLES: 'audit' })).toBe(false);
  });
});
