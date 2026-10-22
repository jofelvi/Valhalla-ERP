import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  addOneToLine,
  registrarPacks,
  formatPackQuantity,
  isPackProduct,
  lineTotal,
  newLine,
  type PackLine,
  packCountLabel,
  packSizeOf,
  packUnitPrice,
  packsOf,
  printQty,
  stepOf,
} from './packs.ts';

/**
 * Pruebas de packs en el POS web.
 *
 *     npm run test:unit
 *
 * Nacen de dos bugs reales seguidos, el mismo dia:
 *   1. El APK cobro $11.92 por dos tobos de $22 (no expandia al agregar).
 *   2. El POS web mostro "12 Tobo de Cerveza" cuando era UN tobo de 12
 *      cervezas — y el mesonero cobra lo que ve en pantalla.
 */

// IDs ficticios: el registro real lo define cada negocio.
const TOBO = 'tobo-12'; // Tobo de Cerveza (12 und), $11
const CAJA = 'caja-36'; // Caja de Cerveza Grande (36), $34
const CERVEZA = 'cerveza-suelta'; // Cerveza suelta, $1
const TEQUENOS = 'tequenos-8'; // Tequeños x8 UND — NO es pack

registrarPacks({
  [TOBO]: { totalUnits: 12, unitLabel: 'cervezas' },
  [CAJA]: { totalUnits: 36, unitLabel: 'cervezas' },
});

describe('deteccion de packs', () => {
  test('reconoce los 4 packs reales', () => {
    assert.equal(isPackProduct(TOBO), true);
    assert.equal(isPackProduct(CAJA), true);
    assert.equal(packSizeOf(TOBO), 12);
    assert.equal(packSizeOf(CAJA), 36);
  });

  // 439 productos tienen presentationQuantity y casi todos son platos normales
  test('NO trata como pack a los tequeños x8 ni a una cerveza suelta', () => {
    assert.equal(isPackProduct(TEQUENOS), false);
    assert.equal(isPackProduct(CERVEZA), false);
    assert.equal(packSizeOf(TEQUENOS), 0);
  });

  test('respeta el marcador guardado en la orden por encima del registro', () => {
    assert.equal(packSizeOf('producto-desconocido', 6), 6);
  });
});

describe('formatPackQuantity — lo que ve el mesonero', () => {
  test('EL BUG: 12 unidades de tobo son 1 tobo, no 12', () => {
    // Asi se veia: "12 Tobo de Cerveza (12 und)" = 144 cervezas
    assert.equal(formatPackQuantity(12, TOBO), '1 (12 cervezas)');
  });

  test('dos tobos', () => {
    assert.equal(formatPackQuantity(24, TOBO), '2 (24 cervezas)');
  });

  test('caja grande', () => {
    assert.equal(formatPackQuantity(36, CAJA), '1 (36 cervezas)');
  });

  test('un producto normal se muestra tal cual', () => {
    assert.equal(formatPackQuantity(9, CERVEZA), '9');
    assert.equal(formatPackQuantity(1, TEQUENOS), '1');
  });

  test('una cantidad rota se muestra visible, no disimulada', () => {
    // Las 13 unidades del bug del 30/07: mejor que se vea a que se redondee
    const txt = formatPackQuantity(13, TOBO);
    assert.ok(txt.includes('13'));
    assert.ok(txt.includes('revisar'));
  });
});

describe('stepOf — el boton +/-', () => {
  test('EL BUG: tocar + en un tobo debe sumar 12 unidades, no 1', () => {
    assert.equal(stepOf(TOBO), 12);
    assert.equal(stepOf(CAJA), 36);
  });

  test('en un producto normal suma de a 1', () => {
    assert.equal(stepOf(CERVEZA), 1);
    assert.equal(stepOf(TEQUENOS), 1);
  });
});

describe('printQty — lo que la estacion despacha', () => {
  test('EL BUG: la comanda pedia 12 tobos', () => {
    // "12x Tobo de Cerveza (12 und)" = 144 cervezas para una mesa
    assert.equal(printQty(12, TOBO), 1);
    assert.equal(printQty(24, TOBO), 2);
    assert.equal(printQty(36, CAJA), 1);
  });

  test('un producto normal se imprime tal cual', () => {
    assert.equal(printQty(3, CERVEZA), 3);
    assert.equal(printQty(1, TEQUENOS), 1);
  });

  test('un envio parcial cuenta los packs que faltan', () => {
    // 24 unidades con 12 ya enviadas: falta 1 tobo
    assert.equal(printQty(24 - 12, TOBO), 1);
  });

  test('una linea rota igual sale despachable', () => {
    const q = printQty(13, TOBO);
    assert.ok(Number.isInteger(q) && q >= 1);
  });
});

describe('lineTotal', () => {
  test('dos tobos son $22 exactos, no $22.0008', () => {
    // 0.9167 es como se guarda el unitario en la base
    assert.notEqual(0.9167 * 24, 22);
    assert.equal(lineTotal(0.9167, 24, TOBO), 22);
    assert.equal(lineTotal(0.9167, 12, TOBO), 11);
  });

  test('un producto normal no se redondea', () => {
    assert.equal(lineTotal(1.5, 9, CERVEZA), 13.5);
  });
});

