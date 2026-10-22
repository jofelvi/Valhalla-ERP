import {
  NOMINA_DEFAULT,
  NominaConfig,
  ServiceMode,
  TARIFAS_DEFAULT,
  TarifasConfig,
  TotalesDeOrden,
} from '@odin6/types';

/**
 * Configuración con la que se calcula una orden: tarifas (servicio, impuesto) y nómina
 * (comisión). Es el juego de reglas que el servidor aplica al dinero.
 */
export interface ConfigDeCalculo {
  tarifas: TarifasConfig;
  nomina: NominaConfig;
}

/** Lo que una orden guardada conserva de sus tarifas (ver `camposDeTotales`). */
export interface TasasGuardadas {
  tasaServicio?: number | null;
  modoServicio?: ServiceMode | null;
  tasaIva?: number | null;
  ivaIncluido?: boolean | null;
  configAplicada?: Partial<ConfigDeCalculo> | null;
}

/**
 * Configuración con la que se recalcula una orden YA EXISTENTE.
 *
 * Regla de oro: cambiar la tarifa jamás reescribe una orden creada. Por eso aquí nunca se
 * lee la configuración vigente, sino lo que la orden guardó al nacer:
 *  - Órdenes nuevas (con `configAplicada`): se usa esa copia entera.
 *  - Órdenes anteriores a la configuración (sin copia): se reconstruyen con las tasas que sí
 *    guardaron y, para lo demás, los valores neutros. Nunca los vigentes.
 */
export function configDeOrden(
  orden: TasasGuardadas | null | undefined,
): ConfigDeCalculo {
  const snap = orden?.configAplicada;
  if (snap?.tarifas && snap.nomina) {
    return { tarifas: snap.tarifas, nomina: snap.nomina };
  }

  const d = TARIFAS_DEFAULT;
  const tarifas: TarifasConfig = {
    ...d,
    serviceMode: orden?.modoServicio ?? d.serviceMode,
    serviceRate: orden?.tasaServicio ?? d.serviceRate,
    tax: {
      ...d.tax,
      enabled: (orden?.tasaIva ?? 0) > 0,
      rate: orden?.tasaIva || d.tax.rate,
      includedInPrice: orden?.ivaIncluido ?? d.tax.includedInPrice,
    },
  };
  return { tarifas, nomina: snap?.nomina ?? NOMINA_DEFAULT };
}

/**
 * Campos que la orden persiste al calcularse. `configAplicada` es la copia completa de la
 * configuración usada: es lo que permite recalcularla igual después.
 */
export function camposDeTotales(
  t: TotalesDeOrden,
  config: ConfigDeCalculo,
): Partial<TotalesDeOrden> & {
  total: number;
  configAplicada: ConfigDeCalculo;
} {
  return {
    subtotal: t.subtotal,
    serviceCharge: t.serviceCharge,
    servicioIncluido: t.servicioIncluido,
    noChargeAmount: t.noChargeAmount,
    discountAmount: t.discountAmount,
    tax: t.tax,
    total: t.total,
    comisionBase: t.comisionBase,
    tasaServicio: t.tasaServicio,
    modoServicio: t.modoServicio,
    tasaIva: t.tasaIva,
    ivaIncluido: t.ivaIncluido,
    configAplicada: config,
  };
}

/**
 * Tasa de comisión de una orden existente: la que guardó al nacer. Sin copia, la neutra.
 */
export function nominaDeOrden(
  orden: Pick<TasasGuardadas, 'configAplicada'> | null | undefined,
): NominaConfig {
  return orden?.configAplicada?.nomina ?? NOMINA_DEFAULT;
}

/**
 * Diferencias entre lo que mandó el cliente y lo que calculó el servidor, en forma de
 * mensajes para el log. El servidor manda: esto solo deja rastro de los clientes viejos
 * que todavía calculan por su cuenta. Un campo que no llegó no cuenta como diferencia.
 */
export function diferenciasConCliente(
  enviado: { serviceCharge?: unknown; tax?: unknown; total?: unknown },
  calculado: Pick<TotalesDeOrden, 'serviceCharge' | 'tax' | 'total'>,
): string[] {
  const TOLERANCIA = 0.01;
  const campos = [
    ['serviceCharge', enviado.serviceCharge, calculado.serviceCharge],
    ['tax', enviado.tax, calculado.tax],
    ['total', enviado.total, calculado.total],
  ] as const;

  const diffs: string[] = [];
  for (const [nombre, valor, servidor] of campos) {
    if (valor === undefined || valor === null) continue;
    const cliente = Number(valor);
    if (!Number.isFinite(cliente)) continue;
    if (Math.abs(cliente - servidor) > TOLERANCIA) {
      diffs.push(`${nombre} cliente=${cliente} servidor=${servidor}`);
    }
  }
  return diffs;
}
