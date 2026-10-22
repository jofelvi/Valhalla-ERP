/**
 * Reglas de dinero. Fuente única para API, web POS y app móvil.
 *
 * Por qué existe: el servicio estaba escrito a mano como `* 0.1` en más de once lugares.
 * Nadie era dueño de la regla: si pasaba a 12 %, había que encontrar los once y no fallar en
 * ninguno. Ahora la tarifa es CONFIGURACIÓN (`TarifasConfig`, `NominaConfig`) y toda
 * pantalla, ticket y reporte llama a estas funciones. Ningún cliente multiplica por una
 * constante.
 *
 * Todas aceptan la configuración como último parámetro; sin ella usan los valores neutros
 * (`TARIFAS_DEFAULT`: servicio adicional de 10 % solo con mesonero, sin impuesto).
 */
import { NOMINA_DEFAULT, NominaConfig } from '../config/nomina';
import { ServiceMode, TARIFAS_DEFAULT, TarifasConfig } from '../config/tarifas';

const redondear = (n: number): number =>
  Math.round((n + Number.EPSILON) * 100) / 100;

/** ¿Aplica servicio a esta orden según la configuración y si tiene mesonero? */
function aplicaServicio(tieneMesonero: boolean, tarifas: TarifasConfig): boolean {
  if (tarifas.serviceMode === 'none') return false;
  return tieneMesonero || !tarifas.serviceOnlyWithWaiter;
}

/**
 * Servicio que se SUMA a la cuenta. Solo existe en modo `additional`; en `included` los
 * precios ya lo traen (ver `servicioIncluido` en `computeOrderTotals`).
 */
export function calcularServiceCharge(
  subtotal: number,
  tieneMesonero: boolean,
  tarifas: TarifasConfig = TARIFAS_DEFAULT,
): number {
  if (tarifas.serviceMode !== 'additional') return 0;
  if (!aplicaServicio(tieneMesonero, tarifas) || !(subtotal > 0)) return 0;
  return redondear(subtotal * tarifas.serviceRate);
}

/**
 * Comisión del mesonero a partir de la base que devuelve `computeOrderTotals`
 * (`comisionBase`). Es la única fórmula de comisión del sistema.
 */
export function calcularComision(
  comisionBase: number,
  nomina: NominaConfig = NOMINA_DEFAULT,
): number {
  return redondear(Math.max(0, comisionBase) * nomina.commissionRate);
}

/**
 * Total de una orden a partir de sus partes.
 *
 * Las cortesías entran a precio pleno en el subtotal y se restan aparte, para que el consumo
 * real quede visible en los reportes.
 */
export function calcularTotalOrden({
  subtotal,
  serviceCharge = 0,
  tax = 0,
  noChargeAmount = 0,
}: {
  subtotal: number;
  serviceCharge?: number;
  tax?: number;
  noChargeAmount?: number;
}): number {
  return redondear(subtotal + serviceCharge + tax - noChargeAmount);
}

/** Lo mínimo que este modelo necesita de una línea de la orden. */
export interface LineaDeOrden {
  total?: unknown;
  noCharge?: unknown;
  discountAmount?: unknown;
  cancelledAt?: unknown;
}

export interface TotalesDeOrden {
  subtotal: number;
  /** Servicio SUMADO a la cuenta (0 si el modo no es `additional`). */
  serviceCharge: number;
  /** Servicio que ya viene dentro de los precios (solo modo `included`). Informativo. */
  servicioIncluido: number;
  noChargeAmount: number;
  discountAmount: number;
  /** Impuesto de la orden. Se suma al total salvo que `ivaIncluido` sea true. */
  tax: number;
  total: number;
  /**
   * Base sobre la que se paga la comisión del mesonero: ventas atribuibles (consumo menos
   * descuentos y, si la nómina lo pide, menos cortesías) o el servicio de esa venta, según
   * `NominaConfig.commissionBasis`. La comisión es `calcularComision(comisionBase, nomina)`.
   * 0 si la orden no tiene mesonero.
   */
  comisionBase: number;
  /** Tarifas con las que se calculó: se guardan en la orden para que un cambio de tarifa no reescriba el pasado. */
  tasaServicio: number;
  modoServicio: ServiceMode;
  tasaIva: number;
  ivaIncluido: boolean;
}

