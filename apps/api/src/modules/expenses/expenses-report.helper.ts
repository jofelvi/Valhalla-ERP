import { ExpenseLean, ExpenseKind } from './schemas/expense.schema';
import { WeeklyNoteLean } from './schemas/weekly-note.schema';
import { fmtMoney, fmtStock, r2 } from './money';
import {
  armarCaja,
  CajaSemana,
  CobroPorMetodo,
  NominaSemana,
} from './caja-semana.helper';
import type { StockAhora } from './expenses.service';
import { OperacionConfig } from '@odin6/types';
import { diaMes } from '../../common/operacion/operacion.util';

export interface CompraWebSinOrigen {
  purchaseId: string;
  placeName: string;
  date: Date;
  total: number;
  totalBs?: number;
  category?: string;
}

export interface SemanaInforme {
  desde: Date;
  hasta: Date;
  socio: string;
  estimado: boolean;
}

export interface TotalMoneda {
  bs: number;
  usd: number;
}

export interface InformeSemanal {
  semana: SemanaInforme;
  total: TotalMoneda;
  /**
   * El total partido por como se pago. La cabecera decia una sola cifra que
   * mezclaba las dos, mientras la caja restaba solo lo pagado: en cuanto una
   * semana tiene un credito adentro, son dos numeros distintos para lo mismo y
   * los socios discuten cual vale (dueño, 29/09/2026).
   */
  contado: TotalMoneda;
  credito: TotalMoneda;
  porKind: Record<ExpenseKind, TotalMoneda>;
  porCategoria: Array<{
    category: string;
    total: TotalMoneda;
    cantidad: number;
  }>;
  porSocio: Array<{ socio: string; total: TotalMoneda; cantidad: number }>;
  gastos: ExpenseLean[];
  porPagar: Array<{
    supplierName: string;
    total: TotalMoneda;
    gastos: ExpenseLean[];
  }>;
  reembolsos: Array<{
    socio: string;
    total: TotalMoneda;
    gastos: ExpenseLean[];
  }>;
  comprasWebSinOrigen: CompraWebSinOrigen[];
  novedades: WeeklyNoteLean[];
  /**
   * Que entro y que deberia quedar. Opcional: el informe del dia y los tests
   * viejos no la traen, y sin ella el informe se ve igual que siempre.
   */
  caja?: CajaSemana;
}

const cero = (): TotalMoneda => ({ bs: 0, usd: 0 });
const sumar = (t: TotalMoneda, e: ExpenseLean): TotalMoneda => ({
  bs: r2(t.bs + e.amountBs),
  usd: r2(t.usd + e.amountUsd),
});

function agrupar<K extends string>(
  gastos: ExpenseLean[],
  clave: (e: ExpenseLean) => K,
): Array<{ clave: K; total: TotalMoneda; gastos: ExpenseLean[] }> {
  const mapa = new Map<
    K,
    { clave: K; total: TotalMoneda; gastos: ExpenseLean[] }
  >();
  for (const e of gastos) {
    const k = clave(e);
    const g = mapa.get(k) ?? { clave: k, total: cero(), gastos: [] };
    g.total = sumar(g.total, e);
    g.gastos.push(e);
    mapa.set(k, g);
  }
  return Array.from(mapa.values());
}

