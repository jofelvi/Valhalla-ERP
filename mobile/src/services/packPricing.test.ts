import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  registrarPackSizes,
  expandPack,
  formatPackQuantity,
  isPackProduct,
  lineTotal,
  packSizeOf,
  packsOf,
  packUnitPrice,
  printQty,
  stepOf,
} from './packPricing.ts';

/**
 * Pruebas del precio de packs — bug del 30/07/2026.
 *
 * Corren con el runner de Node, sin jest ni babel:
 *
 *     npm run test
 *
 * Se eligio asi a proposito: jest-expo arrastra decenas de dependencias y este
 * modulo es logica pura sin React Native. Cero excusas para no tener pruebas de
 * la aritmetica del dinero, que es exactamente lo que fallo.
 */

const TOBO = 11;
const PACK = 12;
/** Como lo guarda la base: 4 decimales. Es el valor que lee el merge. */
const UNIT_GUARDADO = 0.9167;

describe('expandPack', () => {
  test('un tobo son 12 unidades y cuesta $11', () => {
    const l = expandPack(TOBO, 1, PACK);
    assert.equal(l.quantity, 12);
    assert.equal(l.total, 11);
    assert.equal(l.presentationQty, 12);
  });

  test('dos tobos son 24 unidades y $22', () => {
    const l = expandPack(TOBO, 2, PACK);
    assert.equal(l.quantity, 24);
    assert.equal(l.total, 22);
  });

  test('caja grande: 36 unidades por $34', () => {
    const l = expandPack(34, 1, 36);
    assert.equal(l.quantity, 36);
    assert.equal(l.total, 34);
  });

  test('un producto normal no se expande ni se marca', () => {
    const l = expandPack(1, 5);
    assert.equal(l.quantity, 5);
    assert.equal(l.unitPrice, 1);
    assert.equal(l.total, 5);
    assert.equal(l.presentationQty, undefined);
  });
});

describe('lineTotal', () => {
  test('EL BUG: agregar un segundo tobo debe sumar $11, no $0.92', () => {
    // Estado tras crear la orden con un tobo
    const existente = expandPack(TOBO, 1, PACK);
    // El mesonero agrega OTRO tobo desde el APK
    const nuevo = expandPack(TOBO, 1, PACK);
    const newQty = existente.quantity + nuevo.quantity;

    assert.equal(newQty, 24, 'deben quedar 24 cervezas, no 13');
    assert.equal(
      lineTotal(existente.unitPrice, newQty, existente.presentationQty),
      22,
      'deben ser $22, no $11.92',
    );
  });

  test('lo que hacia el codigo viejo, para que no vuelva', () => {
    // No expandia: sumaba 1 unidad en vez de 12
    const viejoQty = 12 + 1;
    const viejoTotal = Math.round(UNIT_GUARDADO * viejoQty * 100) / 100;
    assert.equal(viejoQty, 13);
    assert.equal(viejoTotal, 11.92); // dos tobos de $22 cobrados en $11.92
  });

  test('el unitario guardado arrastra decimales y el helper los corrige', () => {
    // 0.9167 x 24 = 22.0008 — ese numero es el que el mesonero cobraria
    assert.notEqual(UNIT_GUARDADO * 24, 22);
    assert.equal(lineTotal(UNIT_GUARDADO, 24, PACK), 22);
    assert.equal(lineTotal(UNIT_GUARDADO, 12, PACK), 11);
  });

  test('un producto normal NO se redondea a centavos', () => {
    // A proposito: el servidor persiste con 4 decimales (normalizeItemsMoney
    // hace toFixed(4)) y hay precios con fracciones. Redondear aca a 2 cambiaria
    // subtotales existentes. El redondeo solo aplica a packs, donde el unitario
    // es una division periodica.
    const raw = lineTotal(0.333, 3);
    assert.ok(Math.abs(raw - 0.999) < 1e-9);
    assert.notEqual(raw, Math.round(raw * 100) / 100);
  });
});

