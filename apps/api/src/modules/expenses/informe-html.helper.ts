import { ExpenseLean } from './schemas/expense.schema';
import { OperacionConfig } from '@odin6/types';
import { diaMesAnio } from '../../common/operacion/operacion.util';
import { fmtMoney } from './money';
import {
  InformeSemanal,
  TotalMoneda,
  escapeHtml,
  fechaCorta,
  etiquetaDe,
} from './expenses-report.helper';

/**
 * El informe de la semana como pagina imprimible.
 *
 * Es una funcion PURA que devuelve HTML: el navegador que lo convierte a PDF
 * vive en otro archivo, para poder probar el contenido sin levantar chromium.
 *
 * No es el texto de Telegram con otra tipografia. El de Telegram se lee en el
 * telefono de corrido; este se imprime y se archiva, asi que el numero de
 * cierre va arriba y grande, y el detalle va en tablas que se pueden recorrer
 * con el dedo.
 */

const usd = (n: number): string => fmtMoney(n, 'USD');
const ambas = (t: TotalMoneda): string =>
  `${fmtMoney(t.bs, 'BS')} · ${fmtMoney(t.usd, 'USD')}`;

/** dd/mm/aaaa en la zona de la operación, para la portada. */
function fechaLarga(d: Date, op: OperacionConfig): string {
  return diaMesAnio(d, op.timezone);
}

const fila = (concepto: string, monto: string, clase = ''): string =>
  `<tr class="${clase}"><td>${concepto}</td><td class="num">${monto}</td></tr>`;

function seccionCaja(inf: InformeSemanal): string {
  const caja = inf.caja;
  if (!caja) return '';

  // El mismo orden y las mismas etiquetas que las tarjetas del panel web: los
  // socios comparan las dos cosas y dos cifras distintas para lo mismo es una
  // discusion garantizada.
  const metodos = caja.metodos
    .filter((m) => m.bruto > 0)
    .flatMap((m) => [
      fila(escapeHtml(m.etiqueta), usd(m.bruto)),
      ...(m.detalle ?? [])
        .filter((d) => d.monto > 0)
        .map((d) =>
          fila(
            `<span class="sub">${escapeHtml(d.etiqueta)}</span>`,
            usd(d.monto),
            'leve',
          ),
        ),
    ]);

  return `
  <section class="caja">
    <div class="cierre">
      <p class="rotulo">Entró en caja</p>
      <p class="grande">${usd(caja.entroTotal)}</p>
      <p class="nota">
        punto de venta + pago móvil + efectivo
        ${caja.propina > 0 ? `· incluye ${usd(caja.propina)} de propina del mesonero` : ''}
        ${
          caja.saldoInicial === undefined
            ? ''
            : `· sin contar los ${usd(caja.saldoInicial)} con que abrió la semana`
        }
      </p>
    </div>
    <table class="cuentas">
      ${
        caja.saldoInicial === undefined
          ? ''
          : fila('Saldo inicial en el banco', usd(caja.saldoInicial))
      }
      ${metodos.join('')}
      ${fila('<b>Total que entró</b>', `<b>${usd(caja.entroTotal)}</b>`)}
      ${fila('Gastos pagados de la semana', `− ${usd(caja.gastosPagados)}`)}
      ${fila(`Nómina pagada (${caja.nomina.pagos} pagos)`, `− ${usd(caja.nomina.neto)}`)}
      ${fila('<b>Debería quedar</b>', `<b class="${caja.quedaTotal < 0 ? 'rojo' : ''}">${usd(caja.quedaTotal)}</b>`, 'total')}
      ${fila('<span class="sub">en el banco</span>', `<span class="sub">${usd(caja.quedaBanco)}</span>`, 'leve')}
      ${fila('<span class="sub">en la gaveta, en efectivo</span>', `<span class="sub">${usd(caja.quedaEfectivo)}</span>`, 'leve')}
    </table>
    <p class="pie">
      Todo gasto pagado se cuenta como salido del banco, sea con fondos de Negocio
      o de un socio; al efectivo no se le resta nada.
      El total y el desglose son los mismos de la tarjeta &laquo;Entró en caja&raquo; del panel.
    </p>
  </section>`;
}

function seccionNomina(inf: InformeSemanal): string {
  const n = inf.caja?.nomina;
  if (!n || n.pagos === 0) return '';

  return `
  <section>
    <h2>Nómina pagada</h2>
    <table class="cuentas">
      ${fila('Días / sueldos', usd(n.dias))}
      ${fila('Comisiones', usd(n.comisiones))}
      ${fila('Propinas', usd(n.propinas))}
      ${n.bonos > 0 ? fila('Bonos', usd(n.bonos)) : ''}
      ${n.descuentos > 0 ? fila('Consumos y abonos de préstamo', `− ${usd(n.descuentos)}`) : ''}
      ${fila('<b>Neto transferido</b>', `<b>${usd(n.neto)}</b>`, 'total')}
    </table>
  </section>`;
}

