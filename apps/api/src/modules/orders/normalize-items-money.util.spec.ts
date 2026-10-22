import { normalizeItemsMoney } from './normalize-items-money.util';

describe('normalizeItemsMoney', () => {
  it('total = unitPrice x quantity con cantidad multiple', () => {
    const [it] = normalizeItemsMoney([{ unitPrice: 3.5, quantity: 3 }]);
    expect(it.unitPrice).toBe(3.5);
    expect(it.total).toBe(10.5);
  });

  it('deriva unitPrice desde price (legacy) cuando unitPrice falta', () => {
    const [it] = normalizeItemsMoney([{ price: 2.25, quantity: 4 }]);
    expect(it.unitPrice).toBe(2.25);
    expect(it.total).toBe(9);
  });

  it('deriva unitPrice desde total / quantity cuando no hay unitPrice ni price', () => {
    const [it] = normalizeItemsMoney([{ total: 12, quantity: 4 }]);
    expect(it.unitPrice).toBe(3);
    expect(it.total).toBe(12);
  });

  it('deriva unitPrice desde totalPrice (compat mobile) cuando no hay total', () => {
    const [it] = normalizeItemsMoney([{ totalPrice: 9, quantity: 3 }]);
    expect(it.unitPrice).toBe(3);
    expect(it.total).toBe(9);
  });

  it('quantity 0 => unitPrice 0 y total 0 (no divide por cero)', () => {
    const [it] = normalizeItemsMoney([{ total: 12, quantity: 0 }]);
    expect(it.unitPrice).toBe(0);
    expect(it.total).toBe(0);
  });

  it('unitPrice negativo se descarta y cae al fallback', () => {
    const [it] = normalizeItemsMoney([{ unitPrice: -5, price: 2, quantity: 2 }]);
    expect(it.unitPrice).toBe(2);
    expect(it.total).toBe(4);
  });

  it('redondea unitPrice y total a 2 decimales', () => {
    const [it] = normalizeItemsMoney([{ total: 10, quantity: 3 }]);
    expect(it.unitPrice).toBe(3.33);
    expect(it.total).toBe(9.99);
  });

  it('cortesia (noCharge) se preserva intacta; el total sigue siendo unitPrice x quantity', () => {
    const [it] = normalizeItemsMoney([
      { unitPrice: 5, quantity: 2, noCharge: true },
    ]);
    expect(it.noCharge).toBe(true);
    expect(it.total).toBe(10);
  });

  it('descuento (discountAmount) se preserva intacto; no altera el total normalizado', () => {
    const [it] = normalizeItemsMoney([
      { unitPrice: 5, quantity: 2, discountAmount: 3 },
    ]);
    expect(it.discountAmount).toBe(3);
    expect(it.total).toBe(10);
  });

  it('devuelve un array nuevo sin mutar el original', () => {
    const original = [{ unitPrice: 5, quantity: 2 }];
    const result = normalizeItemsMoney(original);
    expect(result[0]).not.toBe(original[0]);
    expect(original[0]).not.toHaveProperty('total');
  });

  it('procesa varios items independientes', () => {
    const result = normalizeItemsMoney([
      { unitPrice: 1, quantity: 2 },
      { price: 3, quantity: 3 },
    ]);
    expect(result[0].total).toBe(2);
    expect(result[1].total).toBe(9);
  });
});
