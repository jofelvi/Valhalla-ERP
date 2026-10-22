import { NOMINA_DEFAULT, TARIFAS_DEFAULT } from '@odin6/types';
import {
  validarFusion,
  construirFusion,
  type OrdenFusionable,
} from './merge-orders.util';

/**
 * La logica de plata de la fusion, sin mocks.
 *
 * Cada caso de aca vigila una forma concreta de perder dinero. Ninguna se ve
 * mirando la pantalla despues: todas producen un numero que PARECE correcto.
 */

const orden = (over: Partial<OrdenFusionable> = {}): OrdenFusionable => ({
  _id: 'ord-destino',
  waiterId: 'w-1',
  waiterName: 'Mayer',
  items: [],
  subtotal: 0,
  serviceCharge: 0,
  tax: 0,
  total: 0,
  tipAmount: 0,
  paidAmount: 0,
  paymentStatus: 'pending',
  status: 'PENDING',
  isDeleted: false,
  waiterShares: [],
  ...over,
});

const item = (over: Record<string, unknown> = {}) => ({
  productId: 'p-1',
  productName: 'Cerveza Pilsen',
  quantity: 2,
  unitPrice: 1.2,
  totalPrice: 2.4,
  ...over,
});

describe('validarFusion — lo que NO se puede fusionar', () => {
  it('rechaza fusionar una orden consigo misma', () => {
    const a = orden({ _id: 'x' });
    expect(validarFusion(a, orden({ _id: 'x' }))).toMatch(/misma orden/i);
  });

  it('rechaza si el destino ya tiene plata cobrada', () => {
    const destino = orden({ paidAmount: 20, paymentStatus: 'partially_paid' });
    expect(validarFusion(destino, orden({ _id: 'otra' }))).toMatch(/cobrad/i);
  });

  it('rechaza si el origen ya tiene plata cobrada', () => {
    const origen = orden({ _id: 'otra', paidAmount: 5 });
    expect(validarFusion(orden(), origen)).toMatch(/cobrad/i);
  });

  it('rechaza una orden ya pagada', () => {
    const origen = orden({ _id: 'otra', paymentStatus: 'paid' });
    expect(validarFusion(orden(), origen)).toMatch(/pagad/i);
  });

  it('rechaza una orden ya borrada o fusionada antes', () => {
    expect(
      validarFusion(orden(), orden({ _id: 'o', isDeleted: true })),
    ).toBeTruthy();
    expect(
      validarFusion(orden(), orden({ _id: 'o', mergedIntoOrderId: 'z' })),
    ).toMatch(/fusionad/i);
  });

  it('rechaza si la comision del origen YA se pago', () => {
    // Si no: los items pasan al destino, el destino recalcula su 10% y ese
    // mismo consumo paga comision por segunda vez.
    const origen = orden({
      _id: 'otra',
      waiterShares: [{ waiterId: 'w-2', pct: 100, comisionPagada: true }],
    });
    expect(validarFusion(orden(), origen)).toMatch(/comisi/i);
  });

  it('rechaza si el origen ya tiene credito otorgado', () => {
    // La cuenta por cobrar le seguiria cobrando al cliente un consumo que
    // ahora se factura en el destino.
    const origen = orden({
      _id: 'otra',
      creditRequest: { status: 'APPROVED' },
    });
    expect(validarFusion(orden(), origen)).toMatch(/cr[eé]dito/i);
  });

  it('rechaza si ambas tienen clientes vinculados DISTINTOS', () => {
    const destino = orden({ customerId: 'c-1' });
    const origen = orden({ _id: 'otra', customerId: 'c-2' });
    expect(validarFusion(destino, origen)).toMatch(/cliente/i);
  });

  it('deja pasar el caso sano', () => {
    expect(validarFusion(orden(), orden({ _id: 'otra' }))).toBeNull();
  });
});

