import { OperacionConfig, OPERACION_DEFAULT } from '@odin6/types';
import { diaDeNegocio } from '../../common/operacion/operacion.util';

/**
 * Numero de orden diario que canta cocina.
 *
 * Formato: `DDMMAA-NNNN` — por ejemplo `290826-0001`. Los seis primeros
 * digitos son la fecha de la JORNADA y los cuatro ultimos el correlativo de
 * ese dia, empezando en 0001.
 *
 * Antes el numero eran los ultimos 8 caracteres del id de Mongo
 * (`A1B2C3D4`): no dice nada, no se puede cantar en voz alta y dos ordenes
 * seguidas no se parecen en nada. Ademas solo lo tenian las ordenes creadas
 * desde el POS web — de 25 ordenes de un dia, 4 lo llevaban.
 */

/**
 * Fecha de la jornada a la que pertenece un momento dado, como `DDMMAA`.
 *
 * Un pedido de las 2 de la mañana pertenece a la jornada del dia ANTERIOR:
 * el turno no ha cerrado todavia. El corte y la zona vienen de `operacion`
 * (la misma utilidad que usa la caja), no de constantes del codigo.
 */
export function fechaDeJornada(
  fecha: Date = new Date(),
  operacion: OperacionConfig = OPERACION_DEFAULT,
): string {
  const [anio, mes, dia] = diaDeNegocio(fecha, operacion).split('-');
  return `${dia}${mes}${anio.slice(-2)}`;
}

/** `290826-0001`. El correlativo se rellena a 4 digitos. */
export function formatearNumeroOrden(
  fechaJornada: string,
  correlativo: number,
): string {
  const n = Math.max(1, Math.floor(correlativo));
  // Pasados los 9999 pedidos en un dia se deja crecer el numero en vez de
  // recortarlo: es preferible un numero largo a dos ordenes con el mismo.
  return `${fechaJornada}-${String(n).padStart(4, '0')}`;
}
