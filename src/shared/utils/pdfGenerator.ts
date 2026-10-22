import jsPDF from 'jspdf';
import autoTable, { RowInput } from 'jspdf-autotable';
import { Invoice } from '@odin6/types';
import { Customer } from '@odin6/types';
import { Budget } from '@odin6/types';
import { BudgetStatusEnum } from '@/shared/types/enumShared';
import { formatDate, formatDateTime } from './dateHelpers';
import { computeInvoiceTotals } from './invoiceTotals';
import {
  NEGOCIO_DEFAULT,
  MARCA_DEFAULT,
  TARIFAS_DEFAULT,
  type MarcaConfig,
  type NegocioConfig,
  type TarifasConfig,
} from '@odin6/types';
import {
  etiquetaCondicionPago,
  etiquetaTipoCliente,
} from '@/shared/constants/facturaFiscal';

/**
 * Datos del negocio y de la marca que salen en el PDF. Los pide el llamador (un componente con
 * `useContextoPdf()`, o un servicio que recibió la configuración); el PDF no lee la API por su cuenta.
 */
export interface ContextoPdf {
  negocio: NegocioConfig;
  marca: MarcaConfig;
  /** Para rotular servicio e impuesto. Sin ella se usan las tarifas neutras. */
  tarifas?: TarifasConfig;
}

interface PDFData {
  invoice: Invoice;
  customer?: Customer | null;
  contexto: ContextoPdf;
}

interface jsPDFWithAutoTable extends jsPDF {
  lastAutoTable: {
    finalY: number;
  };
}

// --- Colores y datos del emisor: los fija cada función exportada con su `contexto` ---
// El PDF se genera de a uno y de forma síncrona, así que basta con fijar el contexto al entrar.
type RGB = readonly [number, number, number];
interface Colores {
  amber: RGB;
  amberDark: RGB;
  amberLight: RGB;
  dark: RGB;
  text: RGB;
  textMuted: RGB;
  border: RGB;
  bg: RGB;
  white: RGB;
  success: RGB;
  error: RGB;
  warning: RGB;
}

interface DatosEmisor {
  nombreComercial: string;
  razonSocial: string;
  rif: string;
  domicilioFiscal: string;
  telefono: string;
  rubro: string;
  web: string;
}

function rgbDe(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mezcla de un color con blanco: `t` = 0 deja el color, 1 lo deja blanco. */
function aclarar(hex: string, t: number): RGB {
  const [r, g, b] = rgbDe(hex);
  const m = (c: number): number => Math.round(c + (255 - c) * t);
  return [m(r), m(g), m(b)];
}

function coloresDe(marca: MarcaConfig): Colores {
  const claro = marca.palette.light;
  return {
    amber: rgbDe(claro.primary),
    amberDark: rgbDe(claro.primaryDark),
    amberLight: aclarar(claro.primary, 0.85),
    dark: rgbDe(marca.palette.dark.page),
    text: rgbDe(claro.content),
    textMuted: rgbDe(claro.dim),
    border: rgbDe(claro.line),
    bg: rgbDe(claro.page),
    white: [255, 255, 255],
    success: rgbDe(claro.success),
    error: rgbDe(claro.danger),
    warning: rgbDe(claro.warning),
  };
}

function emisorDe(negocio: NegocioConfig): DatosEmisor {
  return {
    nombreComercial: negocio.tradeName,
    razonSocial: negocio.legalName || negocio.tradeName,
    rif: negocio.taxId,
    domicilioFiscal: negocio.address,
    telefono: negocio.phone,
    rubro: negocio.tagline,
    web: negocio.website,
  };
}

let C: Colores = coloresDe(MARCA_DEFAULT);
let EMISOR: DatosEmisor = emisorDe(NEGOCIO_DEFAULT);
let tarifasPdf: TarifasConfig = TARIFAS_DEFAULT;
let etiquetaServicio = 'Servicio';

function fijarContexto(contexto: ContextoPdf): void {
  C = coloresDe(contexto.marca);
  EMISOR = emisorDe(contexto.negocio);
  tarifasPdf = contexto.tarifas ?? TARIFAS_DEFAULT;
  const pct = Math.round(tarifasPdf.serviceRate * 1000) / 10;
  etiquetaServicio =
    tarifasPdf.serviceMode === 'included'
      ? `Servicio incluido (${pct}%)`
      : `Servicio (${pct}%)`;
}

const M = 15; // margin
const PW = 210; // page width
const CW = PW - M * 2; // content width

const FONT = 'helvetica';

// --- Helpers ---

const rightX = PW - M;

function drawRoundedRect(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: readonly [number, number, number],
  stroke?: readonly [number, number, number],
) {
  doc.setFillColor(...fill);
  if (stroke) {
    doc.setDrawColor(...stroke);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, w, h, r, r, 'FD');
  } else {
    doc.roundedRect(x, y, w, h, r, r, 'F');
  }
}

// --- Secciones del PDF ---

const HEADER_H = 46;

