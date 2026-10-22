import { roundMoney } from './round-money.util';

describe('roundMoney — redondeo de dinero a 2 decimales (Math.round(v*100)/100)', () => {
  it('redondea a 2 decimales', () => {
    expect(roundMoney(1.005)).toBe(1.0); // 1.005*100=100.4999.. → 100 → 1.00 (coma flotante)
    expect(roundMoney(1.234)).toBe(1.23);
    expect(roundMoney(1.235)).toBe(1.24);
    expect(roundMoney(1.236)).toBe(1.24);
  });

  it('deja intactos los valores ya de 2 decimales', () => {
    expect(roundMoney(29.0)).toBe(29.0);
    expect(roundMoney(4.16)).toBe(4.16);
  });

  it('la validacion de porcentajes que suman 100 (uso real en transferencia)', () => {
    expect(roundMoney(50 + 50)).toBe(100);
    expect(roundMoney(33.33 + 66.67)).toBe(100);
  });

  it('acumula sin arrastrar error de coma flotante', () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
  });

  it('maneja negativos', () => {
    // -1.235*100 = -123.50000000000001 en coma flotante → Math.round = -124.
    expect(roundMoney(-1.235)).toBe(-1.24);
  });
});
