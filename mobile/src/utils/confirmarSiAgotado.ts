import { AvailabilityStatus } from '../services/availabilityService';
import { COLORS } from '../constants/theme';

/**
 * Retorna el texto de confirmación si hay un problema de disponibilidad,
 * o null si está OK.
 *
 * Avisar, NUNCA bloquear: si falta algo lo más probable es que no se haya
 * cargado la compra. El mesonero decide, con el dato delante.
 */
export function avisoDisponibilidad(
  status: AvailabilityStatus | undefined,
): string | null {
  if (!status) return null;

  switch (status.status) {
    case 'AGOTADO':
      return 'Agotado. ¿Vender de todas formas?';
    case 'AVISO':
      return 'Stock bajo. ¿Continuar?';
    case 'SIN_LINEA_BASE':
      return 'Sin conteo de inventario. ¿Vender de todas formas?';
    case 'SIN_CONTROL':
      return 'Sin datos de disponibilidad. ¿Vender de todas formas?';
    case 'OK':
    default:
      return null;
  }
}

/**
 * Retorna un objeto con color y texto para mostrar como badge en ProductCard.
 * Null si no hay distintivo que mostrar (cuando todo está OK).
 */
export function distintivoDe(
  status: AvailabilityStatus | undefined,
): { texto: string; color: string } | null {
  if (!status) return null;

  switch (status.status) {
    case 'OK':
      return null; // Sin badge
    case 'AVISO':
      return { texto: 'Stock bajo', color: COLORS.warning }; // Naranja para aviso
    case 'AGOTADO':
      return { texto: 'Agotado', color: COLORS.error }; // Rojo para error
    case 'SIN_LINEA_BASE':
      return { texto: 'Sin conteo', color: COLORS.textSecondary }; // Gris para estado indefinido
    case 'SIN_CONTROL':
      return { texto: 'Sin datos', color: COLORS.textSecondary }; // Gris para estado indefinido
    default:
      return null;
  }
}
