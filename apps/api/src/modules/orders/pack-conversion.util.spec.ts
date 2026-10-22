import { REGISTRO_PACKS_PRUEBA } from './registro-packs.fixture';
import {
  opcionesDeConversion,
  aplicarConversion,
  type ItemOrden,
} from './pack-conversion.util';

const PILSEN = 'prod-botella-b';
const LATA = 'prod-lata-b';
const TOBO = 'pack-tobo-12';
const TOBO_LATA = 'pack-lata-12';
const MEDIA_CAJA = 'pack-media-18';
const CAJA = 'pack-caja-36';

/** Precios de catalogo reales, leidos de produccion el 20/09/2026. */
const CATALOGO = {
  [TOBO]: 11,
  [TOBO_LATA]: 14,
  [MEDIA_CAJA]: 16,
  [CAJA]: 34,
};

const linea = (extra: Partial<Record<string, unknown>> = {}): ItemOrden => ({
  productId: PILSEN,
  name: 'Cerveza Pilsen Botella',
  quantity: 12,
  deliveredQty: 12,
  sentQty: 12,
  inventoryConsumedQty: 12,
  unitPrice: 1.2,
  total: 14.4,
  ...extra,
});

const sumar = (items: ItemOrden[], productId: string, campo: string): number =>
  items
    .filter((i) => i.productId === productId)
    .reduce((s, i) => s + (Number(i[campo]) || 0), 0);

describe('opcionesDeConversion — lo que el servidor OFRECE', () => {
  it('ofrece el tobo con 12 entregadas, aunque esten en dos lineas por las notas', () => {
    // Las notas por item parten la linea (6 normales + 6 "bien frias"). El
    // sistema tiene que seguir viendo 12 unidades del mismo producto. Lo que se
    // fija aca es que la opcion este DISPONIBLE, no que se aplique: convertir
    // es decision de la persona.
    const opciones = opcionesDeConversion(
      [
        linea({ quantity: 6, deliveredQty: 6, sentQty: 6 }),
        linea({ quantity: 6, deliveredQty: 6, sentQty: 6, notes: 'bien fria' }),
      ],
      CATALOGO,
      REGISTRO_PACKS_PRUEBA,
    );

    const tobos = opciones.filter((o) => o.targetPackId === TOBO);
    expect(tobos).toHaveLength(1);
    expect(tobos[0].currentDeliveredQty).toBe(12);
    expect(tobos[0].numPacksPossible).toBe(1);
  });

  it('una linea partida da el mismo resultado que una sola linea', () => {
    const partida = opcionesDeConversion(
      [
        linea({ quantity: 6, deliveredQty: 6 }),
        linea({ quantity: 6, deliveredQty: 6, notes: 'bien fria' }),
      ],
      CATALOGO,
      REGISTRO_PACKS_PRUEBA,
    );
    const entera = opcionesDeConversion(
      [linea()],
      CATALOGO,
      REGISTRO_PACKS_PRUEBA,
    );

    expect(partida.map((o) => [o.targetPackId, o.numPacksPossible])).toEqual(
      entera.map((o) => [o.targetPackId, o.numPacksPossible]),
    );
  });

  it('lo NO entregado no cuenta', () => {
    const opciones = opcionesDeConversion(
      [
        linea({ quantity: 6, deliveredQty: 6 }),
        linea({ quantity: 6, deliveredQty: 0 }),
      ],
      CATALOGO,
      REGISTRO_PACKS_PRUEBA,
    );

    expect(opciones).toEqual([]);
  });

  it('el precio y el ahorro los pone el catalogo, no el codigo', () => {
    // La regla de la etapa. Si el dueño sube el tobo a $13 en la ficha, la
    // opcion dice $13 sin recompilar nada.
    const [tobo] = opcionesDeConversion(
      [linea()],
      { [TOBO]: 13 },
      REGISTRO_PACKS_PRUEBA,
    );

    expect(tobo.packPrice).toBe(13);
    // 12 unidades a $1.20 = $14.40 contra un tobo de $13
    expect(tobo.savingsUsd).toBe(1.4);
  });

  it('el tobo de lata se ofrece a los $14 de la ficha, no a los $11 cableados', () => {
    // El caso concreto que motivo la etapa: packages/types decia $11 y el
    // catalogo dice $14.
    const [op] = opcionesDeConversion(
      [linea({ productId: LATA, unitPrice: 1.75, deliveredQty: 12 })],
      CATALOGO,
      REGISTRO_PACKS_PRUEBA,
    );

    expect(op.targetPackId).toBe(TOBO_LATA);
    expect(op.packPrice).toBe(14);
    // 12 latas a $1.75 = $21 contra $14
    expect(op.savingsUsd).toBe(7);
  });

  it('un pack sin precio en el catalogo NO se ofrece', () => {
    // Mejor no ofrecer que ofrecer a $0.
    expect(opcionesDeConversion([linea()], {}, REGISTRO_PACKS_PRUEBA)).toEqual(
      [],
    );
    expect(
      opcionesDeConversion([linea()], { [TOBO]: 0 }, REGISTRO_PACKS_PRUEBA),
    ).toEqual([]);
  });

  it('con 36 entregadas ofrece las tres presentaciones y elige la persona', () => {
    const opciones = opcionesDeConversion(
      [linea({ quantity: 36, deliveredQty: 36, sentQty: 36 })],
      CATALOGO,
      REGISTRO_PACKS_PRUEBA,
    );

    expect(opciones.map((o) => o.targetPackId).sort()).toEqual(
      [TOBO, MEDIA_CAJA, CAJA].sort(),
    );
    expect(
      opciones.find((o) => o.targetPackId === TOBO)?.numPacksPossible,
    ).toBe(3);
    expect(
      opciones.find((o) => o.targetPackId === CAJA)?.numPacksPossible,
    ).toBe(1);
  });

  it('las lineas canceladas no cuentan', () => {
    const opciones = opcionesDeConversion(
      [linea({ cancelledAt: new Date() })],
      CATALOGO,
      REGISTRO_PACKS_PRUEBA,
    );

    expect(opciones).toEqual([]);
  });

  it('un producto sin pack no ofrece nada', () => {
    const opciones = opcionesDeConversion(
      [linea({ productId: 'una-hamburguesa' })],
      CATALOGO,
      REGISTRO_PACKS_PRUEBA,
    );

    expect(opciones).toEqual([]);
  });

  it('no toca los items que recibe', () => {
    // Un GET que modifica seria la obligacion que el dueño rechazo.
    const items = [linea()];
    const copia = JSON.stringify(items);

    opcionesDeConversion(items, CATALOGO, REGISTRO_PACKS_PRUEBA);

    expect(JSON.stringify(items)).toBe(copia);
  });
});

