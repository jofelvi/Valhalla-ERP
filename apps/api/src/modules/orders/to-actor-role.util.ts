import type { ActorRole } from './schemas/order-item-event.schema';

/**
 * Mapea roles del JWT a los roles del log de auditoria. Mantiene el formato
 * canonico para que reportes agrupen consistente (ej: 'WAITER' y 'waiter'
 * se cuentan como uno solo). Un role desconocido o ausente cae a 'system'.
 */
export function toActorRole(jwtRole: string | undefined): ActorRole {
  const r = String(jwtRole || '').toLowerCase();
  if (r === 'admin') return 'admin';
  if (r === 'manager') return 'manager';
  if (r === 'cashier') return 'cashier';
  if (r === 'waiter') return 'waiter';
  if (r === 'kitchen') return 'kitchen';
  if (r === 'bar') return 'bar';
  // El rol del pizzero se creo despues de este mapa: sin esta linea sus
  // entregas se firmaban como 'system'.
  if (r === 'pizza') return 'pizza';
  return 'system';
}
