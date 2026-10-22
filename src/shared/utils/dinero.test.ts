import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  formatearBs,
  formatearNumero,
  formatearUsd,
  formatearUsdConMiles,
  formatearUsdSinDecimales,
} from './dinero.ts';

// Estas pruebas fijan que el formato es EL MISMO que ya se ve en pantalla.
// Migrar 249 sitios de `$${x.toFixed(2)}` solo es seguro si el resultado es
// idéntico carácter a carácter; en cuanto deje de serlo, falla aquí.

describe('dinero', () => {
  test('formatearUsd escribe igual que `$${x.toFixed(2)}`', () => {
    for (const n of [0, 1, 2.5, 25, 1234.5, 0.005, 1234567.891]) {
      assert.equal(formatearUsd(n), `$${n.toFixed(2)}`);
    }
  });

  test('un monto ausente se muestra como cero, no como NaN', () => {
    assert.equal(formatearUsd(null), '$0.00');
    assert.equal(formatearUsd(undefined), '$0.00');
    assert.equal(formatearBs(null), 'Bs 0,00');
    assert.equal(formatearUsdConMiles(undefined), formatearUsdConMiles(0));
  });

  test('los negativos conservan el signo', () => {
    assert.equal(formatearUsd(-4.4), '$-4.40');
  });

  test('bolivares llevan separador de miles', () => {
    assert.equal(formatearBs(1234.5), 'Bs 1.234,50');
    assert.equal(formatearBs(0.5), 'Bs 0,50');
  });

  test('la version con miles es la misma que ya usaban los reportes', () => {
    // No se fija el texto porque `Intl` depende del ICU del entorno (Node
    // escribe "USD 1.234,50" donde el navegador escribe "$1.234,50"). Lo que
    // se fija es que sea LA MISMA llamada que hacian las copias locales de
    // cobros-incompletos, cronograma-socios y MergeOrderModal.
    const comoEstabaAntes = (n: number) =>
      new Intl.NumberFormat('es-VE', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
      }).format(n);
    for (const n of [0, 1234.5, -80.25, 999999.999]) {
      assert.equal(formatearUsdConMiles(n), comoEstabaAntes(n));
    }
  });

  test('el eje de las graficas redondea a entero, sin decimales', () => {
    // El grafico de ventas semanales escribia sus etiquetas con una copia
    // local. Se fija que sea LA MISMA llamada, no un texto, porque `Intl`
    // depende del ICU del entorno.
    const comoEstabaAntes = (n: number) =>
      new Intl.NumberFormat('es-VE', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(n);
    for (const n of [0, 1234.5, 25, 999999.6]) {
      assert.equal(formatearUsdSinDecimales(n), comoEstabaAntes(n));
    }
  });

  test('un numero suelto va sin simbolo: la tasa BCV no es un monto', () => {
    // En el detalle de la orden se lee "(tasa 820,10)". Ponerle "Bs" delante
    // seria decir otra cosa: no son bolivares, es cuantos bolivares vale un
    // dolar.
    assert.equal(formatearNumero(820.1), '820,10');
    assert.equal(formatearNumero(1234.5), '1.234,50');
    assert.equal(formatearNumero(null), '0,00');
  });

  test('formatearBs es formatearNumero con su prefijo', () => {
    for (const n of [0, 25, 1234.5]) {
      assert.equal(formatearBs(n), `Bs ${formatearNumero(n)}`);
    }
  });
});