/**
 * Cuanto cobro cada quien, y el comprobante.
 *
 * A proposito NO se abre en sueldo / comision / propina: lo que se necesita
 * para revisar un pago es el total que se transfirio y la foto de esa
 * transferencia, y el desglose por persona es una conversacion aparte (dueño,
 * 22/09/2026). Los recibos se sirven publicos desde /uploads, asi que el
 * enlace funciona para cualquiera que reciba el PDF.
 */
function seccionPorTrabajador(
  inf: InformeSemanal,
  op: OperacionConfig,
): string {
  const filas = inf.caja?.nomina.porTrabajador ?? [];
  if (!filas.length) return '';

  const cuerpo = filas
    .map(
      (t) => `<tr>
        <td>
          ${escapeHtml(t.nombre)}
          ${t.cargo ? `<span class="sub">${escapeHtml(t.cargo.toLowerCase())}</span>` : ''}
          ${t.pagos > 1 ? `<span class="sub">· ${t.pagos} pagos</span>` : ''}
        </td>
        <td class="num">${usd(t.neto)}</td>
        <td class="recibo">
          ${t.reciboUrl ? `<a href="${escapeHtml(t.reciboUrl)}">ver recibo</a>` : '<span class="sub">sin recibo</span>'}
        </td>
      </tr>`,
    )
    .join('');

  const total = filas.reduce((a, t) => a + t.neto, 0);

  return `
  <section>
    <h2>Pagado a cada trabajador</h2>
    <table class="detalle trabajadores">
      <thead><tr><th>Trabajador</th><th class="num">Total pagado</th><th>Comprobante</th></tr></thead>
      <tbody>
        ${cuerpo}
        <tr class="sumatoria">
          <td><b>Total</b></td>
          <td class="num"><b>${usd(Math.round(total * 100) / 100)}</b></td>
          <td></td>
        </tr>
      </tbody>
    </table>
  </section>`;
}

const filasGastos = (gastos: ExpenseLean[], op: OperacionConfig): string =>
  gastos
    .map(
      (e) => `<tr>
        <td class="fecha">${fechaCorta(e.date, op)}</td>
        <td>${etiquetaDe(e)}${e.paymentStatus === 'CREDIT' ? ' <span class="credito">CRÉDITO</span>' : ''}</td>
        <td>${escapeHtml(e.category)}</td>
        <td class="num">${ambas({ bs: e.amountBs, usd: e.amountUsd })}</td>
      </tr>`,
    )
    .join('');

const DIA_MS = 86400000;

