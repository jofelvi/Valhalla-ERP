import {
  TARIFAS_POR_DEFECTO,
  PATRON_EXCLUIDOS_POR_DEFECTO,
  clasificarPizza,
  calcularBonoPizzero,
} from './pizza-bonus.helper';

// El bono del pizzero se calculaba SOLO dentro del script del cron
// (scripts/reporte-bono-pizzero.cjs), que arma un texto para correo y SMS. Al
// no existir como servicio, la pantalla de nómina no podía precargarlo y el
// dueño lo copiaba a mano — con el riesgo de pagar un número distinto al que
// se le avisó al pizzero. Esta pieza es la misma cuenta, pura y probada, para
// que el cron y la pantalla no puedan separarse nunca.
describe('clasificarPizza', () => {
  const excl = PATRON_EXCLUIDOS_POR_DEFECTO;

  it('reconoce el tamaño por el nombre', () => {
    // Así se llaman de verdad en el catálogo: "El Rival - Grande".
    expect(clasificarPizza('El Rival - Grande', excl)).toEqual({
      cat: 'grande',
    });
    expect(clasificarPizza('Pizza Mediana Especial', excl)).toEqual({
      cat: 'mediana',
    });
    expect(clasificarPizza('Pizza Pequeña', excl)).toEqual({ cat: 'pequena' });
    // sin tilde: el catálogo tiene las dos formas
    expect(clasificarPizza('Pizza Pequena', excl)).toEqual({ cat: 'pequena' });
  });

  it('un nombre que empieza con "N Pizzas" es COMBO, no N individuales', () => {
    expect(clasificarPizza('2 Pizzas · Contigo', excl)).toEqual({
      cat: 'combo',
      n: 2,
    });
    expect(clasificarPizza('3 Pizzas · Con Nosotros', excl)).toEqual({
      cat: 'combo',
      n: 3,
    });
  });

  // Comportamiento REAL en producción, no un descuido: las promos se llaman
  // "1 Pizza · X" y el patrón de combo se evalúa antes que el de tamaño, así
  // que pagan tarifa de combo ($0,30) en vez de la de su tamaño ($0,20 grande).
  // Se documenta tal cual porque es lo que el pizzero viene cobrando; cambiarlo
  // le cambiaría el sueldo sin que nadie lo pida.
  it('la promo "1 Pizza · X" paga como combo, no por tamaño', () => {
    expect(clasificarPizza('1 Pizza · Especial', excl)).toEqual({
      cat: 'combo',
      n: 1,
    });
    expect(clasificarPizza('1 Pizza · Doble Cheese', excl)).toEqual({
      cat: 'combo',
      n: 1,
    });
  });

  // El combo se cuenta como UNA unidad de combo por cada ítem vendido, no como
  // N pizzas: la tarifa del combo ya contempla que son varias.
  it('excluye lo que no es pizza aunque salga de la estación de pizza', () => {
    for (const nombre of [
      'Extra queso',
      'Focaccia',
      'Cachapa',
      'Panzerotti',
      'Bandeja de Pasapalos',
      'Harina de maíz',
      'Salsa napolitana',
      'Masa cruda',
    ]) {
      expect(clasificarPizza(nombre, excl)).toBeNull();
    }
  });

  it('lo que no encaja en ningún tamaño cae en "otras" y no paga bono', () => {
    expect(clasificarPizza('Pizza del día', excl)).toEqual({ cat: 'otras' });
  });
});

describe('calcularBonoPizzero', () => {
  const productos = [
    { id: 'p-g', name: 'Pizza Grande' },
    { id: 'p-m', name: 'Pizza Mediana' },
    { id: 'p-p', name: 'Pizza Pequeña' },
    { id: 'p-c', name: '2 Pizzas · Contigo' },
    { id: 'p-x', name: 'Extra queso' },
  ];

  it('reproduce la corrida real del 24/08/2026 ($12,15)', () => {
    const ordenes = [
      { items: [{ productId: 'p-g', quantity: 14 }] },
      { items: [{ productId: 'p-m', quantity: 5 }] },
      { items: [{ productId: 'p-p', quantity: 5 }] },
      { items: [{ productId: 'p-c', quantity: 27 }] },
    ];
    const r = calcularBonoPizzero(ordenes, productos, TARIFAS_POR_DEFECTO);

    expect(r.conteo).toEqual({
      grande: 14,
      mediana: 5,
      pequena: 5,
      combo: 27,
      otras: 0,
    });
    expect(r.total).toBe(12.15);
    expect(r.individuales).toBe(24);
    expect(r.ordenes).toBe(4);
  });

  it('no cuenta los ítems cancelados', () => {
    const r = calcularBonoPizzero(
      [
        {
          items: [{ productId: 'p-g', quantity: 10, cancelledAt: new Date() }],
        },
      ],
      productos,
      TARIFAS_POR_DEFECTO,
    );
    expect(r.total).toBe(0);
    expect(r.ordenes).toBe(0);
  });

  // Una orden con solo extras no es una orden con pizza: contarla inflaría el
  // "N órdenes" del reporte y haría creer que se vendió más de lo que se vendió.
  it('una orden sin pizzas no suma al conteo de órdenes', () => {
    const r = calcularBonoPizzero(
      [{ items: [{ productId: 'p-x', quantity: 3 }] }],
      productos,
      TARIFAS_POR_DEFECTO,
    );
    expect(r.ordenes).toBe(0);
    expect(r.total).toBe(0);
  });

  it('respeta tarifas distintas a las de por defecto', () => {
    const r = calcularBonoPizzero(
      [{ items: [{ productId: 'p-g', quantity: 10 }] }],
      productos,
      { grande: 0.5, mediana: 0.15, pequena: 0.1, combo: 0.3 },
    );
    expect(r.total).toBe(5);
  });

  it('sin ventas devuelve cero, no null', () => {
    const r = calcularBonoPizzero([], productos, TARIFAS_POR_DEFECTO);
    expect(r.total).toBe(0);
    expect(r.ordenes).toBe(0);
  });
});
