/**
 * Textos de los avisos por SMS.
 *
 * Un SMS son 160 caracteres y la operadora cobra por segmento, asi que el
 * detalle largo de la orden NO va en el mensaje: va un enlace a la pagina
 * publica, que ademas ya existe y muestra los items, totales y la tasa del dia.
 */

/** Nombre que firma el aviso. Lo pone quien llama (nombreVisible); sin dato, un texto neutro. */
const marcaDe = (marca?: string | null): string =>
  (marca ?? '').trim() || 'Su negocio';

/** Un item consumido, tal como se muestra en el aviso. */
export interface NotifiedItem {
  quantity: number;
  name: string;
  total?: number;
}

/**
 * Quita los acentos que NO existen en el alfabeto GSM 7-bit.
 *
 * Un solo caracter fuera de ese alfabeto obliga al SMS entero a codificarse en
 * UCS-2, y ahi el segmento cae de 160 a 70 caracteres: el mismo mensaje pasa a
 * costar el doble. Medido con datos reales: un aviso de 202 chars costaba 4 SMS
 * con acentos y 2 sin ellos.
 *
 * OJO: la "n con virgulilla" y la dieresis SI estan en GSM, pero se normalizan
 * igual por consistencia del texto.
 */
export function toGsmSafe(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x00-\x7F]/g, '');
}

/** Detalle de lo consumido: "2x Perro Caliente, 1x Te de Jamaica". */
export function buildItemsLine(items?: NotifiedItem[] | null): string {
  if (!items?.length) return '';
  return items
    .filter((i) => (i.quantity ?? 0) > 0)
    .map((i) => `${i.quantity}x ${(i.name ?? 'Producto').trim()}`)
    .join(', ');
}

const money = (n: number): string => `$${(Number(n) || 0).toFixed(2)}`;

const shortCode = (orderId: string): string => orderId.slice(-8).toUpperCase();

// dd/mm armado a mano: toLocaleDateString con '2-digit' no rellena el mes en
// Node ("28/8" en vez de "28/08") y en un aviso de cobro la fecha tiene que
// leerse igual siempre. Se lee en UTC: las fechas de calendario (vencimiento,
// evento) se guardan a medianoche UTC, y la hora local del servidor las corre un día.
const shortDate = (d: Date | string | undefined): string => {
  const date = d ? new Date(d) : new Date();
  if (isNaN(date.getTime())) return '';
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
};

/** Primer nombre, para no gastar caracteres con el nombre completo del padron. */
const firstName = (name?: string | null): string => {
  const clean = (name ?? '').trim();
  if (!clean) return '';
  return clean.split(/\s+/)[0];
};

export interface PurchaseSmsData {
  customerName?: string | null;
  orderId: string;
  total: number;
  itemCount: number;
  items?: NotifiedItem[] | null;
  /** Deuda TOTAL del cliente tras esta compra. Se omite si es 0. */
  outstandingTotal?: number | null;
  publicAppUrl: string;
  /** Nombre visible del negocio que firma el aviso (nombreVisible de la configuración). */
  marca?: string;
}

/** Aviso de compra pagada, con el detalle de lo consumido. */
export function buildPurchaseSms(data: PurchaseSmsData): string {
  const nombre = firstName(data.customerName);
  const saludo = nombre ? `${nombre}, gracias` : 'Gracias';
  const detalle = buildItemsLine(data.items);

  return toGsmSafe(
    [
      // El codigo corto se conserva: es la referencia que el cliente puede
      // mencionar por telefono sin tener que abrir el enlace.
      `${marcaDe(data.marca)}: ${saludo} por tu compra #${shortCode(data.orderId)}.`,
      // Sin items (no deberia pasar) se cae al conteo, para no dejar el aviso
      // sin ninguna referencia de que se compro.
      detalle || `${data.itemCount} item(s)`,
      `Total: ${money(data.total)}`,
      // Solo si debe algo: a quien esta al dia no hay que recordarle nada.
      (data.outstandingTotal ?? 0) > 0.01
        ? `Saldo pendiente con nosotros: ${money(data.outstandingTotal ?? 0)}`
        : '',
      `Detalle: ${data.publicAppUrl}/public/precuenta/${data.orderId}`,
    ]
      .filter(Boolean)
      .join('\n'),
  );
}