function drawHeader(doc: jsPDF, invoice: Invoice): number {
  // Barra superior dark
  doc.setFillColor(...C.dark);
  doc.rect(0, 0, PW, HEADER_H, 'F');

  // Acento amber
  doc.setFillColor(...C.amber);
  doc.rect(0, HEADER_H, PW, 2, 'F');

  // ── Emisor: nombre comercial, razon social, RIF y domicilio fiscal ──
  // El RIF del emisor NO estaba: sin el, el papel no es una factura.
  doc.setTextColor(...C.white);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(19);
  doc.text(EMISOR.nombreComercial, M, 15);

  doc.setFont(FONT, 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(200, 200, 200);
  doc.text(EMISOR.razonSocial, M, 22);

  doc.setFont(FONT, 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.white);
  doc.text(`RIF: ${EMISOR.rif}`, M, 28.5);

  doc.setFont(FONT, 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(180, 180, 180);
  doc.text(EMISOR.domicilioFiscal, M, 35);
  doc.text(`Tel: ${EMISOR.telefono}  |  ${EMISOR.rubro}`, M, 41);

  // ── Numero de factura y numero de control (derecha) ──
  doc.setTextColor(...C.amberLight);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(11);
  doc.text('FACTURA', rightX, 13, { align: 'right' });

  doc.setTextColor(...C.white);
  doc.setFontSize(13);
  doc.text(`N° ${invoice.invoiceNumber}`, rightX, 21, { align: 'right' });

  // El numero de control es el correlativo fiscal: va aparte del numero de
  // factura y solo existe en las facturas emitidas por el flujo fiscal.
  let rightY = 29;
  if (invoice.controlNumber) {
    doc.setFont(FONT, 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C.amberLight);
    doc.text('N° DE CONTROL', rightX, rightY, { align: 'right' });
    doc.setFont(FONT, 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...C.white);
    doc.text(invoice.controlNumber, rightX, rightY + 7, { align: 'right' });
    rightY += 13;
  }

  doc.setFont(FONT, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 180);
  doc.text(
    `Emitida: ${formatDate(invoice.issueDate || invoice.createdAt)}`,
    rightX,
    rightY,
    { align: 'right' },
  );

  return HEADER_H + 10;
}

function drawClientAndStatus(
  doc: jsPDF,
  y: number,
  invoice: Invoice,
  customer?: Customer | null,
): number {
  const colW = CW / 2 - 3;

  // ── Lineas del receptor: el RIF y el domicilio son requisito fiscal, asi
  // que se arman primero para poder medir el alto de las dos cards. El RIF
  // sale de la factura (congelado al emitir) y si no, de la ficha del cliente.
  const rifCliente =
    invoice.customerRif ||
    customer?.rif ||
    (customer?.identificationType && customer?.identificationId
      ? `${customer.identificationType}-${customer.identificationId}`
      : '');
  const direccion = invoice.customerAddress || customer?.address || '';
  const tipoCliente = etiquetaTipoCliente(invoice.customerType);
  const telefono = invoice.customerPhone || customer?.phone || '';
  const email = invoice.customerEmail || customer?.email || '';

  const lineasCliente: { texto: string; bold?: boolean }[] = [];
  if (rifCliente)
    lineasCliente.push({ texto: `RIF/C.I.: ${rifCliente}`, bold: true });
  if (tipoCliente) lineasCliente.push({ texto: tipoCliente });
  if (direccion) {
    doc.setFont(FONT, 'normal');
    doc.setFontSize(8);
    doc.splitTextToSize(direccion, colW - 12).forEach((l: string) => {
      lineasCliente.push({ texto: l });
    });
  }
  if (telefono) lineasCliente.push({ texto: `Tel: ${telefono}` });
  if (email) lineasCliente.push({ texto: email });

  // Lineas del lado derecho (DETALLES), para medirlas igual que las del cliente
  const lineasDetalle: string[] = [];
  const condicion = etiquetaCondicionPago(invoice.paymentCondition);
  if (condicion) lineasDetalle.push(`Condicion de pago: ${condicion}`);
  lineasDetalle.push(
    `Emision: ${formatDate(invoice.issueDate || invoice.createdAt)}`,
  );
  if (!invoice.issueDate) {
    lineasDetalle.push(`Registrada: ${formatDateTime(invoice.createdAt)}`);
  }
  if (invoice.dueDate) {
    lineasDetalle.push(`Vencimiento: ${formatDate(invoice.dueDate)}`);
  }
  if (invoice.paidAt) {
    lineasDetalle.push(`Pagada: ${formatDateTime(invoice.paidAt)}`);
  }

  // Alto comun: el que necesite la card mas larga, con un minimo de 36 para
  // que no se encoja respecto del diseno anterior.
  const cardH = Math.max(
    36,
    20 + lineasCliente.length * 5,
    26 + lineasDetalle.length * 5,
  );

  // Card cliente
  drawRoundedRect(doc, M, y, colW, cardH, 2, C.bg, C.border);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.textMuted);
  doc.text('CLIENTE', M + 5, y + 6);

  const name = customer?.name || invoice.customerName || 'No especificado';
  doc.setFont(FONT, 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...C.text);
  doc.text(name, M + 5, y + 14);

  doc.setFontSize(8);
  let infoY = y + 20;
  lineasCliente.forEach((l) => {
    const color = l.bold ? C.text : C.textMuted;
    doc.setFont(FONT, l.bold ? 'bold' : 'normal');
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(l.texto, M + 5, infoY);
    infoY += 5;
  });

  // Card estado
  const sx = M + colW + 6;
  drawRoundedRect(doc, sx, y, colW, cardH, 2, C.bg, C.border);

  doc.setFont(FONT, 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.textMuted);
  doc.text('DETALLES', sx + 5, y + 6);

  const statusLabels: Record<string, string> = {
    PAID: 'Pagada',
    PENDING: 'Pendiente',
    PARTIALLY_PAID: 'Parcial',
    OVERDUE: 'Vencida',
    CANCELLED: 'Cancelada',
  };
  const statusColors: Record<string, readonly [number, number, number]> = {
    PAID: C.success,
    PENDING: C.error,
    PARTIALLY_PAID: C.warning,
    OVERDUE: C.error,
    CANCELLED: C.textMuted,
  };

  // El backend devuelve el status en minusculas ("pending"); normalizar para
  // que el badge muestre la etiqueta en espanol y no el enum crudo.
  const statusKey = String(invoice.status || '').toUpperCase();
  const statusText = statusLabels[statusKey] || invoice.status;
  const statusColor = statusColors[statusKey] || C.text;

  // Badge de estado
  const badgeW = doc.getTextWidth(statusText) + 8;
  drawRoundedRect(doc, sx + 5, y + 9, badgeW, 7, 1.5, statusColor);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.white);
  doc.text(statusText, sx + 5 + badgeW / 2, y + 13.5, { align: 'center' });

  doc.setFont(FONT, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.textMuted);
  let detY = y + 22;
  lineasDetalle.forEach((l) => {
    doc.text(l, sx + 5, detY);
    detY += 5;
  });

  return y + cardH + 6;
}

const PAID_STATUS_LABEL = {
  paid: 'Pagado',
  partial: 'Parcial',
  pending: 'Pendiente',
} as const;

const PAID_STATUS_COLOR = {
  paid: C.success,
  partial: C.amberDark,
  pending: C.textMuted,
} as const;

