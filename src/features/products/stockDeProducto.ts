/**
 * Decisiones del campo "Stock" del formulario de producto.
 *
 * Contexto (22/08/2026): ese campo escribía `product.stock`, un número que
 * **nadie lee** para decidir si un producto está disponible. La disponibilidad
 * sale de `warehouse_stocks` por almacén — que es lo que consulta el APK/PWA
 * del mesonero. Resultado: la Cerveza Pilsen tenía 168 en el formulario y −93
 * en el almacén, y el mesonero no podía venderla por más que el dueño le
 * "agregara stock".
 *
 * Aquí vive solo la decisión (pura y probable); el efecto lo hace el formulario
 * registrando un CONTEO, que es el único carril que mueve stock dejando
 * movimiento en el kardex.
 */

export interface AlmacenBasico {
  id: string;
  name: string;
}

/**
 * Nombre del almacén al que pertenece cada estación.
 *
 * Pizza va a COCINA, igual que en el servidor (`station-scope.util`). El
 * almacén "Pizzería" existe pero lleva 0 filas desde que se creó: los 24
 * insumos de las 41 pizzas con receta tienen su stock en Cocina, que es de
 * donde el consumo descuenta. Mientras esto dijo 'pizzeria', la tabla de
 * productos buscaba el stock de cada pizza en un almacén vacío y mostraba
 * un guion: el dueño abría el panel y no veía nada de las pizzas.
 */
const ALMACEN_POR_ESTACION: Record<string, string> = {
  BAR: 'barra',
  KITCHEN: 'cocina',
  PIZZA: 'cocina',
};

/** Los insumos sin estación viven en el depósito. */
const ALMACEN_POR_DEFECTO = 'deposito general';

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

/**
 * Almacén donde vive el stock de un producto según su estación.
 *
 * Los almacenes NO tienen campo de estación: se emparejan por nombre, así que
 * se comparan sin tildes ni mayúsculas. Devuelve `null` si ese almacén no
 * existe — preferible a adivinar y cargarle el stock al almacén equivocado.
 */
export function almacenParaEstacion(
  station: string | null | undefined,
  almacenes: AlmacenBasico[],
): AlmacenBasico | null {
  const clave = station
    ? (ALMACEN_POR_ESTACION[String(station).toUpperCase()] ??
      ALMACEN_POR_DEFECTO)
    : ALMACEN_POR_DEFECTO;

  return almacenes.find((a) => normalizar(a.name) === clave) ?? null;
}

/**
 * ¿El número que escribió el usuario exige registrar un conteo?
 *
 * Solo si cambió respecto al stock real y es un número válido y no negativo:
 * un conteo declara lo que hay físicamente, y físicamente no existe −5.
 */
export function hayQueContar(
  stockReal: number | null | undefined,
  stockNuevo: number | null | undefined,
): boolean {
  if (typeof stockNuevo !== 'number' || !Number.isFinite(stockNuevo))
    return false;
  if (stockNuevo < 0) return false;
  if (typeof stockReal !== 'number' || !Number.isFinite(stockReal)) return true;
  return stockReal !== stockNuevo;
}

/**
 * ¿El salto es de los que el servidor frena pidiendo confirmación?
 *
 * La API rechaza diferencias mayores al 50% del stock sin `confirmLargeDiffs`,
 * para atrapar errores de unidad (contar gramos como kilos). El formulario usa
 * esto para **avisar antes**, en vez de comerse el error del servidor.
 */
export function diferenciaEsGrande(
  stockReal: number | null | undefined,
  stockNuevo: number,
): boolean {
  if (typeof stockReal !== 'number' || !Number.isFinite(stockReal)) return true;
  const base = Math.abs(stockReal);
  if (base === 0) return true;
  return Math.abs(stockNuevo - stockReal) / base > 0.5;
}
