import {
  calcularMontoDescuento,
  computeOrderTotals,
  DescuentoInvalidoError,
} from './order-totals.util';

/**
 * Reglas de negocio acordadas (01/09):
 *  - La CORTESIA no baja el servicio: el mesonero no pierde su comision por un
 *    error de cocina o una invitacion de la casa.
 *  - El DESCUENTO si lo baja: es una rebaja comercial sobre lo que se cobra,
 *    y el 10% se calcula sobre lo que el cliente realmente paga.
 */
const item = (over: Record<string, unknown> = {}) => ({
  total: 10,
  quantity: 1,
  ...over,
});

describe('computeOrderTotals', () => {
  it('orden simple: total = subtotal + 10% de servicio', () => {
    const t = computeOrderTotals([item({ total: 100 })], true);
    expect(t).toMatchObject({
      subtotal: 100,
      serviceCharge: 10,
      discountAmount: 0,
      noChargeAmount: 0,
      total: 110,
    });
  });

  it('la cortesia NO baja el servicio (se cobra sobre el precio pleno)', () => {
    const t = computeOrderTotals(
      [item({ total: 100 }), item({ total: 100, noCharge: true })],
      true,
    );
    expect(t.subtotal).toBe(200);
    expect(t.serviceCharge).toBe(20); // 10% de 200, no de 100
    expect(t.noChargeAmount).toBe(100);
    expect(t.total).toBe(120); // 200 + 20 - 100
  });

  // ─── comisionBase: la cortesia SI baja la comision del mesonero ─────────
  it('orden simple: comisionBase = ventas del mesonero (100 % del subtotal)', () => {
    const t = computeOrderTotals([item({ total: 100 })], true);
    expect(t.comisionBase).toBe(100);
  });

  it('cortesia parcial: comisionBase solo sobre lo cobrado', () => {
    const t = computeOrderTotals(
      [item({ total: 100 }), item({ total: 100, noCharge: true })],
      true,
    );
    // serviceCharge sigue en 20 (el cliente), pero la comision es 10% de 100
    expect(t.serviceCharge).toBe(20);
    expect(t.comisionBase).toBe(100); // (200 - 100 cortesia)
  });

  it('cortesia total: comisionBase = 0 (la casa invita, no hay comision)', () => {
    const t = computeOrderTotals(
      [
        item({ total: 60, noCharge: true }),
        item({ total: 40, noCharge: true }),
      ],
      true,
    );
    expect(t.noChargeAmount).toBe(100);
    expect(t.comisionBase).toBe(0);
  });

  it('comisionBase resta cortesia Y descuento; el mesonero conserva el resto', () => {
    const t = computeOrderTotals(
      [
        item({ total: 100, discountAmount: 20 }),
        item({ total: 50, noCharge: true }),
      ],
      true,
    );
    // 10% de (150 - 50 cortesia - 20 descuento) = 10% de 80 = 8
    expect(t.comisionBase).toBe(80);
    expect(t.serviceCharge).toBe(13); // el cliente paga 10% de (150 - 20)
  });

  it('sin mesonero no hay comisionBase', () => {
    const t = computeOrderTotals([item({ total: 100 })], false);
    expect(t.comisionBase).toBe(0);
  });

  it('el descuento SI baja el servicio', () => {
    const t = computeOrderTotals(
      [item({ total: 100, discountAmount: 40 })],
      true,
    );
    expect(t.subtotal).toBe(100);
    expect(t.discountAmount).toBe(40);
    expect(t.serviceCharge).toBe(6); // 10% de (100 - 40)
    expect(t.total).toBe(66); // 100 + 6 - 40
  });

  it('descuento y cortesia conviven sin pisarse', () => {
    const t = computeOrderTotals(
      [
        item({ total: 100, discountAmount: 20 }),
        item({ total: 50, noCharge: true }),
      ],
      true,
    );
    expect(t.subtotal).toBe(150);
    expect(t.discountAmount).toBe(20);
    expect(t.noChargeAmount).toBe(50);
    expect(t.serviceCharge).toBe(13); // 10% de (150 - 20)
    expect(t.total).toBe(93); // 150 + 13 - 50 - 20
  });

  it('ignora el descuento de un item cancelado', () => {
    const t = computeOrderTotals(
      [
        item({ total: 100 }),
        item({ total: 80, discountAmount: 80, cancelledAt: new Date() }),
      ],
      true,
    );
    expect(t.subtotal).toBe(100);
    expect(t.discountAmount).toBe(0);
    expect(t.total).toBe(110);
  });

  it('sin mesonero no hay servicio, y el descuento igual se resta', () => {
    const t = computeOrderTotals(
      [item({ total: 100, discountAmount: 30 })],
      false,
    );
    expect(t.serviceCharge).toBe(0);
    expect(t.total).toBe(70);
  });
});

describe('calcularMontoDescuento', () => {
  const TOPE = 50;

  it('porcentaje sobre el total de la linea', () => {
    expect(calcularMontoDescuento(80, 'PCT', 25, TOPE)).toBe(20);
  });

  it('monto fijo se toma tal cual', () => {
    expect(calcularMontoDescuento(80, 'AMOUNT', 30, TOPE)).toBe(30);
  });

  it('redondea a 2 decimales', () => {
    expect(calcularMontoDescuento(33.33, 'PCT', 10, TOPE)).toBe(3.33);
  });

  it('rechaza un porcentaje por encima del tope', () => {
    expect(() => calcularMontoDescuento(80, 'PCT', 60, TOPE)).toThrow(
      DescuentoInvalidoError,
    );
  });

  it('rechaza un monto que supera el tope de la linea', () => {
    // 50 sobre una linea de 80 es 62.5% > 50%
    expect(() => calcularMontoDescuento(80, 'AMOUNT', 50, TOPE)).toThrow(
      DescuentoInvalidoError,
    );
  });

  it('rechaza valores no positivos', () => {
    expect(() => calcularMontoDescuento(80, 'PCT', 0, TOPE)).toThrow(
      DescuentoInvalidoError,
    );
    expect(() => calcularMontoDescuento(80, 'AMOUNT', -5, TOPE)).toThrow(
      DescuentoInvalidoError,
    );
  });

  it('rechaza descontar sobre una linea sin importe', () => {
    expect(() => calcularMontoDescuento(0, 'PCT', 10, TOPE)).toThrow(
      DescuentoInvalidoError,
    );
  });
});