describe('packsOf', () => {
  test('traduce unidades a packs para mostrarlas', () => {
    assert.equal(packsOf(24, PACK), 2);
    assert.equal(packsOf(12, PACK), 1);
    assert.equal(packsOf(5), 5); // sin pack, son unidades sueltas
  });
});

// ─── Lo que el mesonero LEE en la pantalla ────────────────────────────────
// Segundo bug del 30/07: la plata estaba bien guardada ($11) pero el detalle
// del pedido mostraba "12 Tobo de Cerveza". El mesonero cobra lo que ve.

// IDs ficticios: el registro real lo define cada negocio.
const TOBO_ID = 'tobo-12'; // Tobo de Cerveza (12 und)
const CAJA_ID = 'caja-36'; // Caja de Cerveza Grande (36)
const CERVEZA_ID = 'cerveza-suelta'; // Cerveza suelta
const TEQUENOS_ID = 'tequenos-8'; // Tequeños x8 — NO es pack

registrarPackSizes({ [TOBO_ID]: 12, [CAJA_ID]: 36 });

describe('packSizeOf / isPackProduct', () => {
  test('reconoce los packs por el registro', () => {
    assert.equal(packSizeOf(TOBO_ID), 12);
    assert.equal(packSizeOf(CAJA_ID), 36);
    assert.equal(isPackProduct(TOBO_ID), true);
  });

  test('NO trata como pack a los tequeños x8 ni a una cerveza suelta', () => {
    assert.equal(packSizeOf(TEQUENOS_ID), 0);
    assert.equal(isPackProduct(TEQUENOS_ID), false);
    assert.equal(isPackProduct(CERVEZA_ID), false);
  });

  test('el marcador guardado en la orden manda sobre el registro', () => {
    assert.equal(packSizeOf('producto-desconocido', 6), 6);
  });
});

describe('formatPackQuantity — EL BUG DE LA PANTALLA', () => {
  test('12 unidades de tobo son 1 tobo, no 12', () => {
    // Se veia "12 Tobo de Cerveza (12 und)": 144 cervezas
    assert.equal(formatPackQuantity(12, TOBO_ID), '1 (12 cervezas)');
  });

  test('dos tobos y una caja', () => {
    assert.equal(formatPackQuantity(24, TOBO_ID), '2 (24 cervezas)');
    assert.equal(formatPackQuantity(36, CAJA_ID), '1 (36 cervezas)');
  });

  test('un producto normal se muestra tal cual', () => {
    assert.equal(formatPackQuantity(9, CERVEZA_ID), '9');
    assert.equal(formatPackQuantity(1, TEQUENOS_ID), '1');
  });

  test('una linea rota avisa en vez de disimularse', () => {
    const txt = formatPackQuantity(13, TOBO_ID);
    assert.ok(txt.includes('13'));
    assert.ok(txt.includes('revisar'));
  });
});

describe('printQty / packUnitPrice — comandas y recibos', () => {
  test('EL BUG: la comanda de barra pedia 12 tobos', () => {
    assert.equal(printQty(12, TOBO_ID), 1);
    assert.equal(printQty(24, TOBO_ID), 2);
    assert.equal(printQty(36, CAJA_ID), 1);
  });

  test('un producto normal se imprime tal cual', () => {
    assert.equal(printQty(3, CERVEZA_ID), 3);
    assert.equal(printQty(1, TEQUENOS_ID), 1);
  });

  test('el recibo muestra el precio del tobo, no el de la cerveza', () => {
    assert.equal(packUnitPrice(11 / 12, TOBO_ID), 11);
    assert.equal(packUnitPrice(2.5, CERVEZA_ID), 2.5);
  });
});

describe('stepOf — el boton +/-', () => {
  test('tocar + en un tobo mueve 12 unidades, no 1', () => {
    assert.equal(stepOf(TOBO_ID), 12);
    assert.equal(stepOf(CAJA_ID), 36);
  });

  test('un producto normal se mueve de a 1', () => {
    assert.equal(stepOf(CERVEZA_ID), 1);
    assert.equal(stepOf(TEQUENOS_ID), 1);
  });
});
