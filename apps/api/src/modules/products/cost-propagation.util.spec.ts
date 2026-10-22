import {
  ProductoCosteable,
  calcularPropagacion,
  evaluarMargen,
  OmitidoDeCosto,
  CambioDeCosto,
  esCambioSospechoso,
  margenPct,
} from './cost-propagation.util';

const prod = (
  _id: string,
  name: string,
  extra: Partial<ProductoCosteable> = {},
): ProductoCosteable => ({
  _id,
  name,
  presentation: 'Unidad',
  presentationQuantity: 1,
  cost: 0,
  ...extra,
});

const catalogo = (...ps: ProductoCosteable[]) =>
  new Map(ps.map((p) => [String(p._id), p]));

describe('calcularPropagacion', () => {
  it('sube el costo del plato cuando sube el insumo', () => {
    // Carne a $12/kg: la hamburguesa lleva 150 gr = $1,80
    const carne = prod('carne', 'Carne de Res Molida', {
      presentation: 'Kilogramo',
      presentationQuantity: 1,
      cost: 12,
    });
    const hamburguesa = prod('ham', 'Hamburguesa', {
      cost: 1,
      price: 6,
      ingredients: [{ productId: 'carne', quantity: 150, unit: 'gr' }],
    });

    const cambios = calcularPropagacion(
      ['carne'],
      catalogo(carne, hamburguesa),
    );

    expect(cambios).toHaveLength(1);
    expect(cambios[0].productId).toBe('ham');
    expect(cambios[0].costoAnterior).toBe(1);
    expect(cambios[0].costoNuevo).toBeCloseTo(1.8, 4);
  });

  it('encadena por el semielaborado: harina → masa → pizza', () => {
    // La expansión del CONSUMO es de un solo nivel, pero el COSTO sí encadena:
    // si no, subir la harina dejaba la pizza con el costo viejo para siempre.
    const harina = prod('harina', 'Harina de Trigo', {
      presentation: 'Kilogramo',
      presentationQuantity: 1,
      cost: 2,
    });
    const masa = prod('masa', 'Masa de Pizza', {
      presentation: 'Gramo',
      presentationQuantity: 1,
      cost: 0,
      ingredients: [{ productId: 'harina', quantity: 1000, unit: 'gr' }],
    });
    const pizza = prod('pizza', 'Pizza Margarita', {
      cost: 0,
      price: 12,
      ingredients: [{ productId: 'masa', quantity: 400, unit: 'gr' }],
    });

    const cambios = calcularPropagacion(
      ['harina'],
      catalogo(harina, masa, pizza),
    );
    const ids = cambios.map((c) => c.productId);

    expect(ids).toContain('masa');
    expect(ids).toContain('pizza');
  });

  it('no toca productos que no llevan el insumo', () => {
    const carne = prod('carne', 'Carne', { cost: 12 });
    const refresco = prod('refresco', 'Coca Cola', { cost: 1, price: 2 });
    expect(calcularPropagacion(['carne'], catalogo(carne, refresco))).toEqual(
      [],
    );
  });

  it('no devuelve cambios si el costo queda igual', () => {
    const queso = prod('queso', 'Queso', {
      presentation: 'Kilogramo',
      presentationQuantity: 1,
      cost: 10,
    });
    const plato = prod('plato', 'Plato', {
      cost: 1,
      ingredients: [{ productId: 'queso', quantity: 100, unit: 'gr' }],
    });
    expect(calcularPropagacion(['queso'], catalogo(queso, plato))).toEqual([]);
  });

  it('deja el costo intacto si la receta no se puede costear', () => {
    // Unidad incompatible: no se inventa un costo de 0, que fingiría un margen
    // perfecto justo en el producto que hay que arreglar.
    const carne = prod('carne', 'Carne', {
      presentation: 'Kilogramo',
      presentationQuantity: 1,
      cost: 12,
    });
    const combo = prod('combo', 'Combo de Hamburguesas', {
      cost: 5,
      price: 17.5,
      ingredients: [{ productId: 'carne', quantity: 1, unit: 'und' }],
    });
    expect(calcularPropagacion(['carne'], catalogo(carne, combo))).toEqual([]);
  });

  it('no se cuelga con una receta circular', () => {
    const a = prod('a', 'A', {
      cost: 1,
      ingredients: [{ productId: 'b', quantity: 1, unit: 'und' }],
    });
    const b = prod('b', 'B', {
      cost: 1,
      ingredients: [{ productId: 'a', quantity: 1, unit: 'und' }],
    });
    expect(() => calcularPropagacion(['a'], catalogo(a, b))).not.toThrow();
  });
});

