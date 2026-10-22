import { TableStatusEnum } from '@/shared';
import { TableWithOrder } from '../types';

/**
 * Determina el estado visual de una mesa considerando múltiples campos:
 * 1. currentOrder (orden activa en memoria)
 * 2. status === OCCUPIED
 * 3. isAvailable (legacy)
 * 4. orderId (legacy)
 *
 * Importante: Si alguno de estos campos está desincronizado, la mesa se mostrará ocupada.
 * Ver CLAUDE.md "Eliminar Ordenes y Liberar Mesas (CRITICO)"
 */
export const getTableStatus = (table: TableWithOrder): 'free' | 'occupied' => {
  // Verificar currentOrder primero (orden activa en cache)
  if (table.currentOrder) return 'occupied';

  // Si no hay currentOrder, verificar otros campos de compatibilidad
  if (table.status === TableStatusEnum.OCCUPIED) return 'occupied';
  if (!table.isAvailable) return 'occupied';
  if (table.orderId) return 'occupied';

  return 'free';
};

/**
 * Cuenta mesas disponibles usando solo orderId (criterio legacy).
 *
 * NOTA: Podría haber discrepancia con getTableStatus() que chequea 4 campos.
 * Si la mesa falla al actualizarse, puede quedar con status=OCCUPIED pero
 * orderId=null (o viceversa). Se reporta el inconsistency al usuario.
 */
export const getAvailableTablesCount = (tables: TableWithOrder[]): number => {
  return tables.filter((table) => !table.orderId).length;
};
