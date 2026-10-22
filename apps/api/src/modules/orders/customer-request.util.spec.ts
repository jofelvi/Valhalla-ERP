import { validateProductRequest } from './customer-request.util';

describe('validateProductRequest', () => {
  it('acepta cantidad valida y producto en venta', () => {
    expect(
      validateProductRequest({ quantity: 2 }, { isForSale: true }),
    ).toEqual({
      ok: true,
    });
  });

  it('rechaza producto inexistente', () => {
    expect(validateProductRequest({ quantity: 1 }, null)).toEqual({
      ok: false,
      reason: 'Producto no disponible',
    });
  });

  it('rechaza producto no en venta', () => {
    expect(
      validateProductRequest({ quantity: 1 }, { isForSale: false }).ok,
    ).toBe(false);
  });

  it('rechaza cantidad fuera de rango', () => {
    expect(
      validateProductRequest({ quantity: 0 }, { isForSale: true }).ok,
    ).toBe(false);
    expect(
      validateProductRequest({ quantity: 21 }, { isForSale: true }).ok,
    ).toBe(false);
    expect(
      validateProductRequest({ quantity: NaN }, { isForSale: true }).ok,
    ).toBe(false);
  });
});
