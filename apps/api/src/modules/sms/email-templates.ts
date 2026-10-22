import type { NotifiedItem } from './sms-messages';
import { diaMesAnio } from '../../common/operacion/operacion.util';

/**
 * Plantillas HTML de los avisos.
 *
 * A diferencia del SMS, aqui no hay limite de 160 caracteres ni problema con
 * los acentos, asi que el detalle va completo y con precios.
 */

/** Nombre que firma el correo. Lo pone quien llama (nombreVisible); sin dato, un texto neutro. */
const marcaDe = (marca?: string | null): string =>
  (marca ?? '').trim() || 'Su negocio';

/** La pagina publica del restaurante: lo que se enlaza cuando no hay nada que pagar. */

const AMBER = '#F59E0B';
const DARK = '#1C1917';

const money = (n?: number | null): string => `$${(Number(n) || 0).toFixed(2)}`;

/** Escapa el HTML: los nombres de producto los escribe gente, no el sistema. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function itemsTable(items?: NotifiedItem[] | null): string {
  if (!items?.length) return '';

  const rows = items
    .filter((i) => (i.quantity ?? 0) > 0)
    .map(
      (i) => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #eee">${escapeHtml(String(i.quantity))}x</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee">${escapeHtml(i.name ?? 'Producto')}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right">${
          i.total === undefined || i.total === null ? '' : money(i.total)
        }</td>
      </tr>`,
    )
    .join('');

  return `
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">
      <thead>
        <tr style="background:${DARK};color:#fff">
          <th style="padding:8px 10px;text-align:left">Cant.</th>
          <th style="padding:8px 10px;text-align:left">Producto</th>
          <th style="padding:8px 10px;text-align:right">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function layout(
  title: string,
  intro: string,
  inner: string,
  marca: string,
): string {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:${DARK}">
    <div style="background:${DARK};padding:20px">
      <h1 style="color:#fff;margin:0;font-size:22px">${marca}</h1>

    </div>
    <div style="height:3px;background:${AMBER}"></div>
    <div style="padding:24px 20px">
      <h2 style="margin:0 0 8px;font-size:18px">${escapeHtml(title)}</h2>
      <p style="margin:0;color:#555;font-size:14px">${intro}</p>
      ${inner}
    </div>
    <div style="padding:16px 20px;border-top:1px solid #eee;color:#888;font-size:12px">
      Este es un aviso automatico de ${marca}. Si no reconoces esta compra, responde a este correo.
    </div>
  </div>`;
}

/** Aviso del saldo total, solo si el cliente debe algo. */
function debtBlock(total?: number | null): string {
  if ((total ?? 0) <= 0.01) return '';
  return `
    <div style="margin:16px 0;padding:12px 14px;background:#FEF3C7;border-left:4px solid ${AMBER};border-radius:4px">
      <span style="font-size:14px">Saldo pendiente con nosotros: <b>${money(total)}</b></span>
    </div>`;
}

export interface PurchaseEmailData {
  customerName?: string | null;
  orderId: string;
  total: number;
  items?: NotifiedItem[] | null;
  outstandingTotal?: number | null;
  publicAppUrl: string;
  /** Nombre visible del negocio que firma el aviso (nombreVisible de la configuración). */
  marca?: string;
}

export function buildPurchaseEmail(data: PurchaseEmailData): {
  subject: string;
  html: string;
} {
  const nombre = (data.customerName ?? '').trim();
  const saludo = nombre ? `Hola ${escapeHtml(nombre)},` : 'Hola,';
  const link = `${data.publicAppUrl}/public/precuenta/${data.orderId}`;

  const inner = `
    ${itemsTable(data.items)}
    <p style="font-size:18px;margin:8px 0"><b>Total: ${money(data.total)}</b></p>
    ${debtBlock(data.outstandingTotal)}
    <p style="margin:16px 0 0">
      <a href="${link}" style="background:${AMBER};color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-size:14px">Ver el detalle</a>
    </p>`;

  return {
    subject: `${marcaDe(data.marca)} - Gracias por tu compra (${money(data.total)})`,
    html: layout(
      'Gracias por tu compra',
      `${saludo} esto fue lo que consumiste:`,
      inner,
      marcaDe(data.marca),
    ),
  };
}

export interface CreditEmailData {
  customerName?: string | null;
  accountReceivableId: string;
  amount: number;
  dueDate?: Date | string;
  items?: NotifiedItem[] | null;
  outstandingTotal?: number | null;
  publicAppUrl: string;
  /** Nombre visible del negocio que firma el aviso (nombreVisible de la configuración). */
  marca?: string;
}