export interface CreditSmsData {
  customerName?: string | null;
  orderId?: string | null;
  accountReceivableId: string;
  amount: number;
  dueDate?: Date | string;
  items?: NotifiedItem[] | null;
  /** Deuda TOTAL del cliente, incluida esta cuenta recien creada. */
  outstandingTotal?: number | null;
  publicAppUrl: string;
  /** Nombre visible del negocio que firma el aviso (nombreVisible de la configuración). */
  marca?: string;
}

/**
 * Aviso de consumo dejado a credito. Enlaza a "reportar pago" para que el
 * cliente pueda subir su comprobante sin que nadie lo llame.
 */
export function buildCreditSms(data: CreditSmsData): string {
  const nombre = firstName(data.customerName);
  const quien = nombre ? `${nombre}, tu` : 'Tu';
  const orden = data.orderId ? ` #${shortCode(data.orderId)}` : '';
  const vence = data.dueDate ? ` Vence ${shortDate(data.dueDate)}.` : '';
  const detalle = buildItemsLine(data.items);

  return toGsmSafe(
    [
      `${marcaDe(data.marca)}: ${quien} consumo${orden} quedo pendiente de pago.`,
      detalle,
      `Monto: ${money(data.amount)}.${vence}`,
      // Solo si la deuda total supera lo de esta cuenta; si no, seria repetir
      // el mismo numero dos veces seguidas.
      (data.outstandingTotal ?? 0) > data.amount + 0.01
        ? `Deuda total: ${money(data.outstandingTotal ?? 0)}`
        : '',
      `Paga o reporta aqui: ${data.publicAppUrl}/public/reportar-pago/${data.accountReceivableId}`,
    ]
      // Sin items la linea se omite en vez de dejar un renglon vacio.
      .filter(Boolean)
      .join('\n'),
  );
}

export interface CompraDirectaSmsData {
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
 * Aviso de una compra que se pago en el acto.
 *
 * Existe porque hasta el 25/09/2026 estas compras recibian el aviso de
 * CREDITO: al cliente que acababa de pagar le llegaba «tu consumo quedo
 * pendiente de pago» con un enlace para pagarlo. Medido en produccion: en 45
 * dias, 9 cuentas se saldaron en menos de una hora —varias en 0, 1 y 3
 * minutos— y las 9 recibieron ese SMS.
 *
 * Pasaba porque `AccountsReceivableService.create()` avisaba SIEMPRE, sin
 * mirar si la cuenta nacia saldada; y el formulario tiene «Monto Pagado», asi
 * que cobrar en el momento es un caso normal, no una rareza.
 *
 * **No lleva enlace de pago a proposito**: no hay nada que pagar. Va la pagina
 * del restaurante, que fue lo que pidio el dueno.
 */
export function buildCompraDirectaSms(data: CompraDirectaSmsData): string {
  const nombre = firstName(data.customerName);
  const saludo = nombre ? `${nombre}, gracias` : 'Gracias';
  const detalle = buildItemsLine(data.items);
  const deuda = data.outstandingTotal ?? 0;

  return toGsmSafe(
    [
      `${marcaDe(data.marca)}: ${saludo} por tu compra.`,
      detalle,
      `Pagado: ${money(data.amount)}.`,
      // Si le queda deuda de ANTES se dice, porque es cierto; pero sin enlace
      // de pago, que es lo que convertia el aviso en un cobro.
      deuda > 0.01 ? `Saldo pendiente anterior: ${money(deuda)}` : '',
      data.publicAppUrl,
    ]
      .filter(Boolean)
      .join('\n'),
  );
}
