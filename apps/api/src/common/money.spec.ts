import {
  resolveUsdAmount,
  pareceOtraMoneda,
  MAX_FACTOR_SOBRE_TOTAL,
} from './money';

describe('resolveUsdAmount — el bug de bolivares en el campo de dolares', () => {
  it('deriva el USD de los bolivares e IGNORA el que mando el cliente', () => {
    // Caso real de produccion (15/06/2026): la orden valia $1.65 y quedo
    // guardada como $961.43 porque el cliente mando los bolivares en el
    // campo USD y el servidor lo copio tal cual.
    expect(
      resolveUsdAmount({
        amountUsd: 961.43,
        amountBs: 961.43,
        bcvRate: 582.6862,
      }),
    ).toBe(1.65);
  });

  it('tambien corrige un USD mal convertido, no solo el identico al Bs', () => {
    // El saneo anterior solo miraba si USD == Bs. Un valor a medio convertir
    // pasaba el filtro intacto; derivar siempre lo corrige igual.
    expect(
      resolveUsdAmount({ amountUsd: 99.99, amountBs: 7000, bcvRate: 700 }),
    ).toBe(10);
  });

  it('usa el USD del cliente cuando no hay con que derivarlo', () => {
    expect(resolveUsdAmount({ amountUsd: 12.5 })).toBe(12.5);
    expect(resolveUsdAmount({ amountUsd: 12.5, amountBs: 8750 })).toBe(12.5);
    expect(resolveUsdAmount({ amountUsd: 12.5, bcvRate: 700 })).toBe(12.5);
  });

  it('no divide por una tasa invalida', () => {
    expect(
      resolveUsdAmount({ amountUsd: 12.5, amountBs: 8750, bcvRate: 0 }),
    ).toBe(12.5);
    expect(
      resolveUsdAmount({ amountUsd: 12.5, amountBs: 8750, bcvRate: -1 }),
    ).toBe(12.5);
  });

  it('devuelve 0 en vez de NaN cuando no hay nada utilizable', () => {
    expect(resolveUsdAmount({})).toBe(0);
    expect(resolveUsdAmount({ amountUsd: null, amountBs: null })).toBe(0);
  });

  it('redondea a centavos', () => {
    expect(resolveUsdAmount({ amountBs: 1000, bcvRate: 3 })).toBe(333.33);
  });
});

describe('pareceOtraMoneda — la red de seguridad', () => {
  it('detecta un monto en bolivares contra el total de la orden', () => {
    expect(pareceOtraMoneda(961.43, 1.65)).toBe(true);
    expect(pareceOtraMoneda(12562.71, 51.86)).toBe(true);
  });

  it('deja pasar un cobro normal, con propina incluida', () => {
    expect(pareceOtraMoneda(58.63, 58.63)).toBe(false);
    expect(pareceOtraMoneda(79.37, 58.63)).toBe(false); // propina de $20
    expect(pareceOtraMoneda(115.5, 57.75)).toBe(false); // cuenta dividida
  });

  it('no se activa sin un total con el cual comparar', () => {
    expect(pareceOtraMoneda(5000, 0)).toBe(false);
    expect(pareceOtraMoneda(5000, undefined)).toBe(false);
  });

  it('el limite es exactamente el factor documentado', () => {
    expect(pareceOtraMoneda(10 * MAX_FACTOR_SOBRE_TOTAL, 10)).toBe(false);
    expect(pareceOtraMoneda(10 * MAX_FACTOR_SOBRE_TOTAL + 0.01, 10)).toBe(true);
  });
});
