/**
 * Tope y salto de pagina, una sola vez para toda la API.
 *
 * Esto nacio copiado tres veces. `paginar-ordenes.util.ts` y
 * `filtros-de-facturas.util.ts` tenian la MISMA aritmetica con distintos
 * nombres, y print-logs iba a ser la tercera. Dos copias ya son una, y la
 * tercera es como las copias empiezan a divergir: alguien arregla un borde en
 * una y las otras se quedan con el bug.
 *
 * El borde que importa, y la razon de que esto sea una funcion y no un
 * `?? 500`:
 *
 * > **`.limit(0)` en Mongo significa SIN LIMITE.**
 *
 * O sea que el resultado de validar mal el parametro no es "manda poco": es
 * "manda todo", que es exactamente lo que se estaba arreglando. Un
 * `?limit=abc`, un `?limit=0` o un `?limit=-1` tienen que caer al DEFECTO, no
 * al cero.
 *
 * Segunda regla, aprendida con ordenes: **el defecto va por debajo del
 * techo**. Poner los dos en el mismo numero deja al que necesita mas sin
 * forma de pedirlo, y el reporte se trunca en silencio.
 */

export interface Tope {
  /** Cuanto se manda si el cliente no pide nada. Menor que `duro`. */
  defecto: number;
  /** Techo absoluto: pedir mas no sirve. */
  duro: number;
}

export interface Paginacion {
  limit: number;
  skip: number;
}

/**
 * `limit` y `page` tal como llegan de la query (string) o ya convertidos
 * (number), acotados contra `tope`.
 *
 * El salto se calcula sobre el limite YA ACOTADO: con el crudo,
 * `?limit=9000&page=2` saltaria 9.000 filas de un tope de 2.000 y se perderian
 * miles en silencio.
 */
export function paginar(
  limit: string | number | undefined,
  page: string | number | undefined,
  tope: Tope,
): Paginacion {
  const acotado = limitePedido(limit, tope);
  return { limit: acotado, skip: saltoDePagina(page, acotado) };
}

export function limitePedido(
  limit: string | number | undefined,
  tope: Tope,
): number {
  if (limit === undefined || limit === null || limit === '') {
    return tope.defecto;
  }
  const n = Number(limit);
  // Basura, cero o negativo se trata como "no pidio nada". Ver el docblock:
  // el caso peligroso es que termine en `.limit(0)`.
  if (!Number.isFinite(n) || n < 1) return tope.defecto;
  return Math.min(Math.floor(n), tope.duro);
}

export function saltoDePagina(
  page: string | number | undefined,
  limit: number,
): number {
  if (page === undefined || page === null || page === '') return 0;
  const n = Number(page);
  if (!Number.isFinite(n) || n < 2) return 0;
  return (Math.floor(n) - 1) * limit;
}
