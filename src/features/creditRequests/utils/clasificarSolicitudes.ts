import type { OrderWithCreditRequest } from '@odin6/types';

/**
 * Como esta el cobro de la orden detras de una solicitud de credito.
 *
 * Existe porque las solicitudes se quedan colgadas: el 26/09/2026, en PRE,
 * 12 de las 25 pendientes eran de ordenes YA pagadas por otra via y 4 estaban
 * pagadas en parte, con solicitudes de hasta 70 dias. Autorizar una de esas
 * crea una cuenta por cobrar por el total: el cliente queda debiendo lo que ya
 * pago. La pantalla tiene que decirlo antes de que alguien pulse "Autorizar".
 *
 * - `cobrada`: lo pagado cubre el total. Solo queda cerrar la solicitud.
 * - `parcial`: pago una parte; `falta` es lo que de verdad quedaria a credito.
 * - `sinCobrar`: el caso normal, se decide autorizar o rechazar.
 * - `enCero`: una orden de $0 no tiene nada que fiar.
 */
export type TipoDeCobro = 'cobrada' | 'parcial' | 'sinCobrar' | 'enCero';

export interface EstadoDeCobro {
  tipo: TipoDeCobro;
  pagado: number;
  falta: number;
}

/** Lo que se tolera de diferencia por redondeo de centavos. */
const CENTAVO = 0.01;

const redondear = (monto: number): number => Math.round(monto * 100) / 100;

export const estadoDeCobro = (s: OrderWithCreditRequest): EstadoDeCobro => {
  const total = Number(s.total ?? 0);
  const pagoCompleto = String(s.paymentStatus ?? '').toLowerCase() === 'paid';
  // Las ordenes viejas llegan pagadas sin `paidAmount`: manda el estado.
  const pagado = redondear(
    pagoCompleto && s.paidAmount == null ? total : Number(s.paidAmount ?? 0),
  );

  if (total <= 0) return { tipo: 'enCero', pagado, falta: 0 };
  if (pagoCompleto || pagado >= total - CENTAVO) {
    return { tipo: 'cobrada', pagado: total, falta: 0 };
  }
  const falta = redondear(total - pagado);
  if (pagado > 0) return { tipo: 'parcial', pagado, falta };
  return { tipo: 'sinCobrar', pagado: 0, falta };
};

/** Solo `sinCobrar` se puede autorizar sin cobrar de mas. */
export const sePuedeAutorizar = (estado: EstadoDeCobro): boolean =>
  estado.tipo === 'sinCobrar';

/** Cuando la pidio el mesonero; si no quedo guardado, cuando se abrio la orden. */
export const fechaDeSolicitud = (s: OrderWithCreditRequest): Date =>
  new Date(s.creditRequest?.requestedAt || s.createdAt);

const inicioDelDia = (fecha: Date): number =>
  new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()).getTime();

/** Dias de calendario entre la solicitud y hoy (0 = hoy). */
export const diasDeAntiguedad = (fecha: Date, ahora: Date): number =>
  Math.round((inicioDelDia(ahora) - inicioDelDia(fecha)) / 86_400_000);

export interface FilaDeSolicitud {
  solicitud: OrderWithCreditRequest;
  cobro: EstadoDeCobro;
  fecha: Date;
  dias: number;
}

export interface GrupoDeCliente {
  /** customerId, o el nombre cuando la orden no trae cliente enlazado. */
  clave: string;
  nombre: string;
  filas: FilaDeSolicitud[];
  /** Suma de lo que de verdad quedaria a credito (sin lo ya cobrado). */
  porCobrar: number;
  /** Cuantas son de ordenes ya cobradas o en $0: solo queda cerrarlas. */
  cobradas: number;
  diasMasVieja: number;
}

const yaResuelta = (fila: FilaDeSolicitud): boolean =>
  fila.cobro.tipo === 'cobrada' || fila.cobro.tipo === 'enCero';

/**
 * Junta las solicitudes por cliente. Arriba van los grupos que tienen algo
 * por decidir y, entre ellos, los de la solicitud mas vieja; dentro de cada
 * grupo, la mas reciente primero.
 */
export const agruparPorCliente = (
  solicitudes: OrderWithCreditRequest[],
  ahora: Date,
): GrupoDeCliente[] => {
  const grupos = new Map<string, GrupoDeCliente>();

  for (const solicitud of solicitudes) {
    const fecha = fechaDeSolicitud(solicitud);
    const fila: FilaDeSolicitud = {
      solicitud,
      cobro: estadoDeCobro(solicitud),
      fecha,
      dias: diasDeAntiguedad(fecha, ahora),
    };
    const clave =
      solicitud.customerId || solicitud.customerName || 'sin-cliente';
    const grupo = grupos.get(clave) ?? {
      clave,
      nombre: solicitud.customerName || 'Sin cliente',
      filas: [],
      porCobrar: 0,
      cobradas: 0,
      diasMasVieja: 0,
    };
    grupo.filas.push(fila);
    if (yaResuelta(fila)) grupo.cobradas += 1;
    else grupo.porCobrar = redondear(grupo.porCobrar + fila.cobro.falta);
    grupo.diasMasVieja = Math.max(grupo.diasMasVieja, fila.dias);
    grupos.set(clave, grupo);
  }

  const lista = [...grupos.values()];
  for (const grupo of lista) {
    grupo.filas.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
  }
  const pendiente = (g: GrupoDeCliente) => g.cobradas < g.filas.length;
  return lista.sort(
    (a, b) =>
      Number(pendiente(b)) - Number(pendiente(a)) ||
      b.diasMasVieja - a.diasMasVieja,
  );
};

/** Hay algo que decidir: la orden no esta cobrada ni en $0. */
export const esPorDecidir = (s: OrderWithCreditRequest): boolean => {
  const { tipo } = estadoDeCobro(s);
  return tipo === 'sinCobrar' || tipo === 'parcial';
};
