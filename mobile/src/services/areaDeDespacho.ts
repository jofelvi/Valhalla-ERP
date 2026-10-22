import type { Station } from './kitchenOrderService';

/** Pestañas de la pantalla de despacho. Coinciden con las estaciones. */
export type AreaDespacho = 'KITCHEN' | 'BAR' | 'PIZZA';

/** Las tres estaciones que se cargan: si falta una, sus items son invisibles. */
export const ESTACIONES_DE_DESPACHO: Station[] = ['KITCHEN', 'BAR', 'PIZZA'];

/** Lo mínimo que el filtro necesita de un ítem. */
export interface ItemConEstacion {
  productId: string;
  station?: string | null;
}

/**
 * Reparte los ítems pendientes entre las pestañas de despacho.
 *
 * Pizza se marca de DOS formas y hay que aceptar las dos:
 *
 * - Hoy el producto trae `station: 'PIZZA'` (así lo guarda el catálogo y así
 *   lo agrupa la ficha en el servidor).
 * - En órdenes viejas la pizza venía como `station: 'KITCHEN'` y solo se
 *   distinguía por su categoría, que es como la comanda la separa al imprimir.
 *
 * Mirar una sola de las dos deja items fuera: la pantalla llegó a pedir solo
 * KITCHEN y BAR, así que TODO lo que tenía `station: 'PIZZA'` desaparecía —
 * ni en pizza ni en cocina — y desde el APK no se veía nada que quemar.
 *
 * `categoriaDe` puede no estar lista: el catálogo se carga en segundo plano.
 * Sin él, lo que tiene estación PIZZA igual se ve (no depende de la categoría)
 * y lo de cocina se muestra completo, sin sacarle las pizzas viejas.
 */
export function filtrarPorArea<T extends ItemConEstacion>(
  items: T[],
  area: AreaDespacho,
  categoriaDe: ((productId: string) => string | undefined) | undefined,
  categoriaPizzas: string,
): T[] {
  const esPizzaVieja = (item: T): boolean =>
    estacion(item) === 'KITCHEN' &&
    !!categoriaDe &&
    categoriaDe(item.productId) === categoriaPizzas;

  return items.filter((item) => {
    const st = estacion(item);
    if (area === 'BAR') return st === 'BAR';
    if (area === 'PIZZA') return st === 'PIZZA' || esPizzaVieja(item);
    // Cocina: lo suyo, menos las pizzas viejas que van a su propia pestaña.
    return st === 'KITCHEN' && !esPizzaVieja(item);
  });
}

function estacion(item: ItemConEstacion): string {
  return String(item.station ?? '').toUpperCase();
}
