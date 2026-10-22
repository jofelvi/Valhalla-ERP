import { Employee } from '@odin6/types';

// Mapea un mesonero (usuario) a su ficha de empleado. El vínculo por `userId`
// es poco confiable (puede estar vacío o apuntar a otro usuario), así que se
// cae a coincidencia por nombre.
export function matchEmployeeForWaiter(
  employees: Employee[],
  waiterId: string,
  waiterName?: string,
): Employee | undefined {
  const byId = employees.find((e) => e.userId === waiterId);
  if (byId) return byId;
  if (!waiterName) return undefined;

  const norm = (s?: string) =>
    (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  const wLow = norm(waiterName);
  if (!wLow) return undefined;

  const exact = employees.filter(
    (e) => norm(`${e.firstName ?? ''} ${e.lastName ?? ''}`) === wLow,
  );
  if (exact.length) return exact.find((e) => !e.userId) ?? exact[0];

  return employees.find((e) => {
    if (e.userId) return false;
    const empFirst = norm(e.firstName);
    const empFull = norm(`${e.firstName ?? ''} ${e.lastName ?? ''}`);
    return (
      empFull.includes(wLow) ||
      wLow.includes(empFirst) ||
      empFirst.includes(wLow)
    );
  });
}
