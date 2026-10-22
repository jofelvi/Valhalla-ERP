/**
 * Candado de packs — bug del 30/07/2026.
 *
 * Un tobo de $11 trae 12 cervezas y se guarda como 12 unidades a $11/12 para
 * que la barra entregue de a una. El APK, al agregar un SEGUNDO tobo a una
 * orden existente, sumaba 1 unidad en vez de 12: la linea quedaba en 13 y se
 * cobraban $11.92 por dos tobos de $22.
 *
 * Lo grave es que la normalizacion server-side que ya existia no lo detectaba:
 * su regla es `total = unitPrice x quantity`, y 13 x 0.9167 da exactamente
 * 11.9171. El numero equivocado "cuadraba".
 *
 * Estas pruebas fijan la regla nueva: para un producto que se vende por pack,
 * la cantidad SIEMPRE es multiplo del pack y el total sale del precio del pack.
 */

import { getPackConfig } from './pack-registry';
import { REGISTRO_PACKS_PRUEBA } from './registro-packs.fixture';
import { REGISTRO_PACKS_PRUEBA } from './registro-packs.fixture';

interface PackInfo {
  size: number;
  price: number;
  name: string;
}

/**
 * Misma logica que OrdersService.normalizePackLines, aislada para poder
 * probarla sin levantar Mongo ni el modulo entero.
 */
function normalizePackLines(
  items: Array<Record<string, unknown>>,
  precios: Map<string, number>,
): Array<Record<string, unknown>> {
  return items.map((it) => {
    const id = String(it.productId ?? '');
    const cfg = getPackConfig(REGISTRO_PACKS_PRUEBA, id);
    const price = precios.get(id) ?? 0;
    const pack = cfg
      ? { size: cfg.totalUnits, price, name: cfg.label }
      : undefined;
    if (!pack || pack.size <= 0 || pack.price <= 0) return it;
    const qty = Number(it.quantity) || 0;
    if (qty <= 0) return it;

    const wholePacks = Math.ceil(qty / pack.size);
    const fixedQty = wholePacks * pack.size;
    const total = +(pack.price * wholePacks).toFixed(4);
    return {
      ...it,
      quantity: fixedQty,
      sentQty:
        Number(it.sentQty) > 0
          ? Math.max(Number(it.sentQty), fixedQty)
          : fixedQty,
      unitPrice: +(pack.price / pack.size).toFixed(4),
      total,
      totalPrice: total,
      presentationQty: pack.size,
    };
  });
}

const TOBO_ID = 'pack-tobo-12';
const CAJA_ID = 'pack-caja-36';
const CERVEZA_ID = 'prod-botella-b';

const TEQUENOS_ID = '7DZlnxK7ivXznBUqO5ju'; // "Tequeños de la Casa x8 UND", $5.50

// Solo precios: que sea pack o no lo decide REGISTRO_PACKS_PRUEBA.packs, igual que el server
const catalogo = new Map<string, number>([
  [TOBO_ID, 11],
  [CAJA_ID, 34],
  [CERVEZA_ID, 1],
  [TEQUENOS_ID, 5.5],
]);

describe('candado de packs', () => {
  it('corrige el caso real: 13 unidades a $11.92 -> 24 unidades a $22', () => {
    // Exactamente como quedo la orden 41C01CD1 de la piscina
    const [linea] = normalizePackLines(
      [
        {
          productId: TOBO_ID,
          quantity: 13,
          unitPrice: 0.9167,
          total: 11.9171,
          sentQty: 13,
        },
      ],
      catalogo,
    );

    expect(linea.quantity).toBe(24);
    expect(linea.total).toBe(22);
    expect(linea.presentationQty).toBe(12);
    // sentQty tambien sube: si no, la web reimprimiria "fantasmas"
    expect(linea.sentQty).toBe(24);
  });

  it('no toca una linea que ya esta bien', () => {
    const [linea] = normalizePackLines(
      [{ productId: TOBO_ID, quantity: 24, unitPrice: 0.9167, total: 22 }],
      catalogo,
    );
    expect(linea.quantity).toBe(24);
    expect(linea.total).toBe(22);
  });

  it('un solo tobo queda en 12 y $11', () => {
    const [linea] = normalizePackLines(
      [{ productId: TOBO_ID, quantity: 12, unitPrice: 0.9167, total: 11 }],
      catalogo,
    );
    expect(linea.quantity).toBe(12);
    expect(linea.total).toBe(11);
  });

  it('el total sale del precio del pack, no de unitario x unidades', () => {
    // 24 x 0.9167 = 22.0008 — ese numero es el que el mesonero cobraria
    const [linea] = normalizePackLines(
      [{ productId: TOBO_ID, quantity: 24, unitPrice: 0.9167, total: 22.0008 }],
      catalogo,
    );
    expect(linea.total).toBe(22);
  });

  it('funciona con cualquier pack, no solo el tobo', () => {
    const [linea] = normalizePackLines(
      [{ productId: CAJA_ID, quantity: 37, unitPrice: 0.9444, total: 34.94 }],
      catalogo,
    );
    expect(linea.quantity).toBe(72); // 2 cajas
    expect(linea.total).toBe(68);
  });

  it('no toca productos que no son pack', () => {
    const [linea] = normalizePackLines(
      [{ productId: CERVEZA_ID, quantity: 5, unitPrice: 1, total: 5 }],
      catalogo,
    );
    expect(linea.quantity).toBe(5);
    expect(linea.total).toBe(5);
    expect(linea.presentationQty).toBeUndefined();
  });

  it('ignora cantidades invalidas en vez de romper el cobro', () => {
    const [linea] = normalizePackLines(
      [{ productId: TOBO_ID, quantity: 0, unitPrice: 0.9167, total: 0 }],
      catalogo,
    );
    expect(linea.quantity).toBe(0);
  });

  // ── El error que casi meto: usar presentationQuantity del catalogo ──
  // Lo tienen 439 productos, casi todos platos normales. "Tequeños x8 UND"
  // trae 8 en ese campo pero se vende como UN plato de $5.50: tratarlo como
  // pack le cambiaria la cantidad de 1 a 8 y romperia comanda y entregas.
  it('NO toca los tequeños x8, que no son un pack expandible', () => {
    const [linea] = normalizePackLines(
      [{ productId: TEQUENOS_ID, quantity: 1, unitPrice: 5.5, total: 5.5 }],
      catalogo,
    );
    expect(linea.quantity).toBe(1);
    expect(linea.total).toBe(5.5);
    expect(linea.presentationQty).toBeUndefined();
  });

  it('el registro tiene solo los 4 packs reales', () => {
    expect(Object.keys(REGISTRO_PACKS_PRUEBA.packs)).toHaveLength(4);
    expect(getPackConfig(REGISTRO_PACKS_PRUEBA, TOBO_ID)?.totalUnits).toBe(12);
    expect(getPackConfig(REGISTRO_PACKS_PRUEBA, CAJA_ID)?.totalUnits).toBe(36);
    expect(getPackConfig(REGISTRO_PACKS_PRUEBA, TEQUENOS_ID)).toBeUndefined();
  });
});