describe('packsOf', () => {
  test('traduce unidades a packs', () => {
    assert.equal(packsOf(12, TOBO), 1);
    assert.equal(packsOf(24, TOBO), 2);
    assert.equal(packsOf(9, CERVEZA), 9);
  });
});

describe('packCountLabel — el contador entre los botones +/-', () => {
  test('muestra los packs, no las unidades', () => {
    assert.equal(packCountLabel(12, TOBO), '1');
    assert.equal(packCountLabel(24, TOBO), '2');
    assert.equal(packCountLabel(3, CERVEZA), '3');
  });

  test('una linea rota se marca para que no pase por buena', () => {
    assert.equal(packCountLabel(13, TOBO), '13u');
  });
});

describe('packUnitPrice — el precio que se lee al lado del nombre', () => {
  test('un tobo cuesta $11, no los $0.92 de la cerveza suelta', () => {
    assert.equal(packUnitPrice(11 / 12, TOBO), 11);
    assert.equal(packUnitPrice(34 / 36, CAJA), 34);
  });

  test('un producto normal no se toca', () => {
    assert.equal(packUnitPrice(2.5, CERVEZA), 2.5);
  });
});

describe('newLine — agregar el producto por primera vez', () => {
  test('un tobo de $11 entra como 12 unidades que suman $11', () => {
    const line = newLine(TOBO, 11);
    assert.equal(line.quantity, 12);
    assert.equal(line.total, 11);
    assert.equal(line.presentationQty, 12);
    // La barra descuenta de a una cerveza, por eso se guarda el unitario
    assert.ok(Math.abs(line.unitPrice - 11 / 12) < 0.0001);
  });

  test('un producto normal entra tal cual', () => {
    const line = newLine(CERVEZA, 1.5);
    assert.equal(line.quantity, 1);
    assert.equal(line.unitPrice, 1.5);
    assert.equal(line.total, 1.5);
    assert.equal(line.presentationQty, undefined);
  });

  test('los tequeños x8 NO se expanden', () => {
    assert.equal(newLine(TEQUENOS, 6).quantity, 1);
  });
});

describe('addOneToLine — EL BUG DE LA PLATA', () => {
  test('sobre una linea del APK: 2 tobos son $22, no $11.92', () => {
    // Asi la guarda el APK: 12 unidades a 11/12
    const delApk = { quantity: 12, unitPrice: 11 / 12, presentationQty: 12 };
    const result = addOneToLine(delApk, TOBO, 11);

    assert.equal(result.quantity, 24);
    assert.equal(result.total, 22);
    // Lo que cobraba antes de arreglarlo
    assert.notEqual(result.total, 11.92);
  });

  test('sobre una linea vieja del POS web: 2 tobos son $22, no $143', () => {
    // El POS web las guardaba SIN expandir: 1 unidad al precio del pack
    const vieja = { quantity: 1, unitPrice: 11 };
    const result = addOneToLine(vieja, TOBO, 11);

    assert.equal(result.quantity, 24);
    assert.equal(result.total, 22);
    assert.notEqual(result.total, 143); // 13 x $11
    // Ademas queda migrada al formato expandido
    assert.equal(result.presentationQty, 12);
  });

  test('sin presentationQty guardado igual reconoce el pack por el registro', () => {
    // El merge del APK borraba el marcador; el registro es el respaldo
    const sinMarcador = { quantity: 12, unitPrice: 11 / 12 };
    assert.equal(addOneToLine(sinMarcador, TOBO, 11).total, 22);
  });

  test('una linea rota vuelve a packs enteros', () => {
    const rota = { quantity: 13, unitPrice: 11 / 12, presentationQty: 12 };
    const result = addOneToLine(rota, TOBO, 11);
    assert.equal(result.quantity, 24);
    assert.equal(result.total, 22);
  });

  test('la caja de 36 tambien', () => {
    const line = addOneToLine({ quantity: 36, unitPrice: 34 / 36 }, CAJA, 34);
    assert.equal(line.quantity, 72);
    assert.equal(line.total, 68);
  });

  test('un producto normal sigue sumando de a uno', () => {
    const result = addOneToLine({ quantity: 2, unitPrice: 3 }, CERVEZA, 3);
    assert.equal(result.quantity, 3);
    assert.equal(result.total, 9);
  });

  test('los tequeños x8 suman de a UN plato', () => {
    const result = addOneToLine({ quantity: 1, unitPrice: 6 }, TEQUENOS, 6);
    assert.equal(result.quantity, 2);
    assert.equal(result.total, 12);
  });

  test('10 tobos seguidos no arrastran centavos', () => {
    let line: PackLine = newLine(TOBO, 11);
    for (let i = 0; i < 9; i++) line = addOneToLine(line, TOBO, 11);
    assert.equal(line.quantity, 120);
    assert.equal(line.total, 110);
  });
});
