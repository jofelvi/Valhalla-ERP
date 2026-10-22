import { ForbiddenException } from '@nestjs/common';
import type { InventoryArea } from './units';

/**
 * Alcance del inventario para el personal de estación.
 *
 * El inventario pasó a decidir descuentos de dinero al personal: quien es
 * medido no puede ver ni tocar el almacén de otro. Cada estación queda acotada
 * a SU mundo (regla del dueño, la misma que rige comandas, fichas y recetas).
 */
/**
 * Almacén del que sale cada estación.
 *
 * Pizza sale de COCINA, y esto NO es un descuido: el almacén "Pizzería"
 * existe, está activo y lleva 0 filas desde que se creó. Los 24 insumos que
 * usan las 41 pizzas con receta tienen sus 23 filas de stock en Cocina, que es
 * de donde el consumo descuenta de verdad (`consumption.service`), y es la
 * regla que fijó el dueño: todo sale de Cocina.
 *
 * Mientras esto dijo PIZZERIA, el pizzero abría el inventario, veía un almacén
 * vacío y recibía 403 en Cocina — o sea, no podía ver el stock que su propia
 * estación consume. Lo mismo le pasaba al panel de admin con la columna de
 * stock de las pizzas.
 *
 * Un producto puede seguir mandándose a Pizzería poniéndole `inventoryArea`
 * a mano; esto es solo el valor por defecto de la estación.
 */
export const AREA_BY_STATION: Record<string, InventoryArea> = {
  BAR: 'BARRA',
  KITCHEN: 'COCINA',
  PIZZA: 'COCINA',
};

/** Área de inventario de una estación. Sin estación, el depósito general. */
export function areaDeEstacion(station?: string | null): InventoryArea {
  return AREA_BY_STATION[String(station ?? '').toUpperCase()] ?? 'GENERAL';
}

export const AREA_BY_ROLE: Record<string, InventoryArea> = {
  bar: 'BARRA',
  kitchen: 'COCINA',
  // El pizzero ve Cocina porque ahí están sus insumos (ver AREA_BY_STATION).
  pizza: 'COCINA',
};

export const AREA_LABEL: Record<string, string> = {
  BARRA: 'barra',
  COCINA: 'cocina',
  PIZZERIA: 'pizzería',
  GENERAL: 'depósito general',
};

export function esGerencia(role?: string): boolean {
  const r = String(role ?? '').toLowerCase();
  return r === 'admin' || r === 'manager';
}

// Roles sin estación (mesonero/cajero) que arman tobos mixtos: necesitan LEER
// el stock de BARRA para ver la disponibilidad por variante al componer. Es solo
// lectura — mover/ajustar stock sigue siendo exclusivo de gerencia.
const LECTURA_BARRA_ROLES = new Set(['waiter', 'cashier']);

/** Área de inventario que le corresponde a un rol de estación, o null. */
export function areaDeRol(role?: string): InventoryArea | null {
  return AREA_BY_ROLE[String(role ?? '').toLowerCase()] ?? null;
}

/**
 * Lanza 403 si el rol no puede ver ese almacén.
 * Gerencia ve todo; una estación solo el almacén de su área.
 * Un rol sin área asignada (mesonero, cajero) no ve ninguno.
 */
export function assertPuedeVerAlmacen(
  role: string | undefined,
  areaDelAlmacen: string | undefined,
): void {
  if (esGerencia(role)) return;
  // Mesonero/cajero: lectura de BARRA permitida (arman tobos mixtos).
  if (
    LECTURA_BARRA_ROLES.has(String(role ?? '').toLowerCase()) &&
    String(areaDelAlmacen ?? '').toUpperCase() === 'BARRA'
  ) {
    return;
  }
  const area = areaDeRol(role);
  if (!area) {
    throw new ForbiddenException('Tu rol no tiene acceso al inventario');
  }
  if (String(areaDelAlmacen ?? '').toUpperCase() !== area) {
    throw new ForbiddenException(
      `Solo puedes consultar el inventario de ${AREA_LABEL[area] ?? area}`,
    );
  }
}