function drawItemsTable(doc: jsPDF, y: number, invoice: Invoice): number {
  // ¿Hay reparto de abono? (algun item trae paidStatus) → columna "Estado"
  const hasPaidInfo = (invoice.items || []).some((it) => !!it.paidStatus);

  // Titulo de seccion
  doc.setFont(FONT, 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.amber);
  doc.text('PRODUCTOS', M, y + 4);
  doc.setDrawColor(...C.amber);
  doc.setLineWidth(0.5);
  doc.line(M, y + 6, M + 22, y + 6);

  y += 10;

  // Leyenda: explica que los "Pagados" ya estan cubiertos por el abono, para
  // que el cliente no crea que se le recobra lo mismo.
  if (hasPaidInfo) {
    doc.setFont(FONT, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.textMuted);
    doc.text(
      'Los productos marcados como Pagados ya fueron cubiertos por su abono. Solo se cobra lo Pendiente.',
      M,
      y,
    );
    y += 5;
  }

  const colCount = hasPaidInfo ? 5 : 4;

  // Items con quantity === -1 se renderizan como section header (colspan, bold, amber)
  // Convencion usada por desglose de cuentas consolidadas.
  const rows = (invoice.items || []).map((item) => {
    const isHeader = item.quantity === -1;
    if (isHeader) {
      return [
        {
          content: item.description || '',
          colSpan: colCount,
          styles: {
            fillColor: C.amber as unknown as [number, number, number],
            textColor: C.white as unknown as [number, number, number],
            fontStyle: 'bold' as const,
            fontSize: 8.5,
            halign: 'left' as const,
            cellPadding: 3,
          },
        },
      ];
    }
    const base = [
      item.description || 'Sin descripcion',
      (item.quantity || 0).toString(),
      `$${(item.unitPrice || 0).toFixed(2)}`,
      `$${(item.total || 0).toFixed(2)}`,
    ];
    if (!hasPaidInfo) return base;

    const status = item.paidStatus ?? 'pending';
    const label =
      status === 'partial' && item.paidPortion
        ? `Parcial $${item.paidPortion.toFixed(2)}`
        : PAID_STATUS_LABEL[status];
    return [
      ...base,
      {
        content: label,
        styles: {
          textColor: PAID_STATUS_COLOR[status] as unknown as [
            number,
            number,
            number,
          ],
          fontStyle: 'bold' as const,
          halign: 'center' as const,
          fontSize: 7.5,
        },
      },
    ];
  });

  const columnStyles: Record<number, Record<string, unknown>> = hasPaidInfo
    ? {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 16, halign: 'center' },
        2: { cellWidth: 24, halign: 'right' },
        3: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
        4: { cellWidth: 26, halign: 'center' },
      }
    : {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 22, halign: 'center' },
        2: { cellWidth: 28, halign: 'right' },
        3: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
      };

  autoTable(doc, {
    startY: y,
    head: [
      hasPaidInfo
        ? ['Producto', 'Cant.', 'P. Unit.', 'Total', 'Estado']
        : ['Producto', 'Cant.', 'P. Unit.', 'Total'],
    ],
    body: rows as unknown as RowInput[],
    theme: 'plain',
    headStyles: {
      // @ts-expect-error jspdf-autotable types
      fillColor: C.dark,
      // @ts-expect-error jspdf-autotable types
      textColor: C.white,
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 3,
    },
    bodyStyles: {
      fontSize: 8.5,
      // @ts-expect-error jspdf-autotable types
      textColor: C.text,
      cellPadding: 3,
      // @ts-expect-error jspdf-autotable types
      lineColor: C.border,
      lineWidth: 0.2,
    },
    alternateRowStyles: {
      fillColor: [252, 251, 250],
    },
    margin: { left: M, right: M },
    columnStyles: columnStyles,
  });

  return (doc as jsPDFWithAutoTable).lastAutoTable.finalY + 8;
}