export function armarInforme(args: {
  semana: SemanaInforme;
  gastos: ExpenseLean[];
  porPagar: ExpenseLean[];
  reembolsos: ExpenseLean[];
  comprasWeb: CompraWebSinOrigen[];
  novedades: WeeklyNoteLean[];
  cobros?: CobroPorMetodo[];
  nomina?: NominaSemana;
  saldoInicial?: number;
}): InformeSemanal {
  const gastos = [...args.gastos].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );
  const porKind: Record<ExpenseKind, TotalMoneda> = {
    INSUMOS: cero(),
    GENERAL: cero(),
  };
  let total = cero();
  let contado = cero();
  let credito = cero();
  for (const e of gastos) {
    total = sumar(total, e);
    porKind[e.kind] = sumar(porKind[e.kind], e);
    if (e.paymentStatus === 'CREDIT') credito = sumar(credito, e);
    else contado = sumar(contado, e);
  }

  const porCategoria = agrupar(gastos, (e) => e.category)
    .map((g) => ({
      category: g.clave,
      total: g.total,
      cantidad: g.gastos.length,
    }))
    .sort(
      (a, b) =>
        b.total.usd - a.total.usd || a.category.localeCompare(b.category, 'es'),
    );

  // Orden de aparicion: quien registro primero en la semana sale primero.
  const porSocio = agrupar(gastos, (e) => e.registeredBy.socio).map((g) => ({
    socio: g.clave,
    total: g.total,
    cantidad: g.gastos.length,
  }));

  const porPagar = agrupar(
    args.porPagar,
    (e) => e.supplierName ?? '(sin proveedor)',
  )
    .map((g) => ({ supplierName: g.clave, total: g.total, gastos: g.gastos }))
    .sort((a, b) => b.total.usd - a.total.usd);

  const reembolsos = agrupar(
    args.reembolsos,
    (e) => e.paidBy ?? e.registeredBy.socio,
  )
    .map((g) => ({ socio: g.clave, total: g.total, gastos: g.gastos }))
    .sort((a, b) => b.total.usd - a.total.usd);

  // Solo los PAGADOS salieron de la cuenta: lo que quedo a credito todavia no
  // se toco la plata.
  const gastosPagados = r2(
    gastos
      .filter((e) => e.paymentStatus === 'PAID')
      .reduce((a, e) => a + e.amountUsd, 0),
  );

  const caja =
    args.cobros && args.nomina
      ? armarCaja({
          metodos: args.cobros,
          gastosPagados,
          nomina: args.nomina,
          saldoInicial: args.saldoInicial,
        })
      : undefined;

  return {
    semana: args.semana,
    total,
    contado,
    credito,
    porKind,
    porCategoria,
    porSocio,
    gastos,
    porPagar,
    reembolsos,
    comprasWebSinOrigen: args.comprasWeb,
    novedades: args.novedades,
    caja,
  };
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** dd/mm en la zona de la operación (configs/operacion). */
export function fechaCorta(d: Date, op: OperacionConfig): string {
  return diaMes(d, op.timezone);
}

const ambas = (t: TotalMoneda): string =>
  `${fmtMoney(t.bs, 'BS')} · ${fmtMoney(t.usd, 'USD')}`;
export const montoDe = (e: ExpenseLean): string =>
  ambas({ bs: e.amountBs, usd: e.amountUsd });
/** Lo que se muestra como "que": descripcion libre, o proveedor, o categoria. */
export const etiquetaDe = (e: ExpenseLean): string =>
  escapeHtml(e.description ?? e.supplierName ?? e.category);
const fondos = (e: ExpenseLean): string =>
  e.fundsSource === 'PROPIOS'
    ? `Propios (${escapeHtml(e.paidBy ?? '?')})`
    : e.fundsSource === 'EMPRESA'
      ? 'Negocio'
      : '—';

function lineaGasto(e: ExpenseLean, op: OperacionConfig): string {
  const credito = e.paymentStatus === 'CREDIT' ? ' <b>CRÉDITO</b>' : '';
  return `• ${fechaCorta(e.date, op)} ${etiquetaDe(e)} — ${montoDe(e)} · ${fondos(e)}${credito}`;
}

export function formatearGastoTelegram(
  e: ExpenseLean,
  stockAhora: StockAhora[],
  op: OperacionConfig,
): string {
  const que =
    e.kind === 'INSUMOS'
      ? `Insumos · ${escapeHtml(e.supplierName ?? '')}`
      : escapeHtml(e.category);
  const lineas = [
    `🧾 <b>${escapeHtml(e.registeredBy.socio)}</b> registro un gasto`,
    que,
    e.description ? escapeHtml(e.description) : null,
    `💰 ${montoDe(e)} (tasa ${String(e.exchangeRate).replace('.', ',')})`,
    e.paymentStatus === 'CREDIT'
      ? '📅 <b>CRÉDITO</b> — pendiente de pago'
      : `💵 Contado · Fondos: ${fondos(e)}`,
    stockAhora.length
      ? `📦 Stock ahora:\n${stockAhora.map((s) => `   ${escapeHtml(s.productName)}: ${fmtStock(s.qty, s.baseUnit)}`).join('\n')}`
      : null,
  ];
  return lineas.filter((l): l is string => Boolean(l)).join('\n');
}

