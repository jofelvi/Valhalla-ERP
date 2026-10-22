/**
 * ALERTAS DE MARGEN — ORDENAMIENTO por gravedad.
 *
 * La aritmética de margen (cuánto gana un producto, y si eso es NEGATIVO / NULO
 * / BAJO) vive en UN solo sitio: `cost-propagation.util.ts` (`evaluarMargen`,
 * `margenPct`, `costoPorUnidadVendida`), que es lo que de verdad escribe la
 * colección `margin_alerts` al propagar el costo de una compra. Aquí NO se
 * recalcula nada: sería una segunda copia de la misma verdad — justo el error
 * que dejó el dinero descuadrado en siete sitios. Este módulo solo ordena las
 * alertas ya evaluadas para presentarlas de lo más grave a lo menos.
 */

import type { AlertaMargen, NivelMargen } from './cost-propagation.util';

// Se re-exporta el tipo canónico para que los consumidores de las alertas
// (servicio, controlador) no dependan de la ruta interna de cost-propagation.
export type { AlertaMargen, NivelMargen } from './cost-propagation.util';

/**
 * Severidad de un nivel de margen (menor = más grave), para ordenar.
 *
 * NEGATIVO: se pierde plata en cada venta. NULO: se vende al costo.
 * BAJO: por debajo del umbral sano, pero aún deja algo.
 */
export function clasificarSeveridad(nivel: NivelMargen): number {
  switch (nivel) {
    case 'NEGATIVO':
      return 0; // Grave: se pierde plata
    case 'NULO':
      return 1; // Aviso: se vende al costo
    case 'BAJO':
      return 2; // Informativo: bajo pero vendible
    default:
      return 99;
  }
}

/**
 * Ordena alertas por gravedad descendente y, dentro de cada grupo, por margen
 * ascendente (el peor margen primero). No muta el arreglo de entrada.
 */
export function ordenarAlertas(alertas: AlertaMargen[]): AlertaMargen[] {
  return [...alertas].sort(
    (a, b) =>
      clasificarSeveridad(a.nivel) - clasificarSeveridad(b.nivel) ||
      a.marginPct - b.marginPct,
  );
}