describe('aplicarConversion — lo que el servidor HACE cuando se lo piden', () => {
  it('no se lleva por delante lo que el cliente pidio y todavia no recibio', () => {
    // 12 pedidas con 6 entregadas + 6 pedidas con 6 entregadas = 12 entregadas,
    // que es justo un tobo. La version del APK descontaba recorriendo quantity:
    // se comia la primera linea ENTERA y desaparecian 6 unidades que el cliente
    // pidio y va a recibir.
    const items = [
      linea({
        quantity: 12,
        deliveredQty: 6,
        sentQty: 12,
        inventoryConsumedQty: 6,
      }),
      linea({
        quantity: 6,
        deliveredQty: 6,
        sentQty: 6,
        inventoryConsumedQty: 6,
      }),
    ];

    const r = aplicarConversion(
      items,
      { sourceProductId: PILSEN, targetPackId: TOBO, packsToConvert: 1 },
      11,
      REGISTRO_PACKS_PRUEBA,
    );

    expect(sumar(r.items, PILSEN, 'quantity')).toBe(6);
    expect(sumar(r.items, PILSEN, 'deliveredQty')).toBe(0);

    const pack = r.items.find((i) => i.productId === TOBO);
    expect(pack?.quantity).toBe(12);
    expect(pack?.deliveredQty).toBe(12);
    expect(pack?.presentationQty).toBe(12);
  });

  it('el consumo de inventario se CONSERVA, no se inventa', () => {
    // Esto es lo que evita el doble descuento: reservarConsumo hace
    // max(0, quantity - inventoryConsumedQty). Pero inventar consumo tambien
    // hace daño en la otra direccion: si estas 12 nunca se descontaron y el
    // pack dice que si, el respaldo del cobro no las descuenta nunca.
    const sinConsumir = aplicarConversion(
      [linea({ inventoryConsumedQty: 0 })],
      { sourceProductId: PILSEN, targetPackId: TOBO, packsToConvert: 1 },
      11,
      REGISTRO_PACKS_PRUEBA,
    );
    expect(
      sinConsumir.items.find((i) => i.productId === TOBO)?.inventoryConsumedQty,
    ).toBe(0);

    const yaConsumido = aplicarConversion(
      [linea({ inventoryConsumedQty: 12 })],
      { sourceProductId: PILSEN, targetPackId: TOBO, packsToConvert: 1 },
      11,
      REGISTRO_PACKS_PRUEBA,
    );
    expect(
      yaConsumido.items.find((i) => i.productId === TOBO)?.inventoryConsumedQty,
    ).toBe(12);
  });

  it('el precio del pack lo pone el parametro, no una constante', () => {
    const r = aplicarConversion(
      [linea()],
      { sourceProductId: PILSEN, targetPackId: TOBO, packsToConvert: 1 },
      13,
      REGISTRO_PACKS_PRUEBA,
    );

    const pack = r.items.find((i) => i.productId === TOBO);
    expect(pack?.total).toBe(13);
    expect(pack?.unitPrice).toBe(1.08); // 13/12 redondeado
  });

  it('el total del pack sobrevive a normalizePackLines sin cambiar', () => {
    // normalizePackLines corre en cada patch con items y recalcula el total con
    // la MISMA formula. Si aca se redondeara distinto, el siguiente patch
    // cambiaria la cuenta sin que nadie tocara nada.
    const r = aplicarConversion(
      [linea({ quantity: 18, deliveredQty: 18, sentQty: 18 })],
      { sourceProductId: PILSEN, targetPackId: MEDIA_CAJA, packsToConvert: 1 },
      16,
      REGISTRO_PACKS_PRUEBA,
    );

    const pack = r.items.find((i) => i.productId === MEDIA_CAJA)!;
    expect(pack.total).toBe(+(16 * 1).toFixed(2));
    expect(pack.unitPrice).toBe(+(16 / 18).toFixed(2));
  });

  it('convertir 1 de 2 tobos posibles deja las otras 12 sueltas y entregadas', () => {
    const r = aplicarConversion(
      [
        linea({
          quantity: 24,
          deliveredQty: 24,
          sentQty: 24,
          inventoryConsumedQty: 24,
        }),
      ],
      { sourceProductId: PILSEN, targetPackId: TOBO, packsToConvert: 1 },
      11,
      REGISTRO_PACKS_PRUEBA,
    );

    expect(sumar(r.items, PILSEN, 'quantity')).toBe(12);
    expect(sumar(r.items, PILSEN, 'deliveredQty')).toBe(12);
    expect(sumar(r.items, PILSEN, 'inventoryConsumedQty')).toBe(12);
    expect(sumar(r.items, TOBO, 'quantity')).toBe(12);
  });

  it('con 15 entregadas, 12 van al tobo y 3 quedan sueltas', () => {
    // Caso que venia del spec del APK (`mobile/src/services/packConversion.test.ts`),
    // que se borro al mudar el calculo al servidor. Se conserva la cobertura.
    const r = aplicarConversion(
      [
        linea({
          quantity: 15,
          deliveredQty: 15,
          sentQty: 15,
          inventoryConsumedQty: 15,
          total: 18,
        }),
      ],
      { sourceProductId: PILSEN, targetPackId: TOBO, packsToConvert: 1 },
      11,
      REGISTRO_PACKS_PRUEBA,
    );

    const sueltas = r.items.filter((i) => i.productId === PILSEN);
    expect(sumar(sueltas, PILSEN, 'quantity')).toBe(3);
    expect(sumar(sueltas, PILSEN, 'deliveredQty')).toBe(3);
    expect(sueltas[0].total).toBe(3.6); // 3 x $1.20
    expect(r.items.find((i) => i.productId === TOBO)?.quantity).toBe(12);
  });

  it('convertir 2 packs de una vez', () => {
    const r = aplicarConversion(
      [linea({ quantity: 24, deliveredQty: 24, sentQty: 24 })],
      { sourceProductId: PILSEN, targetPackId: TOBO, packsToConvert: 2 },
      11,
      REGISTRO_PACKS_PRUEBA,
    );

    const pack = r.items.find((i) => i.productId === TOBO);
    expect(pack?.quantity).toBe(24);
    expect(pack?.total).toBe(22);
    expect(r.items.filter((i) => i.productId === PILSEN)).toHaveLength(0);
  });

  it('el resto de la orden queda intacto', () => {
    const hamburguesa = {
      productId: 'burger',
      quantity: 2,
      deliveredQty: 2,
      unitPrice: 8.5,
      total: 17,
    };

    const r = aplicarConversion(
      [hamburguesa, linea()],
      { sourceProductId: PILSEN, targetPackId: TOBO, packsToConvert: 1 },
      11,
      REGISTRO_PACKS_PRUEBA,
    );

    expect(r.items[0]).toEqual(hamburguesa);
  });

  it('las lineas canceladas no se tocan ni se usan', () => {
    const cancelada = linea({ cancelledAt: new Date(), deliveredQty: 12 });

    expect(() =>
      aplicarConversion(
        [cancelada],
        { sourceProductId: PILSEN, targetPackId: TOBO, packsToConvert: 1 },
        11,
        REGISTRO_PACKS_PRUEBA,
      ),
    ).toThrow(/entregadas/);
  });

  it('pedir mas packs de los posibles lanza y no deja nada a medias', () => {
    const items = [linea({ quantity: 12, deliveredQty: 6 })];
    const copia = JSON.stringify(items);

    expect(() =>
      aplicarConversion(
        items,
        { sourceProductId: PILSEN, targetPackId: TOBO, packsToConvert: 1 },
        11,
        REGISTRO_PACKS_PRUEBA,
      ),
    ).toThrow(/6 unidades entregadas/);

    expect(JSON.stringify(items)).toBe(copia);
  });

  it('un pack que no corresponde al producto lanza', () => {
    expect(() =>
      aplicarConversion(
        [linea({ quantity: 12, deliveredQty: 12 })],
        { sourceProductId: PILSEN, targetPackId: TOBO_LATA, packsToConvert: 1 },
        14,
        REGISTRO_PACKS_PRUEBA,
      ),
    ).toThrow(/no se puede convertir/);
  });

  it('un pack sin precio lanza en vez de cobrar $0', () => {
    expect(() =>
      aplicarConversion(
        [linea()],
        { sourceProductId: PILSEN, targetPackId: TOBO, packsToConvert: 1 },
        0,
        REGISTRO_PACKS_PRUEBA,
      ),
    ).toThrow(/precio/);
  });

  it('cero o menos packs lanza', () => {
    for (const packsToConvert of [0, -1]) {
      expect(() =>
        aplicarConversion(
          [linea()],
          { sourceProductId: PILSEN, targetPackId: TOBO, packsToConvert },
          11,
          REGISTRO_PACKS_PRUEBA,
        ),
      ).toThrow(/al menos un pack/);
    }
  });

  it('la nota deja rastro de unidades, pack y ahorro', () => {
    const r = aplicarConversion(
      [linea()],
      { sourceProductId: PILSEN, targetPackId: TOBO, packsToConvert: 1 },
      11,
      REGISTRO_PACKS_PRUEBA,
    );

    expect(r.nota).toContain('12 Cerveza Pilsen Botella');
    expect(r.nota).toContain('Tobo de prueba (12 und)');
    expect(r.nota).toContain('$3.40'); // 14.40 - 11
    expect(r.savingsUsd).toBe(3.4);
    expect(r.unidadesConvertidas).toBe(12);
  });

  it('no muta los items de entrada', () => {
    const items = [linea()];
    const copia = JSON.stringify(items);

    aplicarConversion(
      items,
      { sourceProductId: PILSEN, targetPackId: TOBO, packsToConvert: 1 },
      11,
      REGISTRO_PACKS_PRUEBA,
    );

    expect(JSON.stringify(items)).toBe(copia);
  });

  it('lo que ofrecen las opciones se puede aplicar siempre', () => {
    // El contrato entre las dos funciones: si la opcion salio, aplicarla no
    // puede lanzar. Un boton que no hace nada es peor que no tener boton.
    const items = [
      linea({ quantity: 20, deliveredQty: 14, sentQty: 20 }),
      linea({ quantity: 10, deliveredQty: 10, sentQty: 10, notes: 'fria' }),
    ];

    for (const op of opcionesDeConversion(
      items,
      CATALOGO,
      REGISTRO_PACKS_PRUEBA,
    )) {
      expect(() =>
        aplicarConversion(
          items,
          {
            sourceProductId: op.sourceProductId,
            targetPackId: op.targetPackId,
            packsToConvert: op.numPacksPossible,
          },
          op.packPrice,
          REGISTRO_PACKS_PRUEBA,
        ),
      ).not.toThrow();
    }
  });
});
