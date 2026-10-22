import type { OperacionConfig } from '@odin6/types';
import type { TelegramBotConfig } from './telegram-config.service';
import {
  fechaCalendario,
  instanteDePared,
  paredEnZona,
  primerDiaDeSemanaDe,
} from '../../common/operacion/operacion.util';

/**
 * Cuanto despues de la hora configurada se sigue aceptando el semanal.
 *
 * El tick corre cada 5 minutos, asi que comparar la hora exacta alcanzaba
 * mientras el disparo era "a las 8" (una ventana de 60 minutos). Con 23:59 la
 * ventana dura un minuto y el tick la pierde 4 de cada 5 lunes. Con el margen
 * el disparo es un INSTANTE y el primer tick que lo pase manda el informe; los
 * siguientes los descarta `telegram_sent_reports`, que guarda el id.
 *
 * Dos horas: cubre la noche entera del lunes sin mandar el informe a medio
 * martes si el proceso estuvo caido.
 */
const MARGEN_MS = 2 * 3600_000;

export interface ReporteVencido {
  id: string;
  kind: 'weekly' | 'daily';
}

/**
 * Que informe toca AHORA. El service descarta los que ya se mandaron
 * (telegram_sent_reports), asi dos ticks seguidos o un restart no duplican el
 * mensaje.
 *
 * No hay "catch-up": si el proceso estuvo caido toda la ventana, ese informe se
 * salta (es deliberado, no se manda fuera de hora).
 *
 * El id del semanal lleva la fecha del LUNES, no la del dia en que se manda:
 * con el disparo a las 23:59 el tick que lo alcanza puede caer ya el martes, y
 * un id distinto haria que el mismo informe saliera dos veces.
 */
export function reportesVencidos(
  now: Date,
  config: Pick<
    TelegramBotConfig,
    'weeklyReportHourVe' | 'weeklyReportMinuteVe' | 'dailySummaryHourVe'
  >,
  op: OperacionConfig,
): ReporteVencido[] {
  const dia = fechaCalendario(now, op);
  const hora = paredEnZona(now, op.timezone).hora;
  const out: ReporteVencido[] = [];

  // El informe semanal sale el primer día de la semana de negocio, a la hora configurada.
  const inicioSemana = primerDiaDeSemanaDe(dia, op.weekStartsOn);
  const [anio, mes, diaInicio] = inicioSemana.split('-').map(Number);
  const objetivo = instanteDePared(
    anio,
    mes,
    diaInicio,
    config.weeklyReportHourVe,
    config.weeklyReportMinuteVe ?? 0,
    op.timezone,
  );
  const desdeObjetivo = now.getTime() - objetivo.getTime();
  if (desdeObjetivo >= 0 && desdeObjetivo < MARGEN_MS)
    out.push({ id: `weekly:${inicioSemana}`, kind: 'weekly' });

  if (config.dailySummaryHourVe !== null && hora === config.dailySummaryHourVe)
    out.push({ id: `daily:${dia}`, kind: 'daily' });
  return out;
}
