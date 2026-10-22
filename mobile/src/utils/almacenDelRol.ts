/**
 * Que almacen le toca a cada rol, y que puede hacer con el.
 *
 * Es el espejo en el telefono de `apps/api/src/modules/inventory/
 * station-scope.util.ts`. El servidor ya decide esto —y responde 403 si no
 * cuadra—; aqui esta para que la pantalla no ofrezca lo que va a ser
 * rechazado.
 *
 * Medido el 23/09/2026 en PRE, antes de esto: la pantalla de inventario
 * mostraba los 5 almacenes con **Deposito General preseleccionado** (el unico
 * que una estacion NO puede consultar, porque cuatro almacenes tienen
 * `isDefault: true` y ganaba el primero de la lista). Una cocina entraba y
 * tocaba "Ver Stock" contra un 403 garantizado. Y de las 4 acciones a la
 * vista, 3 —traslado, merma y conteo— son SOLO_GERENCIA en el servidor.
 *
 * Si se cambia la tabla del servidor, hay que cambiar esta.
 */

/** Areas de inventario, igual que en el servidor. */
export type AreaDeInventario = 'BARRA' | 'COCINA' | 'PIZZERIA' | 'GENERAL';

/**
 * El pizzero apunta a COCINA a proposito: ahi estan sus insumos (masas,
 * salsa). El almacen PIZZERIA existe pero no es el suyo.
 */
const AREA_POR_ROL: Record<string, AreaDeInventario> = {
  bar: 'BARRA',
  kitchen: 'COCINA',
  pizza: 'COCINA',
};

const ROLES_DE_GERENCIA = new Set(['admin', 'manager']);

const normalizar = (rol?: string): string => String(rol ?? '').toLowerCase();

/** Gerencia ve todos los almacenes y puede mover, contar y mermar. */
export const esGerencia = (rol?: string): boolean =>
  ROLES_DE_GERENCIA.has(normalizar(rol));

/**
 * El area que le corresponde a una estacion, o `null` si el rol no tiene
 * ninguna (mesonero, cajero) o es gerencia —que no esta atada a una sola.
 */
export const areaDelRol = (rol?: string): AreaDeInventario | null =>
  AREA_POR_ROL[normalizar(rol)] ?? null;

/** Roles con acceso al inventario: gerencia y las tres estaciones. */
export const tieneAccesoAlInventario = (rol?: string): boolean =>
  esGerencia(rol) || areaDelRol(rol) !== null;

/**
 * Traslado, merma y confirmar conteo son SOLO_GERENCIA en el servidor
 * (`movements.controller.ts` y `counts.controller.ts`). Una estacion que los
 * ve solo puede cobrar un 403 al final del formulario.
 */
export const puedeMoverInventario = (rol?: string): boolean => esGerencia(rol);