describe('construirFusion — los items se mueven SIN perder estado', () => {
  it('conserva los campos de entrega e inventario del item movido', () => {
    // El caso que evita repetir el descuento doble que dejo la Pilsen en -2274.
    const entregado = item({
      quantity: 3,
      totalPrice: 3.6,
      sentQty: 3,
      deliveredQty: 3,
      inventoryConsumedQty: 3,
      printedQty: 3,
      quantityLog: [{ qty: 3, at: '2026-08-29' }],
    });
    const destino = orden({ items: [], subtotal: 0 });
    const origen = orden({ _id: 'otra', items: [entregado], subtotal: 3.6 });

    const r = construirFusion(destino, origen);
    const movido = r.items[0] as Record<string, unknown>;

    expect(movido.inventoryConsumedQty).toBe(3);
    expect(movido.deliveredQty).toBe(3);
    expect(movido.sentQty).toBe(3);
    expect(movido.printedQty).toBe(3);
    expect(movido.quantityLog).toEqual([{ qty: 3, at: '2026-08-29' }]);
  });

  it('conserva la cortesia: un item sin cargo no se vuelve cobrable', () => {
    const cortesia = item({
      noCharge: true,
      noChargeBy: 'admin-1',
      noChargeReason: 'invitacion',
    });
    const r = construirFusion(
      orden(),
      orden({ _id: 'otra', items: [cortesia], subtotal: 2.4 }),
    );
    const movido = r.items[0] as Record<string, unknown>;
    expect(movido.noCharge).toBe(true);
    expect(movido.noChargeReason).toBe('invitacion');
  });

  it('no agrupa items iguales: quedan dos renglones', () => {
    const destino = orden({ items: [item()], subtotal: 2.4 });
    const origen = orden({ _id: 'otra', items: [item()], subtotal: 2.4 });
    const r = construirFusion(destino, origen);
    expect(r.items).toHaveLength(2);
  });

  it('los items del destino van primero y los del origen despues', () => {
    const destino = orden({
      items: [item({ productName: 'A' })],
      subtotal: 2.4,
    });
    const origen = orden({
      _id: 'otra',
      items: [item({ productName: 'B' })],
      subtotal: 2.4,
    });
    const r = construirFusion(destino, origen);
    expect((r.items[0] as { productName: string }).productName).toBe('A');
    expect((r.items[1] as { productName: string }).productName).toBe('B');
  });
});

describe('construirFusion — la plata', () => {
  // Los totales salen de los items juntos, no de sumar los totales viejos.
  const linea = (total: number) =>
    item({ quantity: 1, unitPrice: total, total });

  it('recalcula el servicio sobre el consumo junto, no suma los dos servicios viejos', () => {
    const destino = orden({
      items: [linea(40)],
      subtotal: 40,
      serviceCharge: 4,
    });
    const origen = orden({
      _id: 'otra',
      items: [linea(60)],
      subtotal: 60,
      serviceCharge: 6,
    });

    const r = construirFusion(destino, origen);

    expect(r.totales.subtotal).toBe(100);
    expect(r.totales.serviceCharge).toBe(10);
    expect(r.totales.total).toBe(110);
  });

  it('no cobra servicio si no hay mesonero', () => {
    const destino = orden({
      waiterId: undefined,
      waiterName: undefined,
      items: [linea(40)],
    });
    const origen = orden({
      _id: 'otra',
      waiterId: undefined,
      items: [linea(60)],
    });
    const r = construirFusion(destino, origen);
    expect(r.totales.serviceCharge).toBe(0);
    expect(r.totales.total).toBe(100);
  });

  it('suma las propinas de ambas y las deja FUERA del total', () => {
    const destino = orden({ items: [linea(40)], tipAmount: 3 });
    const origen = orden({ _id: 'otra', items: [linea(60)], tipAmount: 2 });
    const r = construirFusion(destino, origen);
    expect(r.tipAmount).toBe(5);
    expect(r.totales.total).toBe(110); // 100 + 10 de servicio, sin la propina
  });

  it('recalcula el impuesto con la configuracion del destino (sumado)', () => {
    const config = {
      tarifas: {
        ...TARIFAS_DEFAULT,
        tax: {
          ...TARIFAS_DEFAULT.tax,
          enabled: true,
          rate: 0.16,
          includedInPrice: false,
        },
      },
      nomina: NOMINA_DEFAULT,
    };
    const destino = orden({ items: [linea(40)] });
    const origen = orden({ _id: 'otra', items: [linea(60)] });
    const r = construirFusion(destino, origen, config);
    expect(r.totales.tax).toBe(16);
    expect(r.totales.total).toBe(126); // 100 + 10 + 16
  });

  it('con el impuesto incluido en el precio, no lo suma', () => {
    const config = {
      tarifas: {
        ...TARIFAS_DEFAULT,
        tax: {
          ...TARIFAS_DEFAULT.tax,
          enabled: true,
          rate: 0.16,
          includedInPrice: true,
        },
      },
      nomina: NOMINA_DEFAULT,
    };
    const destino = orden({ items: [linea(40)] });
    const origen = orden({ _id: 'otra', items: [linea(60)] });
    const r = construirFusion(destino, origen, config);
    expect(r.totales.tax).toBeCloseTo(13.79, 2);
    expect(r.totales.total).toBe(110); // el impuesto ya esta en los 100
  });
});

