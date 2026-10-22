import {
  dateRangeFilter,
  firstDateRangeFilter,
} from './date-range-filter.util';

const FROM = '2026-09-01T00:00:00.000Z';
const TO = '2026-09-07T23:59:59.999Z';

describe('dateRangeFilter', () => {
  it('sin rango no filtra: la consulta se queda como estaba', () => {
    expect(dateRangeFilter('createdAt')).toBeUndefined();
    expect(dateRangeFilter('createdAt', FROM)).toBeUndefined();
    expect(dateRangeFilter('createdAt', undefined, TO)).toBeUndefined();
  });

  it('una fecha ilegible se ignora en vez de vaciar el resultado', () => {
    // Un `Invalid Date` en un $gte no da error: devuelve CERO documentos, y la
    // nomina se veria vacia sin que nadie sepa por que.
    expect(dateRangeFilter('createdAt', 'ayer', TO)).toBeUndefined();
    expect(dateRangeFilter('createdAt', FROM, '')).toBeUndefined();
  });

  it('con rango valido acota el campo pedido', () => {
    const filter = dateRangeFilter('period.startDate', FROM, TO);
    expect(filter).toEqual({
      'period.startDate': { $gte: new Date(FROM), $lte: new Date(TO) },
    });
  });

  it('acepta rangos de un solo instante', () => {
    const filter = dateRangeFilter('createdAt', FROM, FROM);
    expect(filter).toEqual({
      createdAt: { $gte: new Date(FROM), $lte: new Date(FROM) },
    });
  });
});

describe('firstDateRangeFilter', () => {
  it('sin rango no filtra', () => {
    expect(firstDateRangeFilter(['fechaPago', 'createdAt'])).toBeUndefined();
  });

  it('un documento entra si CUALQUIERA de sus fechas cae en el rango', () => {
    // El historico de comisiones se ordena por `fechaPago`, pero los pagos
    // viejos no lo tienen y solo llevan `createdAt`. Mirar un solo campo
    // dejaria fuera pagos reales de la semana.
    const filter = firstDateRangeFilter(['fechaPago', 'createdAt'], FROM, TO);
    expect(filter).toEqual({
      $or: [
        { fechaPago: { $gte: new Date(FROM), $lte: new Date(TO) } },
        { createdAt: { $gte: new Date(FROM), $lte: new Date(TO) } },
      ],
    });
  });

  it('con un solo campo se comporta como dateRangeFilter', () => {
    expect(firstDateRangeFilter(['createdAt'], FROM, TO)).toEqual({
      $or: [{ createdAt: { $gte: new Date(FROM), $lte: new Date(TO) } }],
    });
  });

  it('una fecha ilegible tampoco filtra aqui', () => {
    expect(
      firstDateRangeFilter(['fechaPago', 'createdAt'], 'x', TO),
    ).toBeUndefined();
  });
});
