/**
 * Rangos de fecha del panel, por JORNADA y en la zona de la operación (`operacion`).
 *
 * Hasta ahora estos rangos se calculaban en el NAVEGADOR, con la hora local de la máquina que
 * abriera el panel. Eso deja de funcionar en cuanto alguien mira el panel desde otro huso: el
 * "hoy" del dueño de viaje no es el "hoy" de la caja. Aquí el corte es explícito y no depende
 * de la zona del servidor.
 *
 * La jornada del día D va de D a la hora de arranque (`businessDayStartHour`) hasta D+1 a esa
 * misma hora (fin EXCLUSIVO). El restaurante cobra pasada la medianoche: cortar a las 00:00
 * parte la noche en dos y le regala al día siguiente la mitad de la venta.
 */
import { OperacionConfig } from '@odin6/types';
import {
  diaDeNegocio,
  inicioDeJornadaDe,
  inicioDeJornada as inicioDeJornadaFecha,
  inicioDeSemana as inicioDeSemanaNegocio,
} from '../../../common/operacion/operacion.util';

export enum IntervaloPanel {
  HOY = 'today',
  AYER = 'yesterday',
  SEMANA_ACTUAL = 'currentWeek',
  SEMANA_ANTERIOR = 'previousWeek',
  MES_ACTUAL = 'currentMonth',
  MES_ANTERIOR = 'previousMonth',
}

export const INTERVALOS_VALIDOS = Object.values(IntervaloPanel);

export interface RangoPanel {
  /** Inclusivo. */
  start: Date;
  /** EXCLUSIVO: se consulta con `$lt`, no con `$lte`. */
  end: Date;
  /** Como se nombra el periodo en pantalla: "Hoy", "Esta semana"... */
  etiqueta: string;
  /** Intervalo contra el que se compara, si tiene sentido comparar. */
  comparaCon: IntervaloPanel | null;
  /** Como se nombra esa comparacion: "vs ayer", "vs semana pasada"... */
  etiquetaComparacion: string | null;
}

const ETIQUETAS: Record<IntervaloPanel, string> = {
  [IntervaloPanel.HOY]: 'Hoy',
  [IntervaloPanel.AYER]: 'Ayer',
  [IntervaloPanel.SEMANA_ACTUAL]: 'Esta semana',
  [IntervaloPanel.SEMANA_ANTERIOR]: 'Semana pasada',
  [IntervaloPanel.MES_ACTUAL]: 'Este mes',
  [IntervaloPanel.MES_ANTERIOR]: 'Mes anterior',
};

const COMPARACIONES: Partial<
  Record<IntervaloPanel, { con: IntervaloPanel; etiqueta: string }>
> = {
  [IntervaloPanel.HOY]: { con: IntervaloPanel.AYER, etiqueta: 'vs ayer' },
  [IntervaloPanel.SEMANA_ACTUAL]: {
    con: IntervaloPanel.SEMANA_ANTERIOR,
    etiqueta: 'vs semana pasada',
  },
  [IntervaloPanel.MES_ACTUAL]: {
    con: IntervaloPanel.MES_ANTERIOR,
    etiqueta: 'vs mes anterior',
  },
};

const UN_DIA_MS = 24 * 60 * 60 * 1000;

/** Suma (o resta) días a una fecha calendario `YYYY-MM-DD`. */
const sumarDias = (fecha: string, dias: number): string =>
  new Date(Date.parse(`${fecha}T00:00:00Z`) + dias * UN_DIA_MS)
    .toISOString()
    .slice(0, 10);

/** Inicio de la semana del panel (lunes por defecto, según `weekStartsOn`). */
/** Inicio de la jornada a la que pertenece `instante` (la usa el panel y el resumen de órdenes). */
export const inicioDeJornada = (instante: Date, op: OperacionConfig): Date =>
  inicioDeJornadaDe(instante, op);

export const inicioDeSemana = (instante: Date, op: OperacionConfig): Date =>
  inicioDeSemanaNegocio(instante, op);

/** Día 1 a la hora de arranque, del mes al que pertenece `instante` (+ desplazamiento). */
export function inicioDeMes(
  instante: Date,
  op: OperacionConfig,
  desplazamiento = 0,
): Date {
  const [anio, mes] = diaDeNegocio(instante, op).split('-').map(Number);
  const primero = new Date(Date.UTC(anio, mes - 1 + desplazamiento, 1))
    .toISOString()
    .slice(0, 10);
  return inicioDeJornadaFecha(primero, op);
}

/** Etiqueta `YYYY-MM-DD` de la jornada, para agrupar por dia. */
export function etiquetaDeJornada(instante: Date, op: OperacionConfig): string {
  return diaDeNegocio(instante, op);
}

/** true si el texto es uno de los intervalos que el panel entiende. */
export function esIntervaloValido(valor: unknown): valor is IntervaloPanel {
  return (
    typeof valor === 'string' &&
    (INTERVALOS_VALIDOS as string[]).includes(valor)
  );
}

/** Suma jornadas completas a un instante (24 h cada una). */
export const sumarJornadas = (inicio: Date, dias: number): Date =>
  new Date(inicio.getTime() + dias * UN_DIA_MS);

/** Rango de `dias` jornadas completas a partir de la jornada `dia`. */
const rangoDeDias = (dia: string, dias: number, op: OperacionConfig) => ({
  start: inicioDeJornadaFecha(dia, op),
  end: inicioDeJornadaFecha(sumarDias(dia, dias), op),
});

/**
 * Rango de un intervalo del panel.
 *
 * `ahora` es parámetro para poder probarlo: sin él, los tests dependerían del reloj de quien
 * los corre.
 */
export function rangoDe(
  intervalo: IntervaloPanel,
  op: OperacionConfig,
  ahora: Date = new Date(),
): RangoPanel {
  const comparacion = COMPARACIONES[intervalo] ?? null;
  const base = {
    etiqueta: ETIQUETAS[intervalo],
    comparaCon: comparacion?.con ?? null,
    etiquetaComparacion: comparacion?.etiqueta ?? null,
  };
  const hoy = diaDeNegocio(ahora, op);
  const diaSemana = diaDeNegocio(inicioDeSemana(ahora, op), op);

  switch (intervalo) {
    case IntervaloPanel.HOY:
      return { ...base, ...rangoDeDias(hoy, 1, op) };

    case IntervaloPanel.AYER:
      return { ...base, ...rangoDeDias(sumarDias(hoy, -1), 1, op) };

    case IntervaloPanel.SEMANA_ACTUAL:
      return { ...base, ...rangoDeDias(diaSemana, 7, op) };

    case IntervaloPanel.SEMANA_ANTERIOR:
      return { ...base, ...rangoDeDias(sumarDias(diaSemana, -7), 7, op) };

    case IntervaloPanel.MES_ACTUAL:
      return {
        ...base,
        start: inicioDeMes(ahora, op),
        end: inicioDeMes(ahora, op, 1),
      };

    case IntervaloPanel.MES_ANTERIOR:
      return {
        ...base,
        start: inicioDeMes(ahora, op, -1),
        end: inicioDeMes(ahora, op),
      };

    default:
      return rangoDe(IntervaloPanel.HOY, op, ahora);
  }
}