function drawTotals(doc: jsPDF, y: number, invoice: Invoice): number {
  const boxW = 85;
  const boxX = rightX - boxW;
  const {
    subtotal,
    tax,
    tip,
    serviceCharge,
    total,
    paid,
    balance,
    hasPayments,
  } = computeInvoiceTotals({
    subtotal: invoice.subtotal,
    tax: invoice.tax,
    tip: invoice.tip,
    total: invoice.total,
    paidAmount: invoice.paidAmount,
  });
  const hasService = serviceCharge > 0.01;
  const hasTip = tip > 0.01;
  // Una factura fiscal (la que lleva numero de control) tiene que mostrar la
  // base imponible y la alicuota SIEMPRE, incluso en cero: si la linea
  // desaparece, el papel no dice cuanto IVA se cobro. En una cuenta interna
  // del POS se mantiene el comportamiento de antes para no cambiarle el
  // aspecto a las 5.200 facturas que ya existen.
  const esFiscal = Boolean(invoice.controlNumber);
  const muestraIva = tax > 0 || esFiscal;

  // Calcular altura dinamica
  let rows = 2; // base/subtotal + total
  if (hasService) rows++;
  if (muestraIva) rows++;
  if (hasTip) rows++;
  if (hasPayments) rows += 2; // total facturado + abonado
  const rowH = 9;
  const totalRowH = 12;
  const boxH = rows * rowH + totalRowH + 8;

  // Fondo
  drawRoundedRect(doc, boxX, y, boxW, boxH, 3, C.bg, C.border);

  let lineY = y + 8;
  const labelX = boxX + 6;
  const valX = boxX + boxW - 6;

  // Base imponible (o subtotal, en una cuenta interna del POS)
  doc.setFont(FONT, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...C.textMuted);
  doc.text(esFiscal ? 'Base imponible' : 'Subtotal', labelX, lineY);
  doc.setTextColor(...C.text);
  doc.text(`$${subtotal.toFixed(2)}`, valX, lineY, { align: 'right' });
  lineY += rowH;

  // Servicio 10%
  if (hasService) {
    doc.setTextColor(...C.textMuted);
    doc.text(etiquetaServicio, labelX, lineY);
    doc.setTextColor(...C.amber);
    doc.setFont(FONT, 'bold');
    doc.text(`$${serviceCharge.toFixed(2)}`, valX, lineY, { align: 'right' });
    doc.setFont(FONT, 'normal');
    lineY += rowH;
  }

  // IVA: con el monto calculado si hay base, y la alicuota general cuando la
  // factura es fiscal y el impuesto quedo en cero (asi el papel dice "0,00" en
  // lugar de callar la linea).
  if (muestraIva) {
    const pct =
      tax > 0 && subtotal > 0
        ? ((tax / subtotal) * 100).toFixed(0)
        : String(Math.round(tarifasPdf.tax.rate * 1000) / 10);
    doc.setTextColor(...C.textMuted);
    doc.text(`${tarifasPdf.tax.label} (${pct}%)`, labelX, lineY);
    doc.setTextColor(...C.text);
    doc.text(`$${tax.toFixed(2)}`, valX, lineY, { align: 'right' });
    lineY += rowH;
  }

  // Propina
  if (hasTip) {
    doc.setTextColor(...C.textMuted);
    doc.text('Propina', labelX, lineY);
    doc.setTextColor(...C.amber);
    doc.setFont(FONT, 'bold');
    doc.text(`$${tip.toFixed(2)}`, valX, lineY, { align: 'right' });
    doc.setFont(FONT, 'normal');
    lineY += rowH;
  }

  // Linea separadora
  lineY += 1;
  doc.setDrawColor(...C.amber);
  doc.setLineWidth(0.8);
  doc.line(labelX, lineY, valX, lineY);
  lineY += 6;

  // Con abonos registrados: total facturado + abonado, y el destacado pasa a ser
  // el saldo pendiente (lo que el cliente realmente debe).
  if (hasPayments) {
    doc.setFont(FONT, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...C.text);
    doc.text('Total facturado', labelX, lineY);
    doc.text(`$${total.toFixed(2)}`, valX, lineY, { align: 'right' });
    lineY += rowH;

    doc.setFont(FONT, 'normal');
    doc.setTextColor(...C.textMuted);
    doc.text('Abonado', labelX, lineY);
    doc.setFont(FONT, 'bold');
    doc.setTextColor(...C.success);
    doc.text(`-$${paid.toFixed(2)}`, valX, lineY, { align: 'right' });
    lineY += rowH - 2;
  }

  // Destacado con fondo amber: saldo pendiente si hubo abonos, total si no
  drawRoundedRect(doc, boxX + 3, lineY - 4, boxW - 6, 12, 2, C.amber);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(hasPayments ? 10 : 12);
  doc.setTextColor(...C.white);
  doc.text(hasPayments ? 'SALDO PENDIENTE' : 'TOTAL', labelX + 3, lineY + 4);
  doc.setFontSize(12);
  doc.text(
    `$${(hasPayments ? balance : total).toFixed(2)}`,
    valX - 3,
    lineY + 4,
    { align: 'right' },
  );

  return y + boxH + 6;
}

function drawNotes(doc: jsPDF, y: number, notes: string): number {
  drawRoundedRect(doc, M, y, CW, 5, 1, C.amberLight);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.amberDark);
  doc.text('NOTAS', M + 4, y + 3.5);

  doc.setFont(FONT, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.text);
  const lines = doc.splitTextToSize(notes, CW - 10);
  doc.text(lines, M + 4, y + 10);

  return y + 12 + lines.length * 4;
}

function drawFooter(doc: jsPDF): void {
  const ph = doc.internal.pageSize.height;

  // Linea amber
  doc.setDrawColor(...C.amber);
  doc.setLineWidth(0.5);
  doc.line(M, ph - 18, rightX, ph - 18);

  doc.setFont(FONT, 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.textMuted);
  doc.text(
    `${EMISOR.razonSocial}  |  RIF: ${EMISOR.rif}  |  ${EMISOR.web}`,
    PW / 2,
    ph - 13,
    { align: 'center' },
  );
  doc.text(
    `Documento generado el ${formatDateTime(new Date())}`,
    PW / 2,
    ph - 9,
    { align: 'center' },
  );
}

// --- Funcion Principal ---

export const generateInvoicePDF = ({
  invoice,
  customer,
  contexto,
}: PDFData): jsPDF => {
  fijarContexto(contexto);
  const doc = new jsPDF();
  const ph = doc.internal.pageSize.height;
  const footerZone = 25;

  let y = drawHeader(doc, invoice);
  y += 4;
  y = drawClientAndStatus(doc, y, invoice, customer);
  y += 4;
  y = drawItemsTable(doc, y, invoice);

  // El bloque de totales crece cuando hay abonos (2 filas extra)
  const TOTALS_HEIGHT = computeInvoiceTotals({
    total: invoice.total,
    paidAmount: invoice.paidAmount,
  }).hasPayments
    ? 90
    : 70;
  if (y + TOTALS_HEIGHT > ph - footerZone) {
    doc.addPage();
    y = M;
  }
  y = drawTotals(doc, y, invoice);

  if (invoice.notes) {
    const notesH = doc.splitTextToSize(invoice.notes, CW - 10).length * 4 + 15;
    if (y + notesH > ph - footerZone) {
      doc.addPage();
      y = M;
    }
    y = drawNotes(doc, y, invoice.notes);
  }

  const jsPDFInternal = doc as unknown as {
    internal: { getNumberOfPages(): number };
  };
  const pages = jsPDFInternal.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    drawFooter(doc);
  }

  return doc;
};

// --- Exportacion ---

export const downloadInvoicePDF = (
  invoice: Invoice,
  customer: Customer | null | undefined,
  contexto: ContextoPdf,
): void => {
  const doc = generateInvoicePDF({ invoice, customer, contexto });
  const fileName = `factura-${invoice.invoiceNumber}-${formatDate(invoice.createdAt).replace(/\s/g, '-')}.pdf`;
  doc.save(fileName);
};

export const previewInvoicePDF = (
  invoice: Invoice,
  customer: Customer | null | undefined,
  contexto: ContextoPdf,
): void => {
  const doc = generateInvoicePDF({ invoice, customer, contexto });
  const pdfBlob = doc.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);
  window.open(pdfUrl, '_blank');
};

// =============================================================================
// --- Presupuesto (Budget) PDF ---
// =============================================================================