describe('margen y alertas', () => {
  it('calcula el margen sobre el precio', () => {
    expect(margenPct(10, 4)).toBeCloseTo(60);
  });

  it('marca NEGATIVO cuando el costo supera al precio', () => {
    // Caso real: "Servicio de Descorche de RON", costo $11,55 y precio $8,50.
    const a = evaluarMargen(
      { _id: 'x', name: 'Descorche RON', price: 8.5, cost: 11.55 },
      30,
    );
    expect(a?.nivel).toBe('NEGATIVO');
    expect(a?.marginPct).toBeLessThan(0);
  });

  it('marca NULO cuando se vende al costo', () => {
    expect(
      evaluarMargen({ _id: 'x', name: 'X', price: 10, cost: 10 }, 30)?.nivel,
    ).toBe('NULO');
  });

  it('marca BAJO por debajo del umbral del negocio', () => {
    // "tobo lata azul": $11,24 de costo sobre $14 = 19,7 %.
    expect(
      evaluarMargen(
        { _id: 'x', name: 'tobo lata azul', price: 14, cost: 11.24 },
        30,
      )?.nivel,
    ).toBe('BAJO');
  });

  it('no alerta si el margen supera el umbral', () => {
    expect(
      evaluarMargen({ _id: 'x', name: 'X', price: 10, cost: 3 }, 30),
    ).toBeNull();
  });

  it('respeta un umbral distinto sin tocar código', () => {
    const p = { _id: 'x', name: 'X', price: 10, cost: 6 }; // 40 %
    expect(evaluarMargen(p, 30)).toBeNull();
    expect(evaluarMargen(p, 50)?.nivel).toBe('BAJO');
  });

  it('un producto sin costo cargado no genera alerta', () => {
    // No se sabe su margen; gritar por eso taparía las alertas de verdad.
    expect(
      evaluarMargen({ _id: 'x', name: 'X', price: 10, cost: 0 }, 30),
    ).toBeNull();
  });

  it('un producto sin precio (insumo puro) no genera alerta', () => {
    expect(
      evaluarMargen({ _id: 'x', name: 'Ketchup', price: 0, cost: 21 }, 30),
    ).toBeNull();
  });

  it('un insumo comprado a granel se mide por unidad de venta', () => {
    // HARINA DE TRIGO: el saco de 45 kg cuesta $42,44 y el kilo se vende a
    // $0,95. Comparar el precio del kilo contra el precio del SACO daba
    // -4367 % de margen; el real es ~1 % (visto el 04/09 en la tabla).
    const a = evaluarMargen(
      {
        _id: 'harina',
        name: 'HARINA DE TRIGO',
        price: 0.95,
        cost: 42.44,
        presentationQuantity: 45,
      },
      30,
    );
    expect(a?.nivel).toBe('BAJO');
    expect(a?.marginPct).toBeCloseTo(0.7, 0);
  });

  it('un preparado NO se divide por presentationQuantity', () => {
    // "Tequeños de la Casa x8 UND" trae presentationQuantity 8 pero se vende
    // como UN plato: dividir ahí sería el error contrario.
    const a = evaluarMargen(
      {
        _id: 'teq',
        name: 'Tequeños de la Casa x8 UND',
        price: 6,
        cost: 5,
        presentationQuantity: 8,
        ingredients: [{ productId: 'harina' }],
      },
      30,
    );
    expect(a?.nivel).toBe('BAJO');
    expect(a?.marginPct).toBeCloseTo(16.7, 0);
  });
});

