import { esComprobantePago, parseNumber } from '../inventory/invoice-parser';

export type InvoiceCurrency = 'BS' | 'USD';

/**
 * Un monto que la factura presenta como total de algo, con SU moneda.
 *
 * La moneda va con cada monto porque una misma factura trae los dos: la nota
 * de Coca-Cola pone "DOLARES 54,49" y, en la misma hoja, "IVA: Bs 6.368,68".
 * Mostrar ambos como "$" (o ambos como "Bs") hacia que el socio eligiera un
 * numero en la moneda equivocada.
 */
export interface MontoCandidato {
  monto: number;
  /** null: la linea no dice en que moneda esta; vale la de la factura. */
  moneda: InvoiceCurrency | null;
}

export interface InvoiceHeader {
  total: number | null;
  currency: InvoiceCurrency | null;
  /** Tal como la escribe la factura (dd/mm/aaaa o dd-mm-aaaa). */
  date: string | null;
  /** Normalizado a `J-90000003-0`. */
  rif: string | null;
  /** Razon social: primera linea con texto antes del RIF. */
  vendor: string | null;
  /** Todos los montos con decimales que aparecen, en orden. */
  amounts: number[];
  /**
   * Los montos que la factura presenta como un total de algo: TOTAL, SUB
   * TOTAL, IVA, MONTO, A PAGAR, DEUDA ACTUAL.
   *
   * Una factura seria trae varios y el parser no puede saber cual se pago: la
   * de Coca-Cola tiene cinco (46,97 · 54,49 · 39.804,26 · 6.368,68 ·
   * 46.172,94) y la nota de Polar pone "Deuda Actual 7.222,04" —ocho veces el
   * total de esa compra— debajo del total. "el usuario sabe cual es" (dueño,
   * 17/09/2026): el bot los ofrece y el socio toca el correcto.
   */
  totalCandidates: MontoCandidato[];
  /**
   * La foto es un comprobante de PAGO (Pago Movil, voucher del punto de
   * venta), no una factura: no hay renglones que cargar al inventario.
   */
  esPago: boolean;
  /**
   * Lo que el socio escribio al pagar: "panes perro", "ridery", "gas". Es la
   * descripcion del gasto, escrita por el en el momento de la compra, asi que
   * el bot no tiene por que volver a preguntarla.
   */
  concepto: string | null;
}

// "Concepto: panes perro" en la app y en la web del BDV. El valor puede caer
// en la linea de al lado cuando el OCR separa las dos columnas.
const CONCEPTO = /^\s*Concepto\s*:?\s*(.*)$/im;

// Lineas donde un numero es "un total de algo" y no el precio de un renglon.
const LINEA_DE_TOTAL =
  /total|subttl|monto|a\s*pagar|importe|deuda|d[oó]lares|divisa|\biva\b|\bbi\b|\busd\b/i;

// "18.450,00" | "18450,00" | "345.15" | "1,450.00": siempre con 2 decimales,
// asi no se confunden cantidades ("20") con dinero.
const MONTO = /\d{1,3}(?:[.,]\d{3})+[.,]\d{2}|\d+[.,]\d{2}/g;
const RIF = /\b([VEJGP])[-\s]?(\d{7,9})(?:[-\s]?(\d))?\b/i;
const FECHA = /\b(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})\b/;
const ES_USD = /\$|\bUSD\b|D[OÓ]LAR|\bREF\b/i;
// Tesseract lee "Bs" como "8s" o "Es" con frecuencia (mismo truco que parseVoucherText).
// El "Bs" va antes del monto en las facturas ("TOTAL Bs 21.402,00") y DESPUES
// en los comprobantes de Pago Movil ("58.274,18 Bs"), que es como llega la
// mayoria de los gastos por el bot.
// Admite "Bs.:" (Condimentos Tony: "TOTAL A PAGAR Bs.: 1.904,65").
const ES_BS =
  /\b(?:Bs|BS|8s|Es)\.?\s*:?\s*\d|\d\s*(?:Bs|BS|8s|Es)\b\.?|BOL[IÍ]VAR|\bVES\b/;
const PALABRAS_NO_VENDOR =
  /factura|rif|fecha|nro|senores|señores|cliente|telf|tel[eé]fono|direcci|p[aá]gina|presupuesto|cotizaci/i;

function montosDe(linea: string): number[] {
  return (linea.match(MONTO) ?? [])
    .map(parseNumber)
    .filter((n): n is number => n !== null && n > 0);
}

