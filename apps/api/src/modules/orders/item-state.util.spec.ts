import {
  deliveryDeltas,
  inheritItemState,
  ITEM_STATE_FIELDS,
} from './item-state.util';

describe('inheritItemState — preservación de estado por item al reescribir', () => {
  it('incluye inventoryConsumedQty (el fix del doble descuento de packs)', () => {
    expect(ITEM_STATE_FIELDS).toContain('inventoryConsumedQty');
  });

  it('incluye customizations y lo preserva si el cliente lo omite', () => {
    expect(ITEM_STATE_FIELDS).toContain('customizations');
    const previous = [
      {
        productId: 'BURGER',
        quantity: 1,
        customizations: { removedIngredients: ['Cebolla'] },
      },
    ];
    const incoming = [{ productId: 'BURGER', quantity: 1 }];
    const [merged] = inheritItemState(incoming, previous);
    expect(merged.customizations).toEqual({ removedIngredients: ['Cebolla'] });
  });

  it('hereda inventoryConsumedQty cuando el cliente lo omite (no doble descuento)', () => {
    const previous = [
      {
        productId: 'TOBO',
        quantity: 12,
        deliveredQty: 12,
        inventoryConsumedQty: 12,
      },
    ];
    const incoming = [{ productId: 'TOBO', quantity: 12 }]; // reenvía sin el contador
    const [merged] = inheritItemState(incoming, previous);
    expect(merged.inventoryConsumedQty).toBe(12);
    expect(merged.deliveredQty).toBe(12);
  });

  it('entrega parcial: 3 tobos, 2 ya consumidos → preserva el total (24), 1 sin consumir', () => {
    const previous = [
      { productId: 'TOBO', quantity: 12, inventoryConsumedQty: 12 },
      { productId: 'TOBO', quantity: 12, inventoryConsumedQty: 12 },
      { productId: 'TOBO', quantity: 12, inventoryConsumedQty: 0 },
    ];
    const incoming = [
      { productId: 'TOBO', quantity: 12 },
      { productId: 'TOBO', quantity: 12 },
      { productId: 'TOBO', quantity: 12 },
    ];
    const merged = inheritItemState(incoming, previous);
    const consumed = merged
      .map((m) => Number(m.inventoryConsumedQty ?? 0))
      .sort((a, b) => a - b);
    expect(consumed).toEqual([0, 12, 12]);
    expect(consumed.reduce((s, n) => s + n, 0)).toBe(24);
  });

  it('NO pisa un valor que el cliente SÍ envía', () => {
    const [merged] = inheritItemState(
      [{ productId: 'A', inventoryConsumedQty: 8 }],
      [{ productId: 'A', inventoryConsumedQty: 5 }],
    );
    expect(merged.inventoryConsumedQty).toBe(8);
  });

  it('item nuevo (sin previo del mismo producto) queda intacto', () => {
    const [merged] = inheritItemState(
      [{ productId: 'NEW', quantity: 1 }],
      [{ productId: 'OTHER', inventoryConsumedQty: 3 }],
    );
    expect(merged.inventoryConsumedQty).toBeUndefined();
  });

  it('sin items previos, devuelve el entrante tal cual', () => {
    const incoming = [{ productId: 'X', quantity: 1 }];
    expect(inheritItemState(incoming, [])).toBe(incoming);
    expect(inheritItemState(incoming, undefined)).toBe(incoming);
  });

  it('también hereda deliveredQty/sentQty/printedQty (regresión previa)', () => {
    const [merged] = inheritItemState(
      [{ productId: 'A', quantity: 5 }],
      [{ productId: 'A', sentQty: 5, printedQty: 5, deliveredQty: 3 }],
    );
    expect(merged.sentQty).toBe(5);
    expect(merged.printedQty).toBe(5);
    expect(merged.deliveredQty).toBe(3);
  });
});

describe('inheritItemState — descuento por producto (PIN admin)', () => {
  it('el descuento sobrevive a un PATCH que reescribe los items', () => {
    // El APK reenvia el array completo sin los campos de descuento: si no se
    // heredan, el descuento autorizado con PIN desaparece y el cliente termina
    // pagando el precio pleno sin que nadie lo note.
    const previous = [
      {
        productId: 'PIZZA',
        quantity: 1,
        total: 20,
        discountType: 'PCT',
        discountValue: 25,
        discountAmount: 5,
        discountReason: 'demora de 40 min',
        discountBy: 'admin-1',
        discountPinValidatedByUserId: 'admin-1',
      },
    ];
    const incoming = [{ productId: 'PIZZA', quantity: 1, total: 20 }];
    const [merged] = inheritItemState(incoming, previous);
    expect(merged.discountAmount).toBe(5);
    expect(merged.discountType).toBe('PCT');
    expect(merged.discountValue).toBe(25);
    expect(merged.discountReason).toBe('demora de 40 min');
    expect(merged.discountPinValidatedByUserId).toBe('admin-1');
  });

  it('el responsable de la cortesia sobrevive al PATCH', () => {
    const previous = [
      {
        productId: 'PASTA',
        quantity: 1,
        noCharge: true,
        noChargeResponsible: 'COCINA',
      },
    ];
    const [merged] = inheritItemState(
      [{ productId: 'PASTA', quantity: 1 }],
      previous,
    );
    expect(merged.noChargeResponsible).toBe('COCINA');
  });
});

describe('deliveryDeltas', () => {
  const it_ = (
    productId: string,
    deliveredQty?: number,
    extra: Record<string, unknown> = {},
  ) => ({ productId, deliveredQty, ...extra });

  it('devuelve el delta de ESTA peticion, no el acumulado', () => {
    // Orden vieja con 5 entregadas que nunca se descontaron: al editarla solo
    // debe consumir la 1 que se entrega ahora, no las 6.
    const moves = deliveryDeltas([it_('cerveza', 5)], [it_('cerveza', 6)]);
    expect(moves).toEqual([{ item: it_('cerveza', 6), delta: 1 }]);
  });

  it('ignora los items donde la entrega no cambio', () => {
    expect(deliveryDeltas([it_('a', 2)], [it_('a', 2)])).toEqual([]);
  });

  it('un item nuevo entregado parte de cero', () => {
    const moves = deliveryDeltas([], [it_('nuevo', 3)]);
    expect(moves).toEqual([{ item: it_('nuevo', 3), delta: 3 }]);
  });

  it('una devolucion da delta negativo', () => {
    const moves = deliveryDeltas([it_('a', 4)], [it_('a', 1)]);
    expect(moves[0].delta).toBe(-3);
  });

  it('no mueve nada cuando el cliente omite deliveredQty y no hay previo', () => {
    expect(deliveryDeltas([], [it_('a', undefined)])).toEqual([]);
  });

  it('empareja duplicados en orden, como inheritItemState', () => {
    // Dos lineas del mismo producto: la primera ya entregada, la segunda no.
    const moves = deliveryDeltas(
      [it_('p', 1), it_('p', 0)],
      [it_('p', 1), it_('p', 1)],
    );
    expect(moves).toEqual([{ item: it_('p', 1), delta: 1 }]);
  });

  it('trata deliveredQty ausente en el previo como cero', () => {
    const moves = deliveryDeltas([it_('a', undefined)], [it_('a', 2)]);
    expect(moves[0].delta).toBe(2);
  });

  it('sin items previos consume lo entregado en la creacion+edicion', () => {
    const moves = deliveryDeltas(null, [it_('a', 2), it_('b', 0)]);
    expect(moves).toEqual([{ item: it_('a', 2), delta: 2 }]);
  });
});
