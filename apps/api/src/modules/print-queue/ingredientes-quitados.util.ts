/**
 * Traduce a NOMBRE los ingredientes quitados de una comanda.
 *
 * El bug que motiva esto: cuando el mesonero quita un ingrediente, la app
 * guarda el **id del producto** (`ProductCustomizationModal` hace
 * `removedIngredients.includes(ingredient.id)`, y `modelTypes/orderItem.ts`
 * lo dice en el comentario: "IDs de ingredientes removidos"). La pantalla
 * del POS lo traduce antes de mostrarlo (`OrderSummary` busca el producto y
 * cae al id solo si no lo encuentra), pero la COMANDA no: el armador del
 * ticket copia el arreglo tal cual y el `receiptBuilder` imprime
 * `*** SIN <lo que venga> ***`. O sea el cocinero recibia en papel
 * `*** SIN YEDEMRXYS1BXUUN7NW5G ***`, que no le dice nada.
 *
 * Se resuelve EN EL SERVIDOR, no en la app, por la misma razon por la que
 * aqui se parten las fichas por estacion: asi funciona con las APKs ya
 * instaladas, que tardan semanas en actualizarse en los telefonos. Un
 * arreglo solo en el cliente dejaria a la cocina leyendo ids por semanas.
 *
 * Es puro y tolerante: lo que no se pueda resolver se deja como vino (mejor
 * un id en el papel que perder el aviso de que falta un ingrediente).
 */

interface ItemConQuitados {
  customizations?: { removedIngredients?: unknown } | null;
  [k: string]: unknown;
}

/** Ids de producto mencionados como ingrediente quitado en el payload. */
export function idsDeIngredientesQuitados(
  items: readonly unknown[] | undefined,
): string[] {
  const vistos = new Set<string>();
  for (const it of items ?? []) {
    for (const id of leerQuitados(it)) vistos.add(id);
  }
  return [...vistos];
}

/**
 * Devuelve una copia de los items con los ids reemplazados por su nombre.
 * No muta la entrada. Un id sin nombre conocido se conserva.
 */
export function nombrarIngredientesQuitados<T>(
  items: readonly T[] | undefined,
  nombrePorId: ReadonlyMap<string, string>,
): T[] {
  return (items ?? []).map((it) => {
    const quitados = leerQuitados(it);
    if (quitados.length === 0) return it;
    const item = it as ItemConQuitados;
    return {
      ...item,
      customizations: {
        ...(item.customizations ?? {}),
        removedIngredients: quitados.map((id) => nombrePorId.get(id) ?? id),
      },
    } as unknown as T;
  });
}

function leerQuitados(it: unknown): string[] {
  if (!it || typeof it !== 'object') return [];
  const cust = (it as ItemConQuitados).customizations;
  if (!cust || typeof cust !== 'object') return [];
  const crudo = (cust as { removedIngredients?: unknown }).removedIngredients;
  if (!Array.isArray(crudo)) return [];
  // Una cadena vacia colada aqui no solo no dice nada: en el ticket sale
  // `*** SIN  ***`. Se descarta, como ya hace el DTO de la orden.
  return crudo.filter(
    (v): v is string => typeof v === 'string' && v.trim().length > 0,
  );
}
