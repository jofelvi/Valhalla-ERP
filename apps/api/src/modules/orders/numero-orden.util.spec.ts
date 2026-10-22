import { OPERACION_DEFAULT } from '@odin6/types';
import { fechaDeJornada, formatearNumeroOrden } from './numero-orden.util';

/**
 * El numero que canta cocina: `290826-0001`.
 *
 * Lo delicado es la jornada. El negocio cierra a las 6 de la mañana, asi que
 * un pedido de la madrugada pertenece al dia ANTERIOR. Y el servidor corre en
 * otra zona horaria: si se calculara con la hora del VPS, el correlativo se
 * reiniciaria a una hora que en el local no significa nada.
 */
describe('fechaDeJornada', () => {
  // Venezuela es UTC-4, sin horario de verano.
  const enCaracas = (iso: string) => new Date(iso);

  it('una orden de la tarde pertenece a ese mismo dia', () => {
    expect(fechaDeJornada(enCaracas('2026-08-29T18:30:00-04:00'))).toBe(
      '290826',
    );
  });

  it('una orden de las 2 AM pertenece a la jornada del dia anterior', () => {
    expect(fechaDeJornada(enCaracas('2026-08-30T02:15:00-04:00'))).toBe(
      '290826',
    );
  });

  it('a las 5:59 todavia es el dia anterior; a las 6:00 ya es el nuevo', () => {
    expect(fechaDeJornada(enCaracas('2026-08-30T05:59:00-04:00'))).toBe(
      '290826',
    );
    expect(fechaDeJornada(enCaracas('2026-08-30T06:00:00-04:00'))).toBe(
      '300826',
    );
  });

  it('cambia de mes correctamente en la madrugada', () => {
    expect(fechaDeJornada(enCaracas('2026-09-01T03:00:00-04:00'))).toBe(
      '310826',
    );
  });

  it('cambia de año correctamente en la madrugada', () => {
    expect(fechaDeJornada(enCaracas('2027-01-01T01:00:00-04:00'))).toBe(
      '311226',
    );
  });

  // El VPS no corre en hora de Venezuela: el mismo instante debe dar la misma
  // jornada se mire desde donde se mire.
  it('usa la hora de Venezuela, no la del servidor', () => {
    // 2026-08-30T08:30:00Z = 4:30 AM en Caracas -> jornada del 29
    expect(fechaDeJornada(new Date('2026-08-30T08:30:00Z'))).toBe('290826');
    // 2026-08-30T11:00:00Z = 7:00 AM en Caracas -> jornada del 30
    expect(fechaDeJornada(new Date('2026-08-30T11:00:00Z'))).toBe('300826');
  });

  it('el corte por defecto es a las 6, igual que el cierre de caja', () => {
    expect(OPERACION_DEFAULT.businessDayStartHour).toBe(6);
  });
});

describe('formatearNumeroOrden', () => {
  it('rellena el correlativo a cuatro digitos', () => {
    expect(formatearNumeroOrden('290826', 1)).toBe('290826-0001');
    expect(formatearNumeroOrden('290826', 47)).toBe('290826-0047');
    expect(formatearNumeroOrden('290826', 1234)).toBe('290826-1234');
  });

  // Mas vale un numero de cinco cifras que dos ordenes con el mismo numero.
  it('pasados los 9999 no recorta ni repite', () => {
    expect(formatearNumeroOrden('290826', 10000)).toBe('290826-10000');
  });
});
