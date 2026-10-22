import {
  generateVerificationCode,
  hashVerificationCode,
  verificationExpiry,
  isVerificationCodeValid,
  VERIFICATION_CODE_TTL_MS,
} from './verification-code.util';

describe('verification-code.util', () => {
  it('genera un codigo de 6 digitos numericos', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateVerificationCode();
      expect(code).toMatch(/^\d{6}$/);
    }
  });

  it('el hash es estable y no revela el codigo', () => {
    const code = '123456';
    expect(hashVerificationCode(code)).toBe(hashVerificationCode(code));
    expect(hashVerificationCode(code)).not.toContain(code);
    expect(hashVerificationCode('123456')).not.toBe(
      hashVerificationCode('654321'),
    );
  });

  it('acepta el codigo correcto dentro de la ventana', () => {
    const now = new Date('2026-08-13T12:00:00Z');
    const hash = hashVerificationCode('998877');
    const exp = verificationExpiry(now);
    expect(isVerificationCodeValid('998877', hash, exp, now)).toBe(true);
  });

  it('rechaza el codigo incorrecto', () => {
    const now = new Date('2026-08-13T12:00:00Z');
    const hash = hashVerificationCode('998877');
    const exp = verificationExpiry(now);
    expect(isVerificationCodeValid('000000', hash, exp, now)).toBe(false);
  });

  it('rechaza un codigo expirado', () => {
    const now = new Date('2026-08-13T12:00:00Z');
    const hash = hashVerificationCode('998877');
    const exp = verificationExpiry(now);
    const later = new Date(now.getTime() + VERIFICATION_CODE_TTL_MS + 1000);
    expect(isVerificationCodeValid('998877', hash, exp, later)).toBe(false);
  });

  it('rechaza si falta hash o expiracion', () => {
    const now = new Date();
    expect(isVerificationCodeValid('998877', null, now, now)).toBe(false);
    expect(isVerificationCodeValid('998877', 'abc', null, now)).toBe(false);
    expect(isVerificationCodeValid(null, 'abc', now, now)).toBe(false);
  });
});