export function buildCreditEmail(data: CreditEmailData): {
  subject: string;
  html: string;
} {
  const nombre = (data.customerName ?? '').trim();
  const saludo = nombre ? `Hola ${escapeHtml(nombre)},` : 'Hola,';
  const link = `${data.publicAppUrl}/public/reportar-pago/${data.accountReceivableId}`;
  const vence = data.dueDate
    ? `<p style="margin:8px 0;color:#555;font-size:14px">Vence el ${escapeHtml(
        diaMesAnio(new Date(data.dueDate), 'UTC'),
      )}.</p>`
    : '';

  const inner = `
    ${itemsTable(data.items)}
    <p style="font-size:18px;margin:8px 0"><b>Monto pendiente: ${money(data.amount)}</b></p>
    ${vence}
    ${(data.outstandingTotal ?? 0) > data.amount + 0.01 ? debtBlock(data.outstandingTotal) : ''}
    <p style="margin:16px 0 0">
      <a href="${link}" style="background:${AMBER};color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-size:14px">Pagar o reportar mi pago</a>
    </p>`;

  return {
    subject: `${marcaDe(data.marca)} - Tienes un consumo pendiente (${money(data.amount)})`,
    html: layout(
      'Consumo pendiente de pago',
      `${saludo} tu consumo quedo registrado como pendiente:`,
      inner,
      marcaDe(data.marca),
    ),
  };
}

export interface CompraDirectaEmailData {
  /** Nombre visible del negocio (nombreVisible de la configuración). */
  marca?: string;
  customerName?: string | null;
  amount: number;
  items?: NotifiedItem[] | null;
  /** Deuda que le queda al cliente DESPUES de esta compra. */
  outstandingTotal?: number | null;
  publicAppUrl: string;
}

/**
 * Correo de una compra que se pago en el acto.
 *
 * Existe por el mismo motivo que `buildCompraDirectaSms`: quien pagaba en el
 * momento recibia el aviso de CREDITO, con el boton «Pagar o reportar mi pago»
 * para algo que ya estaba pagado.
 *
 * El correo importa aunque el SMS ya exista: el notificador manda SMS solo si
 * hay telefono, y si no lo hay **el correo es el unico aviso que recibe el
 * cliente**. Anularlo dejaria sin nada a quien solo dio su correo.
 *
 * **Sin boton de pago a proposito.** El enlace es la pagina del restaurante,
 * porque una compra directa se registra sin orden y no hay precuenta que
 * mostrar.
 */
export function buildCompraDirectaEmail(data: CompraDirectaEmailData): {
  subject: string;
  html: string;
} {
  const nombre = (data.customerName ?? '').trim();
  const saludo = nombre ? `Hola ${escapeHtml(nombre)},` : 'Hola,';
  const deuda = data.outstandingTotal ?? 0;

  const inner = `
    ${itemsTable(data.items)}
    <p style="font-size:18px;margin:8px 0"><b>Pagado: ${money(data.amount)}</b></p>
    ${deuda > 0.01 ? debtBlock(deuda) : ''}
    <p style="margin:16px 0 0">
      <a href="${data.publicAppUrl}" style="background:${AMBER};color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-size:14px">Abrir la pagina</a>
    </p>`;

  return {
    subject: `${marcaDe(data.marca)} - Gracias por tu compra (${money(data.amount)})`,
    html: layout(
      'Gracias por tu compra',
      `${saludo} recibimos tu pago:`,
      inner,
      marcaDe(data.marca),
    ),
  };
}

/** Correo con el codigo de verificacion de la cuenta (6 digitos). */
export function buildVerificationEmail(
  name: string | null | undefined,
  code: string,
  marca?: string,
): { subject: string; html: string } {
  const nombre = (name ?? '').trim();
  const saludo = nombre ? `Hola ${escapeHtml(nombre)},` : 'Hola,';
  const inner = `
    <p style="margin:8px 0;color:#555;font-size:14px">Tu codigo de verificacion es:</p>
    <div style="margin:16px 0;text-align:center">
      <span style="display:inline-block;font-size:34px;letter-spacing:10px;font-weight:bold;background:#FEF3C7;border:1px solid ${AMBER};border-radius:8px;padding:14px 24px">${escapeHtml(code)}</span>
    </div>
    <p style="margin:8px 0;color:#888;font-size:13px">El codigo vence en 15 minutos. Si no creaste esta cuenta, ignora este correo.</p>`;

  return {
    subject: `${marcaDe(marca)} - Tu codigo de verificacion`,
    html: layout(
      'Verifica tu cuenta',
      `${saludo} ya casi estas listo:`,
      inner,
      marcaDe(marca),
    ),
  };
}
