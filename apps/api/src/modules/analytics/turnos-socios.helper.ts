/**
 * Rotacion semanal de socios. Es la MISMA regla para ventas (cobros
 * incompletos) y para gastos (bot de Telegram): si cada pantalla calculara la
 * semana por su cuenta, un gasto del lunes caeria en una semana y la venta de
 * esa misma noche en otra.
 */
export interface TurnosSocios {
  ciclo: string[];
  /** ISO de un martes 6am VE (10:00Z) del que se cuenta la rotacion. */
  ancla: string;
  /** Posicion en `ciclo` del socio que administro la semana del ancla. */
  anclaIndice: number;
  /** `{ 'YYYY-MM-DD del martes': 'Socio' }` para intercambios puntuales. */
  excepciones: Record<string, string>;
}

const SEMANA_MS = 7 * 86400000;

/** Mayor `ancla + k*7d` que sea <= date. Funciona hacia atras del ancla tambien. */
export function inicioDeSemana(date: Date, ancla: string): Date {
  const a = new Date(ancla).getTime();
  const k = Math.floor((date.getTime() - a) / SEMANA_MS);
  return new Date(a + k * SEMANA_MS);
}

export function socioDe(
  weekStart: Date,
  turnos: TurnosSocios,
): { socio: string; estimado: boolean } {
  const clave = weekStart.toISOString().slice(0, 10);
  const manual = turnos.excepciones[clave];
  if (manual) return { socio: manual, estimado: false };

  const semanas = Math.round(
    (weekStart.getTime() - new Date(turnos.ancla).getTime()) / SEMANA_MS,
  );
  const n = turnos.ciclo.length;
  const idx = (((turnos.anclaIndice + semanas) % n) + n) % n;
  return { socio: turnos.ciclo[idx], estimado: true };
}