const num = (v: unknown): number => Number(v) || 0;

/**
 * EL modelo de cálculo del dinero de una orden. Fuente única.
 *
 *   subtotal       = Σ ítems vivos a PRECIO PLENO (cortesías incluidas)
 *   noChargeAmount = Σ cortesías
 *   discountAmount = Σ descuentos aplicados por un admin
 *   servicio       = (subtotal − descuentos) × tasa      [modo additional, y solo con mesonero si así se configuró]
 *   impuesto       = según `tarifas.tax` (sumado o incluido)
 *   total          = subtotal + servicio + impuesto sumado − cortesías − descuentos
 *
 * La cortesía NO baja la base del servicio (lo que el cliente paga) y el descuento SÍ.
 * La cortesía SÍ baja la comisión si `excludeComplimentaryFromCommission` (la casa invita:
 * no entra dinero real que repartir).
 *
 * Vive aquí y no en la API porque la web y el móvil tienen que calcular igual: cuando cada
 * pantalla reescribía la aritmética, un descuento aprobado con PIN se revertía solo.
 */
export function computeOrderTotals(
  items: LineaDeOrden[],
  hadWaiter: boolean,
  tarifas: TarifasConfig = TARIFAS_DEFAULT,
  nomina: NominaConfig = NOMINA_DEFAULT,
): TotalesDeOrden {
  const vivos = (items ?? []).filter((it) => !it.cancelledAt);

  const subtotal = vivos.reduce((s, it) => s + num(it.total), 0);
  const noChargeAmount = vivos
    .filter((it) => it.noCharge === true)
    .reduce((s, it) => s + num(it.total), 0);
  const discountAmount = vivos.reduce((s, it) => s + num(it.discountAmount), 0);

  const baseServicio = Math.max(0, subtotal - discountAmount);
  const conServicio = aplicaServicio(hadWaiter, tarifas) && baseServicio > 0;

  const serviceCharge = calcularServiceCharge(baseServicio, hadWaiter, tarifas);
  const servicioIncluido =
    tarifas.serviceMode === 'included' && conServicio
      ? redondear(baseServicio - baseServicio / (1 + tarifas.serviceRate))
      : 0;

  const baseImpuesto = Math.max(
    0,
    subtotal -
      noChargeAmount -
      discountAmount +
      (tarifas.tax.appliesToService ? serviceCharge : 0),
  );
  const tax = tarifas.tax.enabled
    ? redondear(
        tarifas.tax.includedInPrice
          ? baseImpuesto - baseImpuesto / (1 + tarifas.tax.rate)
          : baseImpuesto * tarifas.tax.rate,
      )
    : 0;
  const taxSumado = tarifas.tax.enabled && !tarifas.tax.includedInPrice ? tax : 0;

  const ventasAtribuibles = hadWaiter
    ? Math.max(
        0,
        subtotal -
          (nomina.excludeComplimentaryFromCommission ? noChargeAmount : 0) -
          discountAmount,
      )
    : 0;
  const comisionBase =
    nomina.commissionBasis === 'service'
      ? ventasAtribuibles * tarifas.serviceRate
      : ventasAtribuibles;

  return {
    subtotal: redondear(subtotal),
    serviceCharge: redondear(serviceCharge),
    servicioIncluido,
    noChargeAmount: redondear(noChargeAmount),
    discountAmount: redondear(discountAmount),
    tax,
    total: redondear(
      subtotal + serviceCharge + taxSumado - noChargeAmount - discountAmount,
    ),
    comisionBase: redondear(comisionBase),
    tasaServicio: tarifas.serviceRate,
    modoServicio: tarifas.serviceMode,
    tasaIva: tarifas.tax.enabled ? tarifas.tax.rate : 0,
    ivaIncluido: tarifas.tax.includedInPrice,
  };
}

/** Número de factura. Estaba escrito en tres lugares con implementaciones apenas distintas. */
export function generarNumeroFactura(orderId: string, ahora: number): string {
  const ts = String(ahora).slice(-8);
  const last4 = orderId.slice(-4).toUpperCase();
  return `FAC-${ts}-${last4}`;
}
