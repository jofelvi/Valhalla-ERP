import {
  conAliasDeVentas,
  conAliasDeProducto,
  conAliasDeMesonero,
} from './analytics.service';

/**
 * El contrato con el Panel del APK.
 *
 * El 20/09/2026 el Panel mostraba 0 en todas las tarjetas: normalizaba la
 * respuesta con `?? 0` sobre nombres que esta API nunca mandó. Ese día la API
 * servía $416,58 y 26 órdenes, y nadie se enteró porque no falló nada.
 *
 * Los payloads de abajo son los que devolvió producción ese día, copiados tal
 * cual. Si alguien renombra un campo del pipeline, esta prueba se pone roja en
 * vez de dejar la pantalla en cero.
 */
describe('alias de compatibilidad del Panel del APK', () => {
  it('ventas del día: total→totalSales, count→orderCount, avgOrderValue→averageOrderValue', () => {
    const produccion = {
      total: 416.575,
      count: 26,
      subtotal: 380.73,
      tax: 0,
      avgOrderValue: 16.022115384615383,
    };

    const salida = conAliasDeVentas(produccion);

    expect(salida.totalSales).toBe(416.575);
    expect(salida.orderCount).toBe(26);
    expect(salida.averageOrderValue).toBe(16.022115384615383);
    // los canónicos siguen ahí: la web y cualquier cliente nuevo los usan
    expect(salida.total).toBe(416.575);
    expect(salida.count).toBe(26);
  });

  it('un día sin ventas manda ceros, no undefined', () => {
    const salida = conAliasDeVentas({
      total: 0,
      count: 0,
      subtotal: 0,
      tax: 0,
      avgOrderValue: 0,
    });

    expect(salida.totalSales).toBe(0);
    expect(salida.orderCount).toBe(0);
    expect(salida.averageOrderValue).toBe(0);
  });

  it('top de productos: _id→id, total→revenue', () => {
    const produccion = {
      _id: 'pack-tobo-12',
      name: 'Tobo de Cerveza',
      quantity: 3568,
      total: 7933.0008,
      count: 532,
    };

    const salida = conAliasDeProducto(produccion);

    expect(salida.id).toBe('pack-tobo-12');
    expect(salida.revenue).toBe(7933.0008);
    expect(salida.quantity).toBe(3568);
    expect(salida.name).toBe('Tobo de Cerveza');
  });

  it('top de mesoneros: _id→id, waiterName→name, totalServiceCharge→commission', () => {
    const produccion = {
      _id: 'Q4rrkKdENsXt6mXhuTryu4QDPRo1',
      waiterName: 'Emanuel',
      orderCount: 913,
      totalSales: 17577.3362,
      totalServiceCharge: 1595.595,
      avgOrderValue: 19.25228499452355,
    };

    const salida = conAliasDeMesonero(produccion);

    expect(salida.id).toBe('Q4rrkKdENsXt6mXhuTryu4QDPRo1');
    expect(salida.name).toBe('Emanuel');
    expect(salida.commission).toBe(1595.595);
    expect(salida.orderCount).toBe(913);
  });
});