export function formatearInformeHtml(
  inf: InformeSemanal,
  op: OperacionConfig,
): string {
  const { semana } = inf;
  // `hasta` es el arranque de la jornada del dia siguiente (06:00 VE del
  // martes). Restarle un milisegundo, como hace el texto de Telegram, sigue
  // cayendo en ese martes y el encabezado quedaba "15/09 → 22/09" para una
  // semana que termina el lunes 21. Un dia entero menos da el ultimo dia real.
  const ultimoDia = new Date(semana.hasta.getTime() - DIA_MS);

  const categorias = inf.porCategoria
    .map((c) =>
      fila(
        `${escapeHtml(c.category)} <span class="sub">(${c.cantidad})</span>`,
        ambas(c.total),
      ),
    )
    .join('');

  const porPagar = inf.porPagar.length
    ? `<section class="cortita">
        <h2>Por pagar (todas las semanas)</h2>
        <table class="cuentas">
          ${inf.porPagar.map((p) => fila(escapeHtml(p.supplierName), ambas(p.total))).join('')}
        </table>
      </section>`
    : '';

  const reembolsos = inf.reembolsos.length
    ? `<section class="cortita">
        <h2>Reembolsos pendientes</h2>
        <table class="cuentas">
          ${inf.reembolsos.map((r) => fila(`El negocio le debe a ${escapeHtml(r.socio)}`, ambas(r.total))).join('')}
        </table>
      </section>`
    : '';

  const novedades = inf.novedades.length
    ? `<section>
        <h2>Novedades</h2>
        <ul>${inf.novedades.map((n) => `<li><b>${fechaCorta(n.date, op)}</b> ${escapeHtml(n.socio)}: ${escapeHtml(n.text)}</li>`).join('')}</ul>
      </section>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Informe ${fechaLarga(semana.desde, op)}</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #16181d; font-size: 10.5pt; line-height: 1.45; margin: 0;
  }
  header { border-bottom: 2px solid #16181d; padding-bottom: 8px; margin-bottom: 16px; }
  h1 { font-size: 17pt; margin: 0 0 2px; letter-spacing: -0.2px; }
  header .rango { color: #5b6270; font-size: 10pt; margin: 0; }
  h2 {
    font-size: 11pt; margin: 0 0 6px; text-transform: uppercase;
    letter-spacing: 0.6px; color: #5b6270;
  }
  /* Las tablas cortas no se parten; el detalle SI, o cada seccion que no entra
     empuja media pagina en blanco (medido: 2 paginas desperdiciadas). */
  section { margin-bottom: 16px; }
  .caja, .dosColumnas > section, .cortita { page-break-inside: avoid; }
  .detalle tr { page-break-inside: avoid; }
  .detalle thead { display: table-header-group; }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 3.5px 0; vertical-align: top; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .cuentas td { border-bottom: 1px solid #ecedf1; }
  .cuentas tr.total td { border-top: 1.5px solid #16181d; border-bottom: none; padding-top: 6px; }
  .cuentas tr.leve td { color: #5b6270; border-bottom: none; padding: 1px 0; font-size: 9.5pt; }
  .sub { color: #8a92a1; font-weight: normal; }
  .caja { border: 1.5px solid #16181d; border-radius: 6px; padding: 14px 16px; }
  .cierre { text-align: center; margin-bottom: 12px; }
  .cierre .rotulo {
    margin: 0; font-size: 9pt; text-transform: uppercase;
    letter-spacing: 0.8px; color: #5b6270;
  }
  .cierre .grande { margin: 2px 0 0; font-size: 30pt; font-weight: 700; letter-spacing: -1px; }
  .cierre .grande.rojo, .rojo { color: #b4232a; }
  .cierre .nota { margin: 2px 0 0; color: #5b6270; font-size: 9.5pt; }
  .pie { margin: 10px 0 0; color: #5b6270; font-size: 8.5pt; line-height: 1.4; }
  .detalle th {
    text-align: left; border-bottom: 1px solid #16181d; padding-right: 10px;
    font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.5px; color: #5b6270;
  }
  .detalle td { border-bottom: 1px solid #f2f3f6; font-size: 9.5pt; }
  .detalle .fecha { color: #8a92a1; white-space: nowrap; padding-right: 8px; }
  .trabajadores .recibo { text-align: right; white-space: nowrap; }
  .trabajadores a { color: #1a54c4; text-decoration: none; }
  .trabajadores .sumatoria td { border-top: 1.5px solid #16181d; border-bottom: none; padding-top: 6px; }
  .trabajadores .sub { margin-left: 5px; }
  .credito {
    background: #16181d; color: #fff; font-size: 7.5pt; padding: 1px 4px;
    border-radius: 3px; letter-spacing: 0.4px;
  }
  .dosColumnas { display: flex; gap: 20px; }
  .dosColumnas > * { flex: 1; }
  ul { margin: 0; padding-left: 16px; }
  footer { margin-top: 18px; border-top: 1px solid #ecedf1; padding-top: 6px; color: #8a92a1; font-size: 8pt; }
</style>
</head>
<body>
  <header>
    <h1>Informe de gastos — Semana de ${escapeHtml(semana.socio)}</h1>
    <p class="rango">
      ${fechaLarga(semana.desde, op)} → ${fechaLarga(ultimoDia, op)}
      ${semana.estimado ? '' : ' · turno con ajuste manual'}
    </p>
  </header>

  ${seccionCaja(inf)}

  <section class="cortita">
    <h2>Gastos de la semana</h2>
    <table class="cuentas">
      ${fila('<b>Total</b>', `<b>${ambas(inf.total)}</b>`)}
      ${fila('💵 Contado <span class="sub">— salió del banco</span>', ambas(inf.contado))}
      ${fila('📅 A crédito <span class="sub">— queda debiendo</span>', ambas(inf.credito))}
      ${fila('Insumos', ambas(inf.porKind.INSUMOS), 'leve')}
      ${fila('Generales', ambas(inf.porKind.GENERAL), 'leve')}
    </table>
  </section>

  <div class="dosColumnas">
    <section>
      <h2>Por categoría</h2>
      <table class="cuentas">${categorias}</table>
    </section>
    ${seccionNomina(inf)}
  </div>

  ${seccionPorTrabajador(inf, op)}

  ${porPagar}
  ${reembolsos}

  <section>
    <h2>Detalle (${inf.gastos.length})</h2>
    <table class="detalle">
      <thead><tr><th>Fecha</th><th>Concepto</th><th>Categoría</th><th class="num">Monto</th></tr></thead>
      <tbody>${filasGastos(inf.gastos, op)}</tbody>
    </table>
  </section>

  ${novedades}

  <footer>Informe de gastos · generado el ${fechaLarga(new Date(), op)}</footer>
</body>
</html>`;
}
