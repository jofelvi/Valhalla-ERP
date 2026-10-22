/**
 * Cómo se escribe el dinero en el POS. Una sola convención, un solo sitio.
 *
 * Medido el 08/09/2026: `$${x.toFixed(2)}` aparecía 249 veces en 53 archivos,
 * y encima había 29 helpers `money`/`formatCurrency` redefinidos localmente.
 * El `formatCurrency` compartido usa `es-ES` (que escribe "25,00 US$") y las
 * copias locales usan `es-VE` ("$25,00"): o sea que el helper "común"
 * renderizaba distinto que la mayoría, y por eso nadie lo usaba.
 *
 * Estas funciones devuelven EXACTAMENTE lo que ya se ve en pantalla, para que
 * migrar no cambie ni un píxel. Si algún día se decide otro formato, se
 * cambia aquí y cambia en todas partes, que es justo lo que hoy no se puede.
 */

/** `$1234.50` — el formato que usa hoy el 100 % de las pantallas del POS. */
export const formatearUsd = (monto: number | null | undefined): string =>
  `$${Number(monto ?? 0).toFixed(2)}`;

/**
 * `1.234,50` — un número con dos decimales y separador de miles, SIN símbolo.
 *
 * Es para lo que no es un monto aunque lo parezca: la tasa BCV se lee
 * "(tasa 820,10)", y ponerle "Bs" delante diría otra cosa — no son bolívares,
 * es cuántos bolívares vale un dólar.
 */
export const formatearNumero = (monto: number | null | undefined): string =>
  Number(monto ?? 0).toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** `Bs 1.234,50` — bolívares con separador de miles, como los ve la caja. */
export const formatearBs = (monto: number | null | undefined): string =>
  `Bs ${formatearNumero(monto)}`;

/**
 * Con separador de miles, para totales grandes de reportes. Lo que escribe
 * depende del ICU del entorno (el navegador pone "$1.234,50", Node
 * "USD 1.234,50"); lo que importa es que sea UNA sola llamada.
 * Es el formato de los `money` locales de cobros-incompletos y cronograma.
 */
export const formatearUsdConMiles = (
  monto: number | null | undefined,
): string =>
  new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(Number(monto ?? 0));

/**
 * El mismo formato con miles pero sin decimales, para los ejes de las
 * gráficas: en una etiqueta de eje los céntimos solo estorban.
 */
export const formatearUsdSinDecimales = (
  monto: number | null | undefined,
): string =>
  new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(monto ?? 0));