describe('calcularPropagacion — conversión y plan de recálculo', () => {
  const leche = prod('leche', 'Leche en polvo', {
    presentation: 'Gramo',
    presentationQuantity: 900,
    cost: 15.59,
    gramsPerMl: 0.12,
  });
  const harina = prod('harina', 'Harina', {
    presentation: 'Kilogramo',
    presentationQuantity: 1,
    cost: 1,
  });

  it('un plato con leche pedida en ml se costea (antes se saltaba entero)', () => {
    const plato = prod('p', 'Plato', {
      cost: 0.5,
      ingredients: [
        { productId: 'harina', quantity: 100, unit: 'gr' },
        { productId: 'leche', quantity: 100, unit: 'ml' },
      ],
    });
    const cambios = calcularPropagacion(
      ['harina', 'leche'],
      catalogo(harina, leche, plato),
    );
    // 100 g × 0.001 = 0.10 ; 12 g × 15.59/900 = 0.2079
    expect(cambios[0].costoNuevo).toBeCloseTo(0.3079, 3);
  });

  it('los platos que no se pueden costear se reportan con su motivo, no en silencio', () => {
    const sinDensidad = { ...leche, gramsPerMl: null };
    const plato = prod('p', 'Plato', {
      cost: 0.5,
      ingredients: [{ productId: 'leche', quantity: 100, unit: 'ml' }],
    });
    const omitidos: OmitidoDeCosto[] = [];
    const cambios = calcularPropagacion(
      ['leche'],
      catalogo(sinDensidad, plato),
      5,
      { omitidos },
    );
    expect(cambios).toEqual([]);
    expect(omitidos).toHaveLength(1);
    expect(omitidos[0]).toMatchObject({ productId: 'p', name: 'Plato' });
    expect(omitidos[0].issues[0]).toMatchObject({
      kind: 'unidad-incompatible',
      falta: 'gramsPerMl',
    });
  });

  describe('cambios sospechosos', () => {
    const plato = (costo: number) =>
      prod('p', 'Plato', {
        cost: costo,
        ingredients: [{ productId: 'harina', quantity: 1000, unit: 'gr' }],
      });
    // costo nuevo del plato = 1000 g de harina a $1/kg = $1

    it('esCambioSospechoso: baja de más del 40 % o sube más de 3 veces', () => {
      expect(esCambioSospechoso(10, 5.9)).toBe('baja-fuerte');
      expect(esCambioSospechoso(10, 6.1)).toBeNull();
      expect(esCambioSospechoso(1, 3.1)).toBe('sube-fuerte');
      expect(esCambioSospechoso(1, 2.9)).toBeNull();
      expect(esCambioSospechoso(0, 5)).toBeNull(); // primer costeo
    });

    it('sin guardia, aplica todo (comportamiento de siempre)', () => {
      const cambios = calcularPropagacion(
        ['harina'],
        catalogo(harina, plato(10)),
      );
      expect(cambios).toHaveLength(1);
      expect(cambios[0].sospechoso).toBe('baja-fuerte');
    });

    it('con guardia, retiene el sospechoso y deja su costo como estaba', () => {
      const p = plato(10);
      const retenidos: CambioDeCosto[] = [];
      const cambios = calcularPropagacion(['harina'], catalogo(harina, p), 5, {
        retenerSospechosos: true,
        retenidos,
      });
      expect(cambios).toEqual([]);
      expect(retenidos).toHaveLength(1);
      expect(retenidos[0]).toMatchObject({
        productId: 'p',
        costoAnterior: 10,
        costoNuevo: 1,
        sospechoso: 'baja-fuerte',
      });
      expect(p.cost).toBe(10); // el catálogo en memoria no se tocó
    });

    it('un retenido NO arrastra a los platos de arriba con su costo dudoso', () => {
      const masa = prod('masa', 'Masa', {
        presentation: 'Gramo',
        presentationQuantity: 1,
        cost: 10,
        ingredients: [{ productId: 'harina', quantity: 1000, unit: 'gr' }],
      });
      const pizza = prod('pizza', 'Pizza', {
        cost: 10,
        ingredients: [{ productId: 'masa', quantity: 1, unit: 'gr' }],
      });
      const retenidos: CambioDeCosto[] = [];
      const cambios = calcularPropagacion(
        ['harina'],
        catalogo(harina, masa, pizza),
        5,
        { retenerSospechosos: true, retenidos },
      );
      expect(retenidos.map((r) => r.productId)).toEqual(['masa']);
      expect(cambios).toEqual([]);
    });
  });
});
