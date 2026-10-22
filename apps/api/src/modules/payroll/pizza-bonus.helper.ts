/**
 * Bono del pizzero: la cuenta, sin red ni base de datos.
 *
 * Vivía SOLO dentro de `scripts/reporte-bono-pizzero.cjs` (el cron que manda el
 * correo y el SMS de los lunes). Como no existía como servicio, la pantalla de
 * nómina no podía precargarlo y el dueño lo copiaba a mano — con el riesgo de
 * pagar un número distinto al que se le avisó al pizzero.
 *
 * Aquí queda la cuenta pura para que el cron y la pantalla usen la MISMA, y las
 * tarifas sigan viniendo de Mongo (`configs/pizza_bonus`) sin redeploy.
 */

export interface TarifasBono {
  grande: number;
  mediana: number;
  pequena: number;
  combo: number;
}

export type CategoriaPizza =
  | 'grande'
  | 'mediana'
  | 'pequena'
  | 'combo'
  | 'otras';

export interface ClasificacionPizza {
  cat: CategoriaPizza;
  /** Cuántas pizzas trae el combo (informativo: la tarifa es por combo). */
  n?: number;
}

export interface ProductoPizza {
  id: string;
  name: string;
}

export interface ItemDeOrden {
  productId?: string;
  quantity?: number;
  cancelledAt?: Date | string | null;
}

export interface OrdenParaBono {
  items?: ItemDeOrden[];
}

export interface ResultadoBono {
  conteo: Record<CategoriaPizza, number>;
  detalle: { grande: number; mediana: number; pequena: number; combo: number };
  individuales: number;
  ordenes: number;
  total: number;
}

export const TARIFAS_POR_DEFECTO: TarifasBono = {
  grande: 0.2,
  mediana: 0.15,
  pequena: 0.1,
  combo: 0.3,
};

/**
 * Lo que sale de la estación de pizza pero NO es una pizza vendida: extras,
 * insumos y platos de otra naturaleza. Si entraran, el pizzero cobraría bono
 * por la masa cruda y por la salsa.
 */
export const PATRON_EXCLUIDOS_POR_DEFECTO =
  /extra|focaccia|cachapa|panzerott|bandeja|ma[ií]z|salsa|masa/i;

const redondear = (n: number): number => Math.round(n * 100) / 100;

/**
 * Clasifica un producto por su nombre. Devuelve `null` si no paga bono.
 *
 * El orden importa: "2 Pizzas · Contigo" es un COMBO, no dos individuales, así
 * que el patrón de combo se evalúa antes que el de tamaño.
 */
export function clasificarPizza(
  nombre: string,
  excluidos: RegExp = PATRON_EXCLUIDOS_POR_DEFECTO,
): ClasificacionPizza | null {
  if (excluidos.test(nombre)) return null;

  const combo = nombre.match(/^\s*(\d+)\s*pizzas?/i);
  if (combo) return { cat: 'combo', n: parseInt(combo[1], 10) };

  if (/grande/i.test(nombre)) return { cat: 'grande' };
  if (/mediana/i.test(nombre)) return { cat: 'mediana' };
  if (/peque[nñ]a/i.test(nombre)) return { cat: 'pequena' };

  return { cat: 'otras' };
}

export function calcularBonoPizzero(
  ordenes: OrdenParaBono[],
  productosDePizza: ProductoPizza[],
  tarifas: TarifasBono = TARIFAS_POR_DEFECTO,
  excluidos: RegExp = PATRON_EXCLUIDOS_POR_DEFECTO,
): ResultadoBono {
  const clasePorProducto = new Map<string, ClasificacionPizza>();
  for (const p of productosDePizza) {
    const c = clasificarPizza(p.name ?? '', excluidos);
    if (c) clasePorProducto.set(String(p.id), c);
  }

  const conteo: Record<CategoriaPizza, number> = {
    grande: 0,
    mediana: 0,
    pequena: 0,
    combo: 0,
    otras: 0,
  };
  let ordenesConPizza = 0;

  for (const orden of ordenes) {
    let tienePizza = false;
    for (const item of orden.items ?? []) {
      if (item.cancelledAt) continue;
      const clase = clasePorProducto.get(String(item.productId ?? ''));
      if (!clase) continue;
      conteo[clase.cat] += item.quantity ?? 0;
      // "otras" no paga bono, así que tampoco convierte la orden en "con pizza".
      if (clase.cat !== 'otras') tienePizza = true;
    }
    if (tienePizza) ordenesConPizza += 1;
  }

  const detalle = {
    grande: redondear(conteo.grande * tarifas.grande),
    mediana: redondear(conteo.mediana * tarifas.mediana),
    pequena: redondear(conteo.pequena * tarifas.pequena),
    combo: redondear(conteo.combo * tarifas.combo),
  };

  return {
    conteo,
    detalle,
    individuales: conteo.grande + conteo.mediana + conteo.pequena,
    ordenes: ordenesConPizza,
    total: redondear(
      detalle.grande + detalle.mediana + detalle.pequena + detalle.combo,
    ),
  };
}
