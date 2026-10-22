import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseTasaBcvHtml } from './bcvHtmlParse.ts';

// Trozo real de www.bcv.org.ve (20/08/2026). El BCV publica el número con coma
// decimal y ocho decimales: "777,41610000".
const HTML_REAL = `
<div id="dolar" class="col-sm-12 col-xs-12 ">
  <div class="field-content">
    <div class="row recuadrotsmc">
      <div class="col-sm-6 col-xs-6"><span>USD</span></div>
      <div class="col-sm-6 col-xs-6 centrado"><strong> 777,41610000 </strong></div>
    </div>
  </div>
</div>
<div id="euro"><strong> 905,12345678 </strong></div>
`;

describe('parseTasaBcvHtml', () => {
  it('saca la tasa del dólar del HTML del BCV', () => {
    assert.equal(parseTasaBcvHtml(HTML_REAL), 777.4161);
  });

  // El euro va en su propio div y suele estar ANTES en el orden del DOM en
  // algunas versiones de la página: tomar "el primer número" cobraría en euros.
  it('no confunde el euro con el dólar', () => {
    const alReves = `<div id="euro"><strong> 905,12345678 </strong></div>
      <div id="dolar"><strong> 777,41610000 </strong></div>`;
    assert.equal(parseTasaBcvHtml(alReves), 777.4161);
  });

  it('devuelve null si la página cambió y no hay dólar', () => {
    assert.equal(
      parseTasaBcvHtml('<html><body>mantenimiento</body></html>'),
      null,
    );
    assert.equal(parseTasaBcvHtml(''), null);
  });

  it('devuelve null si el número no se puede leer', () => {
    assert.equal(
      parseTasaBcvHtml('<div id="dolar"><strong> --- </strong></div>'),
      null,
    );
  });
});
