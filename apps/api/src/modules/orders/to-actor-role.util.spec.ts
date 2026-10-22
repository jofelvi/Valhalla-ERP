import { toActorRole } from './to-actor-role.util';

describe('toActorRole — mapea el role del JWT al enum del log de auditoria', () => {
  it('normaliza mayusculas/minusculas al mismo actor canonico', () => {
    // El reporte agrupa por actorRole: 'WAITER' y 'waiter' deben contar igual.
    expect(toActorRole('WAITER')).toBe('waiter');
    expect(toActorRole('waiter')).toBe('waiter');
    expect(toActorRole('Waiter')).toBe('waiter');
  });

  it('mapea cada role conocido a su enum', () => {
    expect(toActorRole('admin')).toBe('admin');
    expect(toActorRole('manager')).toBe('manager');
    expect(toActorRole('cashier')).toBe('cashier');
    expect(toActorRole('waiter')).toBe('waiter');
    expect(toActorRole('kitchen')).toBe('kitchen');
    expect(toActorRole('bar')).toBe('bar');
  });

  it('el pizzero queda como pizza, no como system', () => {
    // El rol 'pizza' se creo despues de este mapa y nadie lo agrego: las 284
    // entregas de Daniel quedaron firmadas como 'system', invisibles en
    // cualquier reporte de quien quemo que. El schema valida el enum, asi que
    // 'pizza' tiene que estar en ACTOR_ROLES ademas de aqui.
    expect(toActorRole('pizza')).toBe('pizza');
    expect(toActorRole('PIZZA')).toBe('pizza');
  });

  it('un role desconocido cae a system', () => {
    expect(toActorRole('customer')).toBe('system');
    expect(toActorRole('root')).toBe('system');
  });

  it('undefined/null/vacio caen a system', () => {
    expect(toActorRole(undefined)).toBe('system');
    expect(toActorRole('')).toBe('system');
  });
});