export function parseInvoiceHeader(raw: string): InvoiceHeader {
  const vacio: InvoiceHeader = {
    total: null,
    currency: null,
    date: null,
    rif: null,
    vendor: null,
    amounts: [],
    totalCandidates: [],
    esPago: false,
    concepto: null,
  };
  if (!raw || typeof raw !== 'string') return vacio;

  const lineas = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const amounts = lineas.flatMap(montosDe);

  const { total, lineaTotal } = elegirTotal(lineas, amounts);

  const esPago = esComprobantePago(raw);

  let currency: InvoiceCurrency | null = null;
  if (lineaTotal && monedaDeLinea(lineaTotal))
    currency = monedaDeLinea(lineaTotal);
  else if (ES_USD.test(raw)) currency = 'USD';
  else if (ES_BS.test(raw)) currency = 'BS';
  // La web del BDV imprime "Monto de la Operación: 49.949,30" sin decir en
  // que moneda. Un Pago Movil venezolano siempre es en bolivares.
  else if (esPago) currency = 'BS';

  const rifMatch = raw.match(RIF);
  const rif = rifMatch
    ? `${rifMatch[1].toUpperCase()}-${rifMatch[2]}${rifMatch[3] ? `-${rifMatch[3]}` : ''}`
    : null;

  const fechaMatch = raw.match(FECHA);
  const date = fechaMatch ? fechaMatch[1] : null;

  let vendor: string | null = null;
  const idxRif = lineas.findIndex((l) => RIF.test(l));
  const candidatas = idxRif > 0 ? lineas.slice(0, idxRif) : lineas.slice(0, 3);
  for (const l of candidatas) {
    const letras = (l.match(/[A-Za-zÁÉÍÓÚÑáéíóúñ]/g) ?? []).length;
    if (
      letras >= 4 &&
      !PALABRAS_NO_VENDOR.test(l) &&
      montosDe(l).length === 0
    ) {
      vendor = l;
      break;
    }
  }

  return {
    total,
    currency,
    date,
    rif,
    vendor,
    amounts,
    totalCandidates: candidatosDeTotal(lineas, total, currency),
    esPago,
    concepto: conceptoDe(lineas),
  };
}

/** La moneda que declara una linea, si declara alguna. */
function monedaDeLinea(l: string): InvoiceCurrency | null {
  if (ES_USD.test(l) || /divisa/i.test(l)) return 'USD';
  if (ES_BS.test(l)) return 'BS';
  return null;
}

/** Los montos que aparecen DESPUES de donde calza `palabra` en la linea. */
function montosTras(linea: string, palabra: RegExp): number[] {
  const m = linea.match(palabra);
  if (!m || m.index === undefined) return [];
  return montosDe(linea.slice(m.index + m[0].length));
}

/**
 * El total de la factura, en orden de confianza:
 *
 *   1. "A PAGAR": es literalmente lo que se paga.
 *   2. La ultima linea con TOTAL (no SUBTOTAL), tomando SOLO el numero que va
 *      despues de la palabra. Antes se tomaba el ultimo de la linea: en
 *      "BI: Bs 39.804,26 IVA: Bs 6.368,68 TOTAL: BS" —la foto de Coca-Cola
 *      corto el total— eso era el IVA, y el bot propuso Bs 6.368,68 por una
 *      compra de $54,49 (17/09/2026).
 *   3. Una linea de DOLARES / DIVISAS / USD con su monto: muchas notas ponen
 *      ahi el total en divisas ("DOLARES . 54,49").
 *   4. Una linea de MONTO (Pago Movil web, voucher del punto de venta).
 *   5. El SUB-TOTAL: sin IVA, pero es de ESTA compra.
 *   6. El mayor monto del texto, sin contar la deuda.
 *
 * La deuda con el proveedor nunca es el total: la nota de Viveluso pone
 * "Deuda Actual: $ 7222.04" encima de un total de 861,43, y cuando el OCR leyo
 * el total como "| Otal" el bot propuso los 7.222 (18/09/2026).
 */
