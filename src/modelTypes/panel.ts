/**
 * Lo que devuelve `/api/analytics/panel/*`.
 *
 * Cada tarjeta del panel tiene su endpoint y su tipo. Antes el panel bajaba
 * las cuatro colecciones completas (14,35 MB) y calculaba en el navegador, con
 * un criterio distinto por tarjeta — por eso la venta del dia y el ranking de
 * mesoneros nunca coincidian.
 */

export interface PeriodoDelPanel {
  /** ISO. Inclusivo. */
  desde: string;
  /** ISO. EXCLUSIVO. */
  hasta: string;
  /** "Hoy", "Esta semana"... */
  etiqueta: string;
}

export interface VentasDelPanel {
  periodo: PeriodoDelPanel;
  /** Facturado en el periodo, se haya cobrado o no. Sin propina. */
  venta: number;
  ordenes: number;
  /** Lo que de verdad entro, calculado desde los PAGOS y sin propina. */
  cobrado: number;
  /** Propina que entro con esos pagos. Es del mesonero, no del negocio. */
  propinaCobrada: number;
  /** Propina total, incluida la de cuentas aun sin cobrar. */
  propinaTotal: number;
  porCobrar: number;
  socios: { monto: number; ordenes: number };
  comparacion: {
    etiqueta: string;
    venta: number;
    /** null cuando no hay base contra la que comparar (periodo previo en 0). */
    variacionPct: number | null;
  } | null;
}

export interface DetalleDeMetodo {
  etiqueta: string;
  monto: number;
  /** Valor nominal en la moneda real, cuando no es USD (bolivares). */
  nominal?: { moneda: string; monto: number };
}

export interface MetodoDePago {
  clave: string;
  etiqueta: string;
  /** Lo que entro por ese metodo, propina incluida: contra esto cuadra el banco. */
  bruto: number;
  venta: number;
  propina: number;
  pagos: number;
  /** Desglose interno, cuando el metodo agrupa varias monedas o variantes. */
  detalle?: DetalleDeMetodo[];
}

export interface MetodosDePagoDelPanel {
  periodo: PeriodoDelPanel;
  metodos: MetodoDePago[];
  /** TODO lo que entro en el periodo, se haya vendido cuando se haya vendido. */
  totalEntro: number;
  /** La parte de `totalEntro` que viene de ordenes nacidas en el periodo. */
  totalDeVentas: number;
  totalVenta: number;
  totalPropina: number;
  bolivaresNominal: number;
  credito: { monto: number; cuentas: number };
  creditoSocios: { monto: number; cuentas: number };
  otrosPeriodos: {
    deOrdenesAnteriores: number;
    deCartera: number;
    sinOrden: number;
    pagos: number;
  };
  descuentoNomina: number;
}

export interface DiaDeVenta {
  dia: string;
  etiqueta: string;
  venta: number;
  ordenes: number;
}

export interface VentaPorDiaDelPanel {
  periodo: PeriodoDelPanel;
  dias: DiaDeVenta[];
}

export interface ProductoDelRanking {
  productId: string;
  nombre: string;
  cantidad: number;
  venta: number;
}

export interface TopProductosDelPanel {
  periodo: PeriodoDelPanel;
  productos: ProductoDelRanking[];
}

export interface MesoneroDelRanking {
  waiterId: string;
  nombre: string;
  ordenes: number;
  venta: number;
  ticketPromedio: number;
}

export interface TopMesonerosDelPanel {
  periodo: PeriodoDelPanel;
  mesoneros: MesoneroDelRanking[];
}

export interface OrdenReciente {
  id: string;
  numero: string;
  total: number;
  mesonero: string | null;
  mesa: string | null;
  estado: string;
  estadoPago: string;
  /** ISO. */
  cuando: string;
}
