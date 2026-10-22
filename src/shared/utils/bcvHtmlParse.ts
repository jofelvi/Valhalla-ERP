/**
 * Lee la tasa del dólar del HTML de www.bcv.org.ve.
 *
 * Separado del fetch a propósito: así se prueba con el HTML real capturado del
 * banco, sin red y sin navegador. Antes esta lectura la hacía Puppeteer, que en
 * el servidor de producción no tiene Chrome — por eso esa "fuente de respaldo"
 * llevaba tiempo muerta sin que nadie lo notara.
 */
export function parseTasaBcvHtml(html: string): number | null {
  if (!html) return null;

  // El bloque del dólar es `<div id="dolar" ...> ... </div>`. Se recorta desde
  // el id para no leer el del euro, que vive en su propio div y puede aparecer
  // antes o después según la versión de la página.
  const inicio = html.search(/id\s*=\s*["']dolar["']/i);
  if (inicio === -1) return null;

  const bloque = html.slice(inicio, inicio + 600);

  // El BCV publica con coma decimal y hasta ocho decimales: "777,41610000".
  const match = bloque.match(/(\d{1,3}(?:\.\d{3})*|\d+),(\d{1,8})/);
  if (!match) return null;

  const entero = match[1].replace(/\./g, '');
  const valor = Number.parseFloat(`${entero}.${match[2]}`);

  return Number.isFinite(valor) && valor > 0 ? valor : null;
}