describe('construirFusion — la comision', () => {
  it('mismo mesonero: no escribe reparto', () => {
    const destino = orden({ waiterId: 'w-1', subtotal: 40 });
    const origen = orden({ _id: 'otra', waiterId: 'w-1', subtotal: 60 });
    expect(construirFusion(destino, origen).waiterShares).toEqual([]);
  });

  it('mesoneros distintos: reparte proporcional a lo que aporto cada uno', () => {
    const destino = orden({
      waiterId: 'w-1',
      waiterName: 'Mayer',
      subtotal: 40,
    });
    const origen = orden({
      _id: 'otra',
      waiterId: 'w-2',
      waiterName: 'Jostin',
      subtotal: 60,
    });

    const shares = construirFusion(destino, origen).waiterShares;

    expect(shares).toHaveLength(2);
    expect(shares.find((s) => s.waiterId === 'w-1')?.pct).toBe(40);
    expect(shares.find((s) => s.waiterId === 'w-2')?.pct).toBe(60);
    expect(shares.reduce((s, x) => s + x.pct, 0)).toBe(100);
  });

  it('el reparto SIEMPRE suma 100, aunque el prorrateo de decimales', () => {
    // 1/3 y 2/3 no dan redondo: el resto se ajusta para no regalar ni cobrar
    // de mas en la nomina.
    const destino = orden({ waiterId: 'w-1', subtotal: 10 });
    const origen = orden({ _id: 'otra', waiterId: 'w-2', subtotal: 20 });
    const shares = construirFusion(destino, origen).waiterShares;
    expect(shares.reduce((s, x) => s + x.pct, 0)).toBe(100);
  });

  it('respeta un reparto previo del destino y lo reescala', () => {
    // El destino venia de una transferencia de mesa: dos mesoneros al 50%
    // sobre SU subtotal. Al entrar un tercero, los tres tienen que sumar 100.
    const destino = orden({
      waiterId: 'w-1',
      subtotal: 40,
      waiterShares: [
        { waiterId: 'w-1', waiterName: 'Mayer', pct: 50 },
        { waiterId: 'w-3', waiterName: 'Abril', pct: 50 },
      ],
    });
    const origen = orden({ _id: 'otra', waiterId: 'w-2', subtotal: 60 });

    const shares = construirFusion(destino, origen).waiterShares;

    expect(shares.reduce((s, x) => s + x.pct, 0)).toBe(100);
    // w-1 y w-3 se reparten el 40% que aporto el destino: 20 cada uno.
    expect(shares.find((s) => s.waiterId === 'w-1')?.pct).toBe(20);
    expect(shares.find((s) => s.waiterId === 'w-3')?.pct).toBe(20);
    expect(shares.find((s) => s.waiterId === 'w-2')?.pct).toBe(60);
  });

  it('un subtotal en cero no rompe el reparto', () => {
    const destino = orden({ waiterId: 'w-1', subtotal: 0 });
    const origen = orden({ _id: 'otra', waiterId: 'w-2', subtotal: 0 });
    const shares = construirFusion(destino, origen).waiterShares;
    expect(shares.reduce((s, x) => s + x.pct, 0)).toBe(100);
  });
});
