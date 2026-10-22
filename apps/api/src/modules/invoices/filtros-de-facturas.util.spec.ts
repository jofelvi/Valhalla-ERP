import {
  construirConsultaDeFacturas,
  LIMITE_DURO_DE_FACTURAS,
  LIMITE_POR_DEFECTO_DE_FACTURAS,
} from './filtros-de-facturas.util';
import { facturaDeLaOrden } from '../../common/invoice-once';

describe('construirConsultaDeFacturas', () => {
  it('sin filtros: aplica el tope por defecto, nunca "todo"', () => {
    // Esto es lo que impide repetir el 22/09/2026: 4.735 facturas y 5,2 MB
    // crudos por llamada, porque findAll no recibia ni un parametro.
    const r = construirConsultaDeFacturas();
    expect(r.query).toEqual({});
    expect(r.limit).toBe(LIMITE_POR_DEFECTO_DE_FACTURAS);
    expect(r.skip).toBe(0);
  });

  it('orderId filtra en Mongo: el parametro que la pantalla ya mandaba', () => {
    // `useInvoiceByOrder` mandaba { orderId } y lo tipaba como Invoice. El
    // parametro no existia, asi que recibia el arreglo entero y el tipo mentia.
    expect(construirConsultaDeFacturas({ orderId: 'o-1' }).query).toEqual({
      orderId: { $eq: 'o-1', $type: 'string' },
    });
  });

  it('customerId filtra', () => {
    expect(construirConsultaDeFacturas({ customerId: 'c-9' }).query).toEqual({
      customerId: 'c-9',
    });
  });

  it('rango de fechas: from y to, juntos o sueltos', () => {
    const ambos = construirConsultaDeFacturas({
      from: '2026-09-01',
      to: '2026-09-30',
    }).query.createdAt as { $gte: Date; $lte: Date };
    expect(ambos.$gte).toEqual(new Date('2026-09-01'));
    expect(ambos.$lte).toEqual(new Date('2026-09-30'));

    const soloDesde = construirConsultaDeFacturas({ from: '2026-09-01' }).query
      .createdAt as { $gte: Date; $lte?: Date };
    expect(soloDesde.$gte).toBeDefined();
    expect(soloDesde.$lte).toBeUndefined();
  });

  it('fecha basura: se ignora en vez de romper la consulta', () => {
    // Un `new Date('mañana')` da Invalid Date, y meterlo en el query devuelve
    // CERO facturas sin un solo error. Preferible ignorarlo.
    expect(
      construirConsultaDeFacturas({ from: 'mañana' }).query.createdAt,
    ).toBeUndefined();
  });

  it('el tope es DURO: pedir de mas no sirve de nada', () => {
    expect(construirConsultaDeFacturas({ limit: '99999' }).limit).toBe(
      LIMITE_DURO_DE_FACTURAS,
    );
  });

  it('limit basura, cero o negativo: cae al defecto, no a "sin limite"', () => {
    // `.limit(0)` en Mongo significa SIN LIMITE, que es justo lo que se arregla.
    for (const malo of ['0', '-5', 'abc', '', 'Infinity']) {
      expect(construirConsultaDeFacturas({ limit: malo }).limit).toBe(
        LIMITE_POR_DEFECTO_DE_FACTURAS,
      );
    }
  });

  it('pagina: el salto se calcula sobre el limite ya acotado', () => {
    // Si se calculara con el limite crudo, limit=9000&page=2 saltaria 9000 y
    // se perderian miles de filas en silencio.
    expect(construirConsultaDeFacturas({ limit: '20', page: '3' }).skip).toBe(
      40,
    );
    expect(
      construirConsultaDeFacturas({ limit: '9000', page: '2' }),
    ).toMatchObject({
      limit: LIMITE_DURO_DE_FACTURAS,
      skip: LIMITE_DURO_DE_FACTURAS,
    });
  });

  it('pagina invalida o menor a 1: arranca del principio', () => {
    for (const mala of ['0', '-3', 'x', '']) {
      expect(construirConsultaDeFacturas({ page: mala }).skip).toBe(0);
    }
  });

  it('el defecto es MENOR que el techo: quien necesita mas lo pide', () => {
    // La misma leccion que con ordenes: poner los dos en el mismo numero
    // habria truncado un reporte en silencio.
    expect(LIMITE_POR_DEFECTO_DE_FACTURAS).toBeLessThan(
      LIMITE_DURO_DE_FACTURAS,
    );
  });

  it('combina filtros sin pisarse', () => {
    const r = construirConsultaDeFacturas({
      orderId: 'o-1',
      customerId: 'c-2',
      from: '2026-09-01',
      limit: '50',
      page: '2',
    });
    expect(r.query).toMatchObject({
      orderId: { $eq: 'o-1', $type: 'string' },
      customerId: 'c-2',
    });
    expect(r.query.createdAt).toBeDefined();
    expect(r).toMatchObject({ limit: 50, skip: 50 });
  });
});

describe('facturaDeLaOrden', () => {
  // El indice unico es parcial ($type: 'string'): sin repetir la condicion,
  // Mongo no lo usa y recorre todas las facturas (explain en produccion,
  // 27/09/2026: COLLSCAN de 4.897 contra IXSCAN de 1).
  it('repite la condicion del indice parcial', () => {
    expect(facturaDeLaOrden('o-1')).toEqual({
      orderId: { $eq: 'o-1', $type: 'string' },
    });
  });
});