function drawBudgetHeader(doc: jsPDF, budget: Budget): number {
  // Barra superior dark
  doc.setFillColor(...C.dark);
  doc.rect(0, 0, PW, 38, 'F');

  // Acento amber
  doc.setFillColor(...C.amber);
  doc.rect(0, 38, PW, 2, 'F');

  // Nombre del restaurante
  doc.setTextColor(...C.white);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(22);
  doc.text(EMISOR.nombreComercial, M, 18);

  doc.setFont(FONT, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(200, 200, 200);
  doc.text(`${EMISOR.rubro}  |  ${EMISOR.domicilioFiscal}`, M, 26);
  doc.text(`Tel: ${EMISOR.telefono}`, M, 32);

  // Numero de presupuesto (derecha)
  doc.setTextColor(...C.amberLight);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(11);
  doc.text('PRESUPUESTO', rightX, 16, { align: 'right' });

  doc.setTextColor(...C.white);
  doc.setFontSize(14);
  doc.text(`#${budget.budgetNumber}`, rightX, 24, { align: 'right' });

  doc.setFont(FONT, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 180);
  doc.text(formatDate(budget.createdAt), rightX, 32, { align: 'right' });

  return 48;
}

function drawBudgetClientAndEvent(
  doc: jsPDF,
  y: number,
  budget: Budget,
): number {
  const colW = CW / 2 - 3;

  // Card cliente
  drawRoundedRect(doc, M, y, colW, 36, 2, C.bg, C.border);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.textMuted);
  doc.text('CLIENTE', M + 5, y + 6);

  doc.setFont(FONT, 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...C.text);
  doc.text(budget.customerName || 'No especificado', M + 5, y + 14);

  doc.setFont(FONT, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.textMuted);
  let infoY = y + 20;
  if (budget.customerPhone) {
    doc.text(`Tel: ${budget.customerPhone}`, M + 5, infoY);
    infoY += 5;
  }
  if (budget.customerEmail) {
    doc.text(budget.customerEmail, M + 5, infoY);
  }

  // Card evento
  const sx = M + colW + 6;
  drawRoundedRect(doc, sx, y, colW, 36, 2, C.bg, C.border);

  doc.setFont(FONT, 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.textMuted);
  doc.text('EVENTO', sx + 5, y + 6);

  // Badge de estado
  const budgetStatusLabels: Record<BudgetStatusEnum, string> = {
    [BudgetStatusEnum.DRAFT]: 'Borrador',
    [BudgetStatusEnum.SENT]: 'Enviado',
    [BudgetStatusEnum.APPROVED]: 'Aprobado',
    [BudgetStatusEnum.REJECTED]: 'Rechazado',
    [BudgetStatusEnum.EXPIRED]: 'Expirado',
  };
  const budgetStatusColors: Record<
    BudgetStatusEnum,
    readonly [number, number, number]
  > = {
    [BudgetStatusEnum.DRAFT]: C.textMuted,
    [BudgetStatusEnum.SENT]: [59, 130, 246] as const, // blue-500
    [BudgetStatusEnum.APPROVED]: C.success,
    [BudgetStatusEnum.REJECTED]: C.error,
    [BudgetStatusEnum.EXPIRED]: [249, 115, 22] as const, // orange-500
  };

  const statusText = budgetStatusLabels[budget.status] || budget.status;
  const statusColor = budgetStatusColors[budget.status] || C.text;

  const badgeW = doc.getTextWidth(statusText) + 8;
  drawRoundedRect(doc, sx + 5, y + 9, badgeW, 7, 1.5, statusColor);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.white);
  doc.text(statusText, sx + 5 + badgeW / 2, y + 13.5, { align: 'center' });

  doc.setFont(FONT, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.textMuted);
  let detY = y + 22;
  doc.text(budget.eventName, sx + 5, detY);
  detY += 5;
  if (budget.eventDate) {
    doc.text(`Fecha: ${formatDate(budget.eventDate)}`, sx + 5, detY);
    detY += 5;
  }
  if (budget.eventGuests) {
    doc.text(`${budget.eventGuests} invitados`, sx + 5, detY);
  }

  return y + 42;
}

function drawBudgetItemsTable(doc: jsPDF, y: number, budget: Budget): number {
  // Titulo de seccion
  doc.setFont(FONT, 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.amber);
  doc.text('PRODUCTOS', M, y + 4);
  doc.setDrawColor(...C.amber);
  doc.setLineWidth(0.5);
  doc.line(M, y + 6, M + 22, y + 6);

  y += 10;

  const rows = (budget.items || []).map((item) => [
    item.name || item.description || 'Sin descripcion',
    (item.quantity || 0).toString(),
    `$${(item.unitPrice || 0).toFixed(2)}`,
    `$${(item.total || 0).toFixed(2)}`,
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Producto', 'Cant.', 'P. Unit.', 'Total']],
    body: rows,
    theme: 'plain',
    headStyles: {
      // @ts-expect-error jspdf-autotable types
      fillColor: C.dark,
      // @ts-expect-error jspdf-autotable types
      textColor: C.white,
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 3,
    },
    bodyStyles: {
      fontSize: 8.5,
      // @ts-expect-error jspdf-autotable types
      textColor: C.text,
      cellPadding: 3,
      // @ts-expect-error jspdf-autotable types
      lineColor: C.border,
      lineWidth: 0.2,
    },
    alternateRowStyles: {
      fillColor: [252, 251, 250],
    },
    margin: { left: M, right: M },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 22, halign: 'center' },
      2: { cellWidth: 28, halign: 'right' },
      3: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
    },
  });

  return (doc as jsPDFWithAutoTable).lastAutoTable.finalY + 8;
}

