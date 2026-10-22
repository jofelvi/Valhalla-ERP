import { Employee } from '@odin6/types';
import { Order } from '@odin6/types';
import { User } from '@odin6/types';
import { isWaiterRole } from './payrollCalc';

/**
 * Emparejamiento empleado ↔ usuario ↔ órdenes.
 *
 * Vive aparte porque la tabla semanal y la vista de detalle por mesonero tienen
 * que resolver EXACTAMENTE las mismas órdenes: si divergen, el detalle muestra
 * una comisión distinta a la que se paga.
 *
 * El emparejamiento por nombre existe porque varios empleados todavía no tienen
 * `userId` seteado (Jostin, por ejemplo) y sin él no cobrarían comisión. Lo
 * correcto es enlazar el `userId`; esto es la red de seguridad mientras tanto.
 */

export const norm = (s?: string | null): string =>
  (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/** Usuario del POS que corresponde a un empleado (por id, si no por nombre). */
export function findUserForEmployee(
  emp: Employee,
  users: User[],
): User | undefined {
  if (emp.userId) {
    const byId = users.find((u) => u.id === emp.userId);
    if (byId) return byId;
  }
  const empFull = norm(`${emp.firstName ?? ''} ${emp.lastName ?? ''}`);
  const empFirst = norm(emp.firstName).split(' ')[0];
  if (!empFull) return undefined;

  const matches = users.filter((u) => {
    const un = norm(u.name);
    if (!un) return false;
    return (
      empFull === un ||
      empFull.startsWith(un + ' ') ||
      un === empFirst ||
      empFull.includes(un) ||
      un.includes(empFirst)
    );
  });
  if (matches.length === 0) return undefined;
  // Ante empate manda el que tiene rol de mesonero: los nombres se repiten
  // entre roles (hay un Luis admin, un Luis de barra y un Luis mesonero).
  return matches.find((u) => isWaiterRole(u.role)) ?? matches[0];
}

/** Órdenes de un empleado: por waiterId (userId) o, sin él, por waiterName. */
export function ordersForEmployee(
  emp: Employee,
  orders: Order[],
  user?: User,
): Order[] {
  const targetId = user?.id ?? emp.userId;
  if (targetId) {
    const byId = orders.filter((o) => o.waiterId === targetId);
    if (byId.length > 0) return byId;
  }
  const empFull = norm(`${emp.firstName ?? ''} ${emp.lastName ?? ''}`);
  const empFirst = norm(emp.firstName).split(' ')[0];
  return orders.filter((o) => {
    const wn = norm(o.waiterName);
    if (!wn) return false;
    return (
      empFull.includes(wn) || wn === empFirst || empFull.startsWith(wn + ' ')
    );
  });
}

/** ¿Se le calcula comisión? La marca explícita manda sobre el rol. */
export function isWaiterEmployee(emp: Employee, user?: User): boolean {
  if (typeof emp.esMesonero === 'boolean') return emp.esMesonero;
  return (
    isWaiterRole(user?.role) ||
    isWaiterRole((emp as Employee & { role?: string }).role)
  );
}
