import { r2 } from './money';

/**
 * Que deberia quedar despues de la semana.
 *
 * El informe de gastos contaba lo que SALIO y nada de lo que entro, asi que no
 * se podia responder la pregunta que el dueño hace de verdad: "¿cuanto deberia
 * haber en la cuenta?". Aca se cruzan las tres piezas, que hasta ahora vivian
 * en tres sitios que no se hablaban: lo cobrado (panel), los gastos (este
 * modulo) y la nomina (coleccion `payrolls`, que NO pasa por el libro de
 * egresos).
 *
 * Dos reglas del dueño, del 21/09/2026, que explican la forma de esto:
 *
 * 1. **Todo gasto pagado sale del banco**, sin importar si el fondo fue de
 *    Negocio o de un socio. El gasto no guarda con que instrumento se pago
 *    (el schema tiene `fundsSource`, no medio de pago), asi que cualquier
 *    reparto banco/efectivo seria adivinado. Se asume banco y se dice.
 * 2. **El efectivo se muestra pero no se le resta nada**: es lo que entro por
 *    la gaveta, y se arquea contra la gaveta.
 *
 * El total y el desglose por metodo son los MISMOS que la tarjeta "Entró en
 * caja" del panel web, a proposito: los socios miran las dos cosas y dos cifras
 * distintas para lo mismo es una discusion garantizada (dueño, 22/09/2026).
 *
 * La propina entra al banco (viene dentro del punto de venta y el pago movil) y
 * sale por la nomina, que la paga. Por eso no se descuenta aparte: ya esta
 * contada de los dos lados.
 */

/** Un metodo de cobro tal como lo agrupa el panel. */
export interface CobroPorMetodo {
  clave: string;
  etiqueta: string;
  /** Lo que vio el banco: con propina. */
  bruto: number;
  propina: number;
  /** Divisa y bolivares, en el caso del efectivo. Igual que en el panel web. */
  detalle?: Array<{ etiqueta: string; monto: number }>;
}

/**
 * Lo que se pago de nomina en la semana.
 *
 * El desglose CIERRA a proposito: `dias + comisiones + propinas + bonos −
 * descuentos = neto`. La pantalla de nomina muestra cuatro de estas cinco
 * lineas y se come los bonos, por eso ahi los numeros no suman (480 + 151,19 +
 * 54,20 − 56,83 da 628,56, pero se transfirieron 653,25: faltaban 24,70 de bono
 * de pizza — medido el 21/09/2026).
 */
/** Lo que cobro una persona, sin abrir en sueldo/comision/propina. */
export interface PagoATrabajador {
  nombre: string;
  cargo?: string;
  neto: number;
  pagos: number;
  /** Foto de la transferencia, servida publica desde /uploads. */
  reciboUrl?: string;
}

export interface NominaSemana {
  /** Dias trabajados x tarifa. */
  dias: number;
  comisiones: number;
  propinas: number;
  /** Bono del pizzero y demas agregados. */
  bonos: number;
  /** Consumos del personal y abonos de prestamo, descontados del sueldo. */
  descuentos: number;
  /** Lo que efectivamente se le transfirio a la gente. */
  neto: number;
  pagos: number;
  /** Una fila por persona, con el comprobante de su pago. */
  porTrabajador: PagoATrabajador[];
}

export interface CajaSemana {
  /**
   * Lo que habia en el banco al abrir la semana, cargado a mano por el dueño
   * (`weekly_balances`). Sin el, la caja arrancaba en cero y el "deberia
   * quedar" solo respondia "de lo de esta semana", que no es lo que se arquea
   * contra el banco. Undefined = nadie lo cargo: el informe omite la linea en
   * vez de inventar un cero.
   */
  saldoInicial?: number;
  /** Punto de venta + pago movil + transferencia. */
  entroBanco: number;
  /** Divisa + bolivares de la gaveta. */
  entroEfectivo: number;
  entroTotal: number;
  /** De todo lo que entro, cuanto es propina del mesonero. */
  propina: number;
  metodos: CobroPorMetodo[];
  /** Gastos de la semana marcados como pagados. */
  gastosPagados: number;
  nomina: NominaSemana;
  /** Saldo inicial + todo lo que entro − todo lo que salio. */
  quedaTotal: number;
  /** saldoInicial + entroBanco − gastosPagados − nomina.neto */
  quedaBanco: number;
  /** El efectivo no se toca: entra y se arquea contra la gaveta. */
  quedaEfectivo: number;
}

/** Metodos que terminan en la cuenta del banco. */
const DE_BANCO = ['punto', 'pagoMovil', 'transferencia'];
/** Lo que se queda en la gaveta. */
const DE_GAVETA = ['efectivo'];

const sumaDe = (metodos: CobroPorMetodo[], claves: string[]): number =>
  metodos
    .filter((m) => claves.includes(m.clave))
    .reduce((a, m) => a + m.bruto, 0);

export function armarCaja(args: {
  metodos: CobroPorMetodo[];
  gastosPagados: number;
  nomina: NominaSemana;
  saldoInicial?: number;
}): CajaSemana {
  const { metodos, gastosPagados, nomina, saldoInicial } = args;

  const entroBanco = r2(sumaDe(metodos, DE_BANCO));
  const entroEfectivo = r2(sumaDe(metodos, DE_GAVETA));
  // El saldo inicial es plata que ya esta en el banco: suma del lado del banco,
  // no del efectivo (la gaveta se arquea aparte, contra si misma).
  const arranque = saldoInicial ?? 0;

  return {
    saldoInicial,
    entroBanco,
    entroEfectivo,
    entroTotal: r2(entroBanco + entroEfectivo),
    propina: r2(metodos.reduce((a, m) => a + m.propina, 0)),
    metodos,
    gastosPagados: r2(gastosPagados),
    nomina,
    quedaTotal: r2(
      arranque + entroBanco + entroEfectivo - gastosPagados - nomina.neto,
    ),
    quedaBanco: r2(arranque + entroBanco - gastosPagados - nomina.neto),
    quedaEfectivo: entroEfectivo,
  };
}