function drawBudgetTotals(doc: jsPDF, y: number, budget: Budget): number {
  const boxW = 85;
  const boxX = rightX - boxW;
  const subtotal = budget.subtotal || 0;
  const serviceCharge = budget.serviceCharge || 0;
  const discount = budget.discount || 0;
  const total = budget.total || 0;

  // Calcular altura dinamica
  let rows = 2; // subtotal + total
  if (serviceCharge > 0) rows++;
  if (discount > 0) rows++;
  const rowH = 9;
  const totalRowH = 12;
  const boxH = rows * rowH + totalRowH + 8;

  // Fondo
  drawRoundedRect(doc, boxX, y, boxW, boxH, 3, C.bg, C.border);

  let lineY = y + 8;
  const labelX = boxX + 6;
  const valX = boxX + boxW - 6;

  // Subtotal
  doc.setFont(FONT, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...C.textMuted);
  doc.text('Subtotal', labelX, lineY);
  doc.setTextColor(...C.text);
  doc.text(`$${subtotal.toFixed(2)}`, valX, lineY, { align: 'right' });
  lineY += rowH;

  // Servicio 10%
  if (serviceCharge > 0) {
    doc.setTextColor(...C.textMuted);
    doc.text('Servicio (10%)', labelX, lineY);
    doc.setTextColor(...C.amber);
    doc.setFont(FONT, 'bold');
    doc.text(`$${serviceCharge.toFixed(2)}`, valX, lineY, { align: 'right' });
    doc.setFont(FONT, 'normal');
    lineY += rowH;
  }

  // Descuento
  if (discount > 0) {
    doc.setTextColor(...C.textMuted);
    const discountLabel =
      budget.discountType === 'percentage'
        ? `Descuento (${budget.discountValue}%)`
        : 'Descuento';
    doc.text(discountLabel, labelX, lineY);
    doc.setTextColor(...C.error);
    doc.setFont(FONT, 'bold');
    doc.text(`-$${discount.toFixed(2)}`, valX, lineY, { align: 'right' });
    doc.setFont(FONT, 'normal');
    lineY += rowH;
  }

  // Linea separadora
  lineY += 1;
  doc.setDrawColor(...C.amber);
  doc.setLineWidth(0.8);
  doc.line(labelX, lineY, valX, lineY);
  lineY += 6;

  // Total con fondo amber
  drawRoundedRect(doc, boxX + 3, lineY - 4, boxW - 6, 12, 2, C.amber);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...C.white);
  doc.text('TOTAL', labelX + 3, lineY + 4);
  doc.text(`$${total.toFixed(2)}`, valX - 3, lineY + 4, { align: 'right' });

  return y + boxH + 6;
}

function drawBudgetValidity(doc: jsPDF, y: number, validUntil: Date): number {
  const text = `Valido hasta: ${formatDate(validUntil)}`;
  const textW = doc.getTextWidth(text) + 16;
  const boxX = M;

  drawRoundedRect(doc, boxX, y, textW + 10, 10, 2, C.amberLight, C.amber);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.amberDark);
  doc.text(text, boxX + 5, y + 6.5);

  return y + 16;
}

// --- Funcion Principal de Presupuesto ---

export const generateBudgetPDF = (
  budget: Budget,
  contexto: ContextoPdf,
): jsPDF => {
  fijarContexto(contexto);
  const doc = new jsPDF();
  const ph = doc.internal.pageSize.height;
  const footerZone = 25;

  let y = drawBudgetHeader(doc, budget);
  y += 4;
  y = drawBudgetClientAndEvent(doc, y, budget);
  y += 4;
  y = drawBudgetItemsTable(doc, y, budget);

  const TOTALS_HEIGHT = 70;
  if (y + TOTALS_HEIGHT > ph - footerZone) {
    doc.addPage();
    y = M;
  }
  y = drawBudgetTotals(doc, y, budget);

  if (budget.notes) {
    const notesH = doc.splitTextToSize(budget.notes, CW - 10).length * 4 + 15;
    if (y + notesH > ph - footerZone) {
      doc.addPage();
      y = M;
    }
    y = drawNotes(doc, y, budget.notes);
  }

  if (budget.validUntil) {
    const validityH = 18;
    if (y + validityH > ph - footerZone) {
      doc.addPage();
      y = M;
    }
    y = drawBudgetValidity(doc, y, budget.validUntil);
  }

  const jsPDFInternal = doc as unknown as {
    internal: { getNumberOfPages(): number };
  };
  const pages = jsPDFInternal.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    drawFooter(doc);
  }

  return doc;
};

// --- Exportacion de Presupuesto ---

export const downloadBudgetPDF = (
  budget: Budget,
  contexto: ContextoPdf,
): void => {
  const doc = generateBudgetPDF(budget, contexto);
  const fileName = `presupuesto-${budget.budgetNumber}-${formatDate(budget.createdAt).replace(/\s/g, '-')}.pdf`;
  doc.save(fileName);
};

export const previewBudgetPDF = (
  budget: Budget,
  contexto: ContextoPdf,
): void => {
  const doc = generateBudgetPDF(budget, contexto);
  const pdfBlob = doc.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);
  window.open(pdfUrl, '_blank');
};

// =============================================================================
// --- Acuse de Recibo (reserva de evento con abono) ---
// =============================================================================

export interface AcuseReciboData {
  budget: Budget;
  representativeName: string;
  representativeCI: string;
  contexto: ContextoPdf;
}

function amountToWordsUSD(amount: number): string {
  const integers: Record<number, string> = {
    0: 'CERO',
    1: 'UNO',
    2: 'DOS',
    3: 'TRES',
    4: 'CUATRO',
    5: 'CINCO',
    6: 'SEIS',
    7: 'SIETE',
    8: 'OCHO',
    9: 'NUEVE',
    10: 'DIEZ',
    11: 'ONCE',
    12: 'DOCE',
    13: 'TRECE',
    14: 'CATORCE',
    15: 'QUINCE',
    16: 'DIECISÉIS',
    17: 'DIECISIETE',
    18: 'DIECIOCHO',
    19: 'DIECINUEVE',
    20: 'VEINTE',
    30: 'TREINTA',
    40: 'CUARENTA',
    50: 'CINCUENTA',
    60: 'SESENTA',
    70: 'SETENTA',
    80: 'OCHENTA',
    90: 'NOVENTA',
    100: 'CIEN',
    200: 'DOSCIENTOS',
    300: 'TRESCIENTOS',
    400: 'CUATROCIENTOS',
    500: 'QUINIENTOS',
    600: 'SEISCIENTOS',
    700: 'SETECIENTOS',
    800: 'OCHOCIENTOS',
    900: 'NOVECIENTOS',
  };

  function toWords(n: number): string {
    if (n === 0) return '';
    if (n <= 20) return integers[n] || '';
    if (n < 100) {
      const tens = Math.floor(n / 10) * 10;
      const ones = n % 10;
      return ones === 0
        ? integers[tens]
        : `${integers[tens]} Y ${integers[ones]}`;
    }
    if (n === 100) return 'CIEN';
    if (n < 200) return `CIENTO ${toWords(n - 100)}`.trim();
    if (n < 1000) {
      const hundreds = Math.floor(n / 100) * 100;
      const rest = n % 100;
      return rest === 0
        ? integers[hundreds]
        : `${integers[hundreds]} ${toWords(rest)}`.trim();
    }
    if (n < 2000) return `MIL ${toWords(n - 1000)}`.trim();
    if (n < 1000000) {
      const thousands = Math.floor(n / 1000);
      const rest = n % 1000;
      return rest === 0
        ? `${toWords(thousands)} MIL`
        : `${toWords(thousands)} MIL ${toWords(rest)}`.trim();
    }
    return n.toString();
  }

  const rounded = Math.round(amount * 100) / 100;
  const intPart = Math.floor(rounded);
  const centsPart = Math.round((rounded - intPart) * 100);
  const centsStr = centsPart.toString().padStart(2, '0');
  const words = toWords(intPart) || 'CERO';
  return `${words} DÓLARES AMERICANOS CON ${centsStr}/100`;
}

