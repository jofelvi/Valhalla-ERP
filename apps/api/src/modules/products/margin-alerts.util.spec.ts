import {
  AlertaMargen,
  clasificarSeveridad,
  ordenarAlertas,
} from './margin-alerts.util';

// La evaluación de margen (evaluarMargen/margenPct/costoPorUnidadVendida) se
// prueba en cost-propagation.util.spec.ts, que es su único dueño. Aquí solo se
// prueba el ORDENAMIENTO por gravedad, que es lo propio de este módulo.

const alerta = (over: Partial<AlertaMargen>): AlertaMargen => ({
  productId: over.productId ?? 'p',
  name: over.name ?? 'Producto',
  price: over.price ?? 10,
  cost: over.cost ?? 5,
  marginPct: over.marginPct ?? 20,
  nivel: over.nivel ?? 'BAJO',
});

describe('clasificarSeveridad', () => {
  it('ordena NEGATIVO < NULO < BAJO', () => {
    expect(clasificarSeveridad('NEGATIVO')).toBeLessThan(
      clasificarSeveridad('NULO'),
    );
    expect(clasificarSeveridad('NULO')).toBeLessThan(
      clasificarSeveridad('BAJO'),
    );
  });
});

describe('ordenarAlertas', () => {
  it('pone lo más grave primero (NEGATIVO antes que NULO antes que BAJO)', () => {
    const entrada = [
      alerta({ productId: 'baja', nivel: 'BAJO', marginPct: 20 }),
      alerta({ productId: 'neg', nivel: 'NEGATIVO', marginPct: -10 }),
      alerta({ productId: 'nula', nivel: 'NULO', marginPct: 0 }),
    ];
    const salida = ordenarAlertas(entrada);
    expect(salida.map((a) => a.productId)).toEqual(['neg', 'nula', 'baja']);
  });

  it('dentro del mismo nivel, el peor margen va primero', () => {
    const entrada = [
      alerta({ productId: 'b25', nivel: 'BAJO', marginPct: 25 }),
      alerta({ productId: 'b10', nivel: 'BAJO', marginPct: 10 }),
      alerta({ productId: 'b18', nivel: 'BAJO', marginPct: 18 }),
    ];
    const salida = ordenarAlertas(entrada);
    expect(salida.map((a) => a.productId)).toEqual(['b10', 'b18', 'b25']);
  });

  it('no muta el arreglo de entrada', () => {
    const entrada = [
      alerta({ productId: 'baja', nivel: 'BAJO' }),
      alerta({ productId: 'neg', nivel: 'NEGATIVO' }),
    ];
    const copia = [...entrada];
    ordenarAlertas(entrada);
    expect(entrada).toEqual(copia);
  });

  it('con arreglo vacío devuelve vacío', () => {
    expect(ordenarAlertas([])).toEqual([]);
  });
});
