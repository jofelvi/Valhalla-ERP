/** Las tarifas se guardan como fracción (0.10); en pantalla se escriben como porcentaje (10). */

/** 0.07 -> 7 */
export const aPorcentaje = (fraccion: number): number =>
  Math.round(fraccion * 10000) / 100;

/** 7 -> 0.07 (redondea a 4 decimales para no arrastrar errores de punto flotante) */
export const aFraccion = (porcentaje: number): number =>
  Math.round(porcentaje * 100) / 10000;

/** "10, 15, 20" -> [10, 15, 20]. Ignora lo que no es número. */
export function parsearPorcentajes(texto: string): number[] {
  return texto
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '')
    .map(Number)
    .filter((n) => Number.isFinite(n));
}

/** Mensaje de error para una lista de porcentajes escrita a mano, o true si es válida. */
export function validarListaPorcentajes(
  texto: string,
  maximo: number,
): true | string {
  const partes = texto
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '');
  if (partes.length > maximo) {
    return `Puede poner hasta ${maximo} porcentajes.`;
  }
  const malo = partes.find((p) => {
    const n = Number(p);
    return !Number.isFinite(n) || n < 0 || n > 100;
  });
  return malo === undefined
    ? true
    : 'Escriba números entre 0 y 100, separados por coma (ej. 10, 15, 20).';
}
