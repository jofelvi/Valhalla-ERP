/**
 * Mano de obra de un plato: cuanto cuesta el TIEMPO de quien lo prepara.
 *
 * El costo teorico de un plato solo contaba los ingredientes, asi que una pizza
 * y un vaso de agua costaban "lo que pesan". Pero el pizzero cobra sueldo igual:
 * si una pizza le toma 12 minutos y el agua 0, el margen real de las dos no se
 * parece en nada al que muestra el sistema.
 *
 * `salary` en `employees` es MENSUAL (misma convencion que la nomina:
 * semanal = salary/4, diario = /7 — ver `staffDailyRate` en el web).
 */

/** Jornada por defecto del restaurante. Configurable en `configs/labor_cost`. */
export const HORAS_POR_DIA_POR_DEFECTO = 8;
export const DIAS_POR_SEMANA = 7;
export const SEMANAS_POR_MES = 4;

/** Costo de un minuto de esa persona, en USD. */
export function costoPorMinuto(
  salarioMensual: number,
  horasPorDia: number = HORAS_POR_DIA_POR_DEFECTO,
): number {
  if (!Number.isFinite(salarioMensual) || salarioMensual <= 0) return 0;
  if (!Number.isFinite(horasPorDia) || horasPorDia <= 0) return 0;

  const semanal = salarioMensual / SEMANAS_POR_MES;
  const diario = semanal / DIAS_POR_SEMANA;
  return diario / horasPorDia / 60;
}

/**
 * Costo de mano de obra de UNA unidad del plato.
 *
 * Se redondea a 4 decimales igual que el costo de ingredientes: con minutos
 * cortos el numero es de centesimas de dolar y truncar antes lo volveria cero.
 */
export function costoManoDeObra(
  minutosDePreparacion: number,
  salarioMensual: number,
  horasPorDia: number = HORAS_POR_DIA_POR_DEFECTO,
): number {
  if (!Number.isFinite(minutosDePreparacion) || minutosDePreparacion <= 0) {
    return 0;
  }
  const porMinuto = costoPorMinuto(salarioMensual, horasPorDia);
  return Math.round(minutosDePreparacion * porMinuto * 10000) / 10000;
}

/**
 * Costo total del plato = ingredientes + mano de obra.
 *
 * Se devuelve aparte y NO se mete dentro de `cost`: `cost` es lo que descuenta
 * el inventario (materia prima). Mezclar el sueldo ahi inflaria el valor del
 * inventario y el kardex dejaria de cuadrar con lo que hay en la nevera.
 */
export function costoTotalDelPlato(
  costoIngredientes: number,
  costoManoObra: number,
): number {
  const total = (costoIngredientes || 0) + (costoManoObra || 0);
  return Math.round(total * 10000) / 10000;
}