const LIMITE = 3900;

/** Une bloques en mensajes de <= LIMITE chars; un bloque nunca se corta a la mitad de una linea. */
function partir(bloques: string[]): string[] {
  const partes: string[] = [];
  let actual = '';
  const cerrarActual = (): void => {
    // trimEnd() antes de empujar evita partes vacias (Telegram las rechaza)
    // cuando actual solo trae separadores de bloque acumulados.
    if (actual.trim()) partes.push(actual.trimEnd());
    actual = '';
  };
  for (const b of bloques) {
    for (const linea of b.split('\n')) {
      // Una linea mas larga que el limite (description libre desde la web)
      // se trocea antes de decidir donde cortar, si no nunca cabe en `actual`.
      const trozos =
        linea.length > LIMITE
          ? (linea.match(new RegExp(`.{1,${LIMITE - 1}}`, 'g')) ?? [linea])
          : [linea];
      for (const trozo of trozos) {
        if (actual.length + trozo.length + 1 > LIMITE) cerrarActual();
        actual += `${trozo}\n`;
      }
    }
    actual += '\n';
  }
  cerrarActual();
  return partes;
}

const usd = (n: number): string => fmtMoney(n, 'USD');

/**
 * La seccion que responde "¿cuanto deberia haber en la cuenta?".
 *
 * Va pegada a la cabecera porque es la pregunta que el dueño hace primero. El
 * resto del informe dice lo que SALIO; sin esto no habia con que compararlo.
 */
function bloqueCaja(caja: CajaSemana): string {
  // Mismo total, mismo orden y mismas etiquetas que la tarjeta "Entró en caja"
  // del panel web: los socios miran las dos cosas, y dos cifras distintas para
  // lo mismo es una discusion garantizada (dueño, 22/09/2026).
  const porMetodo = caja.metodos
    .filter((m) => m.bruto > 0)
    .map((m) => `   ${escapeHtml(m.etiqueta)}: ${usd(m.bruto)}`);

  const propina =
    caja.propina > 0
      ? [`Incluye ${usd(caja.propina)} de propina del mesonero.`]
      : [];

  // Solo si alguien lo cargo: un cero inventado es peor que no decir nada.
  const arranque =
    caja.saldoInicial === undefined
      ? []
      : [`Saldo inicial: ${usd(caja.saldoInicial)}`];

  return [
    ...arranque,
    `💰 <b>Entró en caja: ${usd(caja.entroTotal)}</b>`,
    ...porMetodo,
    ...propina,
    `Gastos pagados: −${usd(caja.gastosPagados)}`,
    `Nómina pagada (${caja.nomina.pagos}): −${usd(caja.nomina.neto)}`,
    `<b>Debería quedar: ${usd(caja.quedaTotal)}</b>`,
    `   en el banco: ${usd(caja.quedaBanco)}`,
    `   en efectivo: ${usd(caja.quedaEfectivo)}`,
  ].join('\n');
}