function formatDateLong(date: Date | string | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  return d.toLocaleDateString('es-VE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatDateShort(date: Date | string | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  return d.toLocaleDateString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function getDayOfWeek(date: Date | string | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  const days = [
    'domingo',
    'lunes',
    'martes',
    'miércoles',
    'jueves',
    'viernes',
    'sábado',
  ];
  return days[d.getUTCDay()];
}

export const generateAcuseRecibo = (data: AcuseReciboData): jsPDF => {
  const { budget, representativeName, representativeCI, contexto } = data;
  fijarContexto(contexto);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageW = 210;
  const pageH = 297;
  const marginX = 20;
  const contentW = pageW - marginX * 2;
  let y = 0;

  // ── Header ──────────────────────────────────────────────────────────────────
  doc.setFillColor(...C.dark);
  doc.rect(0, 0, pageW, 28, 'F');
  doc.setFillColor(...C.amber);
  doc.rect(0, 28, pageW, 1.5, 'F');

  doc.setFont(FONT, 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...C.white);
  doc.text(EMISOR.nombreComercial.toUpperCase(), pageW / 2, 14, {
    align: 'center',
  });
  doc.setFont(FONT, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(180, 170, 160);
  doc.text(EMISOR.domicilioFiscal, pageW / 2, 22, {
    align: 'center',
  });

  y = 38;

  // ── Título ACUSE DE RECIBO ───────────────────────────────────────────────────
  doc.setFont(FONT, 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...C.dark);
  doc.text('ACUSE DE RECIBO', pageW / 2, y, { align: 'center' });
  y += 6;
  doc.setFont(FONT, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...C.textMuted);
  const emisionDate = budget.abonoDate
    ? formatDateLong(budget.abonoDate)
    : formatDateLong(new Date());
  doc.text(
    `Reserva de evento  ·  Fecha de emisión: ${emisionDate}`,
    pageW / 2,
    y,
    { align: 'center' },
  );
  y += 3;

  // Línea decorativa
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.4);
  doc.line(marginX, y, pageW - marginX, y);
  y += 7;

  // ── Tabla dos columnas: DATOS DEL CLIENTE | RECIBIDO POR ───────────────────
  const colW = contentW / 2 - 3;
  const tableH = 30;
  const tableY = y;

  // Fondo headers
  doc.setFillColor(...C.dark);
  doc.rect(marginX, tableY, colW, 8, 'F');
  doc.rect(marginX + colW + 6, tableY, colW, 8, 'F');

  doc.setFont(FONT, 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.white);
  doc.text('DATOS DEL CLIENTE', marginX + 4, tableY + 5.5);
  doc.text('RECIBIDO POR', marginX + colW + 6 + 4, tableY + 5.5);

  // Bordes de las celdas de contenido
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.rect(marginX, tableY + 8, colW, tableH, 'S');
  doc.rect(marginX + colW + 6, tableY + 8, colW, tableH, 'S');

  // Contenido cliente
  doc.setFont(FONT, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...C.textMuted);
  doc.text('Nombre:', marginX + 4, tableY + 15);
  doc.setFont(FONT, 'bold');
  doc.setTextColor(...C.text);
  doc.text(budget.customerName || '—', marginX + 22, tableY + 15);

  doc.setFont(FONT, 'normal');
  doc.setTextColor(...C.textMuted);
  doc.text('C.I.:', marginX + 4, tableY + 22);
  doc.setFont(FONT, 'bold');
  doc.setTextColor(...C.text);
  const customerCI = budget.customerRif
    ? `${budget.customerIdType ?? 'V'}-${budget.customerRif}`
    : '—';
  doc.text(customerCI, marginX + 22, tableY + 22);

  doc.setFont(FONT, 'normal');
  doc.setTextColor(...C.textMuted);
  doc.text('Teléfono:', marginX + 4, tableY + 29);
  doc.setFont(FONT, 'bold');
  doc.setTextColor(...C.text);
  doc.text(budget.customerPhone || '—', marginX + 22, tableY + 29);

  // Contenido recibido por
  const rx = marginX + colW + 6 + 4;
  doc.setFont(FONT, 'normal');
  doc.setTextColor(...C.textMuted);
  doc.text('Nombre:', rx, tableY + 15);
  doc.setFont(FONT, 'bold');
  doc.setTextColor(...C.text);
  doc.text(representativeName, rx + 18, tableY + 15);

  doc.setFont(FONT, 'normal');
  doc.setTextColor(...C.textMuted);
  doc.text('C.I.:', rx, tableY + 22);
  doc.setFont(FONT, 'bold');
  doc.setTextColor(...C.text);
  doc.text(`V-${representativeCI}`, rx + 18, tableY + 22);

  doc.setFont(FONT, 'normal');
  doc.setTextColor(...C.textMuted);
  doc.text('En representación de:', rx, tableY + 29);
  doc.setFont(FONT, 'bold');
  doc.setTextColor(...C.text);
  doc.text(EMISOR.nombreComercial, rx, tableY + 34);

  y = tableY + tableH + 14;

  // ── Párrafo cuerpo ───────────────────────────────────────────────────────────
  const abonoAmount = budget.abonoAmount ?? 0;
  const saldo = Math.max(0, budget.total - abonoAmount);
  const abonoWords = amountToWordsUSD(abonoAmount);
  const eventDateLong = formatDateLong(budget.eventDate);
  const dayOfWeek = getDayOfWeek(budget.eventDate);
  const abonoDateShort = formatDateShort(budget.abonoDate ?? new Date());

  const bodyText =
    `Por medio del presente documento, yo ${representativeName}, titular de la Cédula de Identidad ` +
    `N° V-${representativeCI}, actuando en representación de ${EMISOR.nombreComercial}, dejo constancia de haber ` +
    `recibido en esta fecha, ${emisionDate}, de la ciudadana ${budget.customerName}, titular de la ` +
    `Cédula de Identidad N° ${customerCI}, la cantidad de ${abonoWords} ` +
    `(USD ${abonoAmount.toFixed(2)}), como abono inicial al presupuesto total de USD ${budget.total.toFixed(2)} ` +
    `correspondiente a la reserva de evento a celebrarse el día ${dayOfWeek} ${eventDateLong} en las ` +
    `instalaciones de ${EMISOR.nombreComercial}, quedando un saldo pendiente de USD ${saldo.toFixed(2)} por cancelar.`;

  doc.setFont(FONT, 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...C.text);

  // Simplificado: renderizar todo el párrafo en normal con wrapper manual
  // jsPDF no soporta bold inline fácilmente — usamos el texto completo en normal
  // y luego reescribimos las partes en bold por encima.
  const lines = doc.splitTextToSize(bodyText, contentW);
  doc.text(lines, marginX, y, { lineHeightFactor: 1.5 });
  y += lines.length * 5 + 8;

  // ── Tabla resumen ────────────────────────────────────────────────────────────
  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [['Concepto', 'Monto (USD)']],
    body: [
      [
        `Presupuesto total — Reserva evento ${formatDateShort(budget.eventDate)}`,
        budget.total.toFixed(2),
      ],
      [`Abono recibido el ${abonoDateShort}`, abonoAmount.toFixed(2)],
      ['SALDO PENDIENTE', saldo.toFixed(2)],
    ],
    styles: {
      font: FONT,
      fontSize: 9.5,
      textColor: C.text as unknown as [number, number, number],
    },
    headStyles: {
      fillColor: C.dark as unknown as [number, number, number],
      textColor: C.white as unknown as [number, number, number],
      fontStyle: 'bold',
      halign: 'left',
    },
    columnStyles: {
      0: { halign: 'left' },
      1: { halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (hookData) => {
      // Última fila (SALDO PENDIENTE) con color amber
      if (hookData.row.index === 2 && hookData.section === 'body') {
        hookData.cell.styles.fillColor = C.amberLight as unknown as [
          number,
          number,
          number,
        ];
        hookData.cell.styles.textColor = C.amberDark as unknown as [
          number,
          number,
          number,
        ];
        hookData.cell.styles.fontStyle = 'bold';
      }
    },
  });

  const jsPDFLastAutoTable = doc as unknown as jsPDFWithAutoTable;
  y = jsPDFLastAutoTable.lastAutoTable.finalY + 10;

  // ── Párrafo de cierre ────────────────────────────────────────────────────────
  const closingText =
    `Con la firma del presente acuse, ambas partes dejan constancia de la conformidad respecto al ` +
    `monto abonado y a la reserva pactada para la fecha indicada. El saldo pendiente de USD ${saldo.toFixed(2)} ` +
    `deberá ser cancelado antes del inicio del evento. Cualquier modificación, cancelación o ` +
    `reprogramación deberá ser comunicada por escrito y estará sujeta a las políticas internas de ${EMISOR.nombreComercial}.`;

  doc.setFont(FONT, 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...C.text);
  const closingLines = doc.splitTextToSize(closingText, contentW);
  doc.text(closingLines, marginX, y, { lineHeightFactor: 1.5 });
  y += closingLines.length * 5 + 16;

  // ── Líneas de firma ──────────────────────────────────────────────────────────
  const signW = 70;
  const signLeft = marginX;
  const signRight = pageW - marginX - signW;

  // Línea izquierda (cliente)
  doc.setDrawColor(...C.dark);
  doc.setLineWidth(0.5);
  doc.line(signLeft, y, signLeft + signW, y);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.text);
  doc.text(budget.customerName, signLeft + signW / 2, y + 5, {
    align: 'center',
  });
  doc.setFont(FONT, 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.textMuted);
  doc.text(customerCI, signLeft + signW / 2, y + 10, { align: 'center' });
  doc.text('Cliente', signLeft + signW / 2, y + 15, { align: 'center' });

  // Línea derecha (representante)
  doc.setDrawColor(...C.dark);
  doc.setLineWidth(0.5);
  doc.line(signRight, y, signRight + signW, y);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.text);
  doc.text(representativeName, signRight + signW / 2, y + 5, {
    align: 'center',
  });
  doc.setFont(FONT, 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.textMuted);
  doc.text(`V-${representativeCI}`, signRight + signW / 2, y + 10, {
    align: 'center',
  });
  doc.text(EMISOR.nombreComercial, signRight + signW / 2, y + 15, {
    align: 'center',
  });

  // ── Footer ───────────────────────────────────────────────────────────────────
  doc.setFillColor(...C.amber);
  doc.rect(0, pageH - 8, pageW, 8, 'F');
  doc.setFont(FONT, 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.white);
  doc.text(
    `${EMISOR.nombreComercial} · ${EMISOR.domicilioFiscal}`,
    pageW / 2,
    pageH - 3,
    { align: 'center' },
  );

  return doc;
};

export const downloadAcuseRecibo = (data: AcuseReciboData): void => {
  const doc = generateAcuseRecibo(data);
  const eventDate = data.budget.eventDate
    ? formatDateShort(data.budget.eventDate).replace(/\//g, '-')
    : 'sin-fecha';
  doc.save(`acuse-recibo-${data.budget.budgetNumber}-${eventDate}.pdf`);
};