function elegirTotal(
  lineas: string[],
  amounts: number[],
): { total: number | null; lineaTotal: string | null } {
  const ultimaCon = (esLinea: (l: string) => boolean, palabra: RegExp) => {
    let hallado: { total: number; lineaTotal: string } | null = null;
    for (const l of lineas) {
      if (!esLinea(l)) continue;
      const m = montosTras(l, palabra);
      if (m.length) hallado = { total: m[0], lineaTotal: l };
    }
    return hallado;
  };
  const APAGAR = /a\s*pagar/i;
  // "| Otal 861.43": el OCR se come la T cuando la palabra va en letra grande.
  const TOTAL = /total|(?:^|[\s|])otal\b/i;
  const ES_DEUDA = /deuda|saldo/i;
  const sinDeuda = lineas.filter((l) => !ES_DEUDA.test(l));
  const DIVISAS = /d[oó]lares|divisas?|\busd\b/i;
  const MONTO_ = /monto/i;
  return (
    ultimaCon((l) => APAGAR.test(l), APAGAR) ??
    ultimaCon(
      (l) => TOTAL.test(l) && !/sub\s*-?\s*total/i.test(l) && !ES_DEUDA.test(l),
      /.*otal/i,
    ) ??
    ultimaCon((l) => DIVISAS.test(l), DIVISAS) ??
    ultimaCon((l) => MONTO_.test(l), MONTO_) ??
    ultimaCon((l) => /sub\s*-?\s*total/i.test(l), /sub\s*-?\s*total/i) ?? {
      total: (() => {
        const sinLaDeuda = sinDeuda.flatMap(montosDe);
        const pool = sinLaDeuda.length ? sinLaDeuda : amounts;
        return pool.length ? Math.max(...pool) : null;
      })(),
      lineaTotal: null,
    }
  );
}

/**
 * Los montos que la factura llama total, subtotal, IVA, monto, deuda o
 * divisas, cada uno con su moneda.
 *
 * Van sin repetir y con el que el parser eligio de primero, para que el socio
 * confirme de un toque el caso normal y solo tenga que mirar cuando la factura
 * de verdad trae varios.
 */
function candidatosDeTotal(
  lineas: string[],
  total: number | null,
  monedaTotal: InvoiceCurrency | null,
): MontoCandidato[] {
  const vistos: MontoCandidato[] = [];
  const agregar = (monto: number, moneda: InvoiceCurrency | null) => {
    if (monto > 0 && !vistos.some((v) => Math.abs(v.monto - monto) < 0.005))
      vistos.push({ monto, moneda });
  };
  if (total !== null) agregar(total, monedaTotal);
  for (const l of lineas) {
    if (!LINEA_DE_TOTAL.test(l)) continue;
    for (const n of montosDe(l)) agregar(n, monedaDeLinea(l) ?? monedaTotal);
  }
  // El resto, de mayor a menor detras del elegido: lo mas probable primero.
  const [primero, ...otros] = vistos;
  otros.sort((a, b) => b.monto - a.monto);
  return (primero === undefined ? [] : [primero, ...otros]).slice(0, 6);
}

/**
 * El concepto del Pago Movil, que es la descripcion del gasto ya escrita por
 * quien pago. Si el OCR partio la fila en dos ("Concepto:" por un lado y el
 * texto por otro), se toma la linea siguiente.
 */
function conceptoDe(lineas: string[]): string | null {
  for (let i = 0; i < lineas.length; i++) {
    const m = lineas[i].match(CONCEPTO);
    if (!m) continue;
    const propio = m[1].trim();
    const valor = propio || (lineas[i + 1] ?? '').trim();
    // Un concepto es corto y sin cifras: si trae un monto es que el OCR se
    // comio la separacion y arrastro la fila de al lado.
    if (!valor || valor.length > 60 || montosDe(valor).length) return null;
    return valor;
  }
  return null;
}

/**
 * Las ultimas 8 cifras del numero de operacion de un comprobante de pago.
 *
 * Sirve para reconocer el MISMO pago fotografiado dos veces. El 17/09/2026 se
 * registro dos veces un Ridery de Bs 2.118,61: una captura era el comprobante
 * de la app ("Operación: 007374924115") y la otra el detalle del movimiento,
 * que el OCR leyo "0677274924115". Las primeras cifras cambian con el OCR;
 * las ultimas 8 coinciden.
 */
export function referenciaDeOperacion(raw: string): string | null {
  if (!raw) return null;
  const m =
    raw.match(/operaci[oó]n(?:\s+es)?\s*[:.]?\s*(\d{8,})/i) ??
    raw.match(/\bref(?:erencia)?\.?\s*:?\s*(\d{8,})/i) ??
    raw.match(/No\.?\s*Operac\.?[\s\S]{0,40}?\b(\d{6,})\b/i);
  if (!m) return null;
  return m[1].slice(-8);
}
