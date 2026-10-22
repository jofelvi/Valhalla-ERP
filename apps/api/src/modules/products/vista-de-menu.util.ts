/**
 * Que campos del catalogo viajan, y cuales no.
 *
 * `GET /api/products` devolvia el documento entero de los 585 productos, a
 * todos los que lo pidieran. Medido en produccion el 22/09/2026:
 * **484.283 bytes crudos / 76.087 comprimidos**, y la app movil lo pedia SIN
 * filtros desde **nueve pantallas distintas** (mesonero, cajero, estacion,
 * despacho, home, cliente...), cada una con su propia peticion.
 *
 * De esos 484 KB, lo que ninguna pantalla de venta usa:
 *
 * | Campo | Bytes | Para que sirve |
 * | --- | --- | --- |
 * | `ingredients` | **88.287** | La receta. La usa Recetas y el costeo, NO el menu |
 * | `imageUrl` | 47.190 | Si se usa en el menu; se queda |
 * | `description` | 17.383 | No se muestra en las pantallas de venta |
 * | `_firestoreCreatedAt` + `_firestoreUpdatedAt` | **15.860** | Metadata muerta de la migracion de Firebase. No la lee nadie |
 * | `createdAt` + `updatedAt` | 30.420 | No se muestran |
 *
 * Y de los 585 productos, **solo 368 son `isActive && isForSale`**: los otros
 * 217 viajaban enteros para que el telefono los tirara con un `.filter()`.
 *
 * Resultado de aplicar las dos cosas: **484.283 -> 115.577 bytes crudos, 76%
 * menos**.
 *
 * Es OPT-IN a proposito. Sin `vista=menu` la respuesta es la de siempre, campo
 * por campo: los APK que estan en la calle hoy no se enteran y siguen andando.
 * Un recorte por defecto habria roto pantallas en telefonos que tardan semanas
 * en actualizarse, que es como se rompen las cosas en este negocio.
 */

/**
 * Lo que necesita una pantalla que VENDE: mostrar el producto, agruparlo,
 * cobrarlo y mandarlo a su estacion.
 *
 * Antes de sacar un campo de esta lista: `normalize()` del movil descarta lo
 * que no conoce y **no falla** — sin `_id`, las estaciones llegaron a decir
 * "todo despachado" con 22 items pendientes. Si dudas, dejalo.
 */
export const CAMPOS_DEL_MENU = [
  '_id',
  'name',
  'price',
  'categoryId',
  'station',
  'imageUrl',
  'isActive',
  'isForSale',
  'type',
  'presentation',
  'presentationQuantity',
  'sku',
  'tax',
  'barcode',
  'stock',
] as const;

/** Proyeccion de Mongo para la vista de menu. */
export function proyeccionDeMenu(): Record<string, 1> {
  return Object.fromEntries(CAMPOS_DEL_MENU.map((c) => [c, 1]));
}

/**
 * Tomar pedido en la web: el menu mas lo que necesita personalizar.
 *
 * - `ingredients`: el selector decide con la receta si un producto se puede
 *   personalizar ("SIN cebolla"); sin ella no se podria personalizar ninguno.
 * - `description`: la busqueda del POS web la incluye.
 *
 * Aparte de `menu` para no engordar lo que baja el APK (27/09/2026).
 */
export const CAMPOS_DEL_POS = [
  ...CAMPOS_DEL_MENU,
  'ingredients',
  'description',
] as const;

/**
 * Traduce el parametro `vista` a una proyeccion.
 *
 * Cualquier valor que no sea `menu` o `pos` devuelve `null` = documento
 * completo. Un cliente que mande basura recibe de mas, no de menos:
 * equivocarse por el lado de mandar todo es un gasto; por el otro, una
 * pantalla vacia.
 */
export function proyeccionPedida(vista?: string): Record<string, 1> | null {
  if (vista === 'menu') return proyeccionDeMenu();
  if (vista === 'pos') {
    return Object.fromEntries(CAMPOS_DEL_POS.map((c) => [c, 1]));
  }
  return null;
}

/**
 * Traduce `forSale` a la condicion de Mongo.
 *
 * `forSale=true` significa "lo que se puede vender HOY": activo Y a la venta.
 * Son las dos condiciones que el movil venia aplicando en el telefono
 * (`.filter((p) => p.isActive && p.isForSale)`), repetidas en cada uno de los
 * nueve sitios que lo llamaban.
 */
export function condicionDeVenta(
  forSale?: string,
): Record<string, true> | null {
  if (forSale !== 'true') return null;
  return { isActive: true, isForSale: true };
}