export function formatearInformeTelegram(
  inf: InformeSemanal,
  op: OperacionConfig,
): string[] {
  const { semana } = inf;
  const cabecera = [
    `📊 <b>Informe de gastos — Semana de ${escapeHtml(semana.socio)}</b>${semana.estimado ? '' : ' (ajuste manual)'}`,
    `${fechaCorta(semana.desde, op)} → ${fechaCorta(new Date(semana.hasta.getTime() - 1), op)}`,
    `Total de la semana: <b>${ambas(inf.total)}</b>`,
    `   💵 Contado (salió del banco): <b>${ambas(inf.contado)}</b>`,
    `   📅 A crédito (queda debiendo): <b>${ambas(inf.credito)}</b>`,
    `Insumos: ${ambas(inf.porKind.INSUMOS)}`,
    `Generales: ${ambas(inf.porKind.GENERAL)}`,
  ].join('\n');

  const caja = inf.caja ? bloqueCaja(inf.caja) : '';

  // Cuanto cobro cada quien, con el link al comprobante. Sin abrir en sueldo
  // ni comision: para revisar un pago basta el total y la foto.
  const trabajadores = inf.caja?.nomina.porTrabajador.length
    ? [
        '<b>Pagado a cada trabajador</b>',
        ...inf.caja.nomina.porTrabajador.map((t) => {
          const monto = usd(t.neto);
          const recibo = t.reciboUrl
            ? ` — <a href="${escapeHtml(t.reciboUrl)}">recibo</a>`
            : '';
          return `• ${escapeHtml(t.nombre)}: ${monto}${recibo}`;
        }),
      ].join('\n')
    : '';

  const categorias = inf.porCategoria.length
    ? [
        '<b>Por categoría</b>',
        ...inf.porCategoria.map(
          (c) =>
            `• ${escapeHtml(c.category)} (${c.cantidad}): ${ambas(c.total)}`,
        ),
      ].join('\n')
    : '';

  const socios = inf.porSocio.length
    ? [
        '<b>Quién registró</b>',
        ...inf.porSocio.map(
          (s) => `• ${escapeHtml(s.socio)} (${s.cantidad}): ${ambas(s.total)}`,
        ),
      ].join('\n')
    : '';

  const detalle = inf.gastos.length
    ? ['<b>Detalle</b>', ...inf.gastos.map((e) => lineaGasto(e, op))].join('\n')
    : 'Sin gastos registrados esta semana.';

  const porPagar = [
    '<b>Por pagar (todas las semanas)</b>',
    ...(inf.porPagar.length
      ? inf.porPagar.flatMap((p) => [
          `• ${escapeHtml(p.supplierName)}: ${ambas(p.total)}`,
          ...p.gastos.map(
            (e) =>
              `   ${fechaCorta(e.date, op)} ${escapeHtml(e.description ?? e.category)} — ${montoDe(e)}`,
          ),
        ])
      : ['Nada pendiente 🎉']),
  ].join('\n');

  const reembolsos = [
    '<b>Reembolsos pendientes (fondos propios)</b>',
    ...(inf.reembolsos.length
      ? inf.reembolsos.flatMap((r) => [
          `• El negocio le debe a ${escapeHtml(r.socio)}: ${ambas(r.total)}`,
          ...r.gastos.map(
            (e) =>
              `   ${fechaCorta(e.date, op)} ${escapeHtml(e.description ?? e.supplierName ?? e.category)} — ${montoDe(e)}`,
          ),
        ])
      : ['Nada pendiente']),
  ].join('\n');

  const web = inf.comprasWebSinOrigen.length
    ? [
        '<b>Compras cargadas por la web sin origen de fondos</b>',
        ...inf.comprasWebSinOrigen.map(
          (c) =>
            `• ${fechaCorta(c.date, op)} ${escapeHtml(c.placeName)} — ${fmtMoney(c.total, 'USD')}${c.totalBs ? ` · ${fmtMoney(c.totalBs, 'BS')}` : ''}`,
        ),
      ].join('\n')
    : '';

  const novedades = [
    '<b>Novedades</b>',
    ...(inf.novedades.length
      ? inf.novedades.map(
          (n) =>
            `• ${fechaCorta(n.date, op)} ${escapeHtml(n.socio)}: ${escapeHtml(n.text)}`,
        )
      : ['Sin novedades']),
  ].join('\n');

  return partir(
    [
      cabecera,
      caja,
      trabajadores,
      categorias,
      socios,
      detalle,
      porPagar,
      reembolsos,
      web,
      novedades,
    ].filter(Boolean),
  );
}
