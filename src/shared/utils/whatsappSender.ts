import { Invoice } from '@odin6/types';
import { Customer } from '@odin6/types';
import {
  generateInvoicePDF,
  downloadInvoicePDF,
  type ContextoPdf,
} from './pdfGenerator';
import { computeInvoiceTotals } from './invoiceTotals';

/**
 * Normaliza un número de teléfono venezolano al formato internacional (sin '+')
 * que requiere wa.me/<numero>.
 * Ejemplos:
 *   "0414-1234567" → "584141234567"
 *   "04141234567"  → "584141234567"
 *   "+58 414 1234567" → "584141234567"
 */
export function normalizePhoneForWhatsApp(
  phone?: string | null,
): string | null {
  if (!phone) return null;
  // Eliminar todo lo que no sea dígito
  let digits = phone.replace(/\D/g, '');
  if (!digits) return null;

  // Si empieza con 0 (formato local Venezuela: 0414...) → quitar 0 y anteponer 58
  if (digits.startsWith('0') && digits.length === 11) {
    digits = '58' + digits.substring(1);
  }
  // Si tiene 10 digitos (sin 0 inicial) → anteponer 58
  else if (digits.length === 10) {
    digits = '58' + digits;
  }
  // Si ya empieza con 58 y tiene 12 digitos → ok
  else if (digits.startsWith('58') && digits.length === 12) {
    // ya está bien
  }

  return digits;
}

/**
 * Genera el PDF de la factura como File para usar con Web Share API.
 */
function generateInvoiceFile(
  invoice: Invoice,
  customer: Customer | null | undefined,
  contexto: ContextoPdf,
): File {
  const doc = generateInvoicePDF({ invoice, customer, contexto });
  const blob = doc.output('blob');
  const fileName = `factura-${invoice.invoiceNumber || invoice.id}.pdf`;
  return new File([blob], fileName, { type: 'application/pdf' });
}

/**
 * Construye el mensaje de texto para acompañar la factura.
 */
function buildMessage(
  invoice: Invoice,
  customer: Customer | null | undefined,
  contexto: ContextoPdf,
  reportLink?: string,
): string {
  const customerName = customer?.name || invoice.customerName || 'Cliente';
  const { total, paid, balance, hasPayments } = computeInvoiceTotals({
    subtotal: invoice.subtotal,
    tax: invoice.tax,
    tip: invoice.tip,
    total: invoice.total,
    paidAmount: invoice.paidAmount,
  });

  // Con abonos registrados el monto relevante es el saldo, no el total facturado
  const detalle = hasPayments
    ? `Total facturado: *$${total.toFixed(2)}*\n` +
      `Abonado: *$${paid.toFixed(2)}*\n` +
      `Saldo pendiente: *$${balance.toFixed(2)}*\n\n`
    : `Te enviamos tu factura *#${invoice.invoiceNumber}* por un total de *$${total.toFixed(2)}*.\n\n`;

  const encabezado = hasPayments
    ? `Te enviamos el detalle de tu cuenta *#${invoice.invoiceNumber}*.\n\n`
    : '';

  const base = `Hola ${customerName},\n\n` + encabezado + detalle;

  const linkLine = reportLink
    ? `Para reportar tu pago, ingresa aqui:\n${reportLink}\n\n`
    : '';

  return (
    base +
    linkLine +
    `Gracias por tu preferencia.\n*${contexto.negocio.tradeName}*`
  );
}

export interface SendResult {
  method: 'share' | 'wa-link' | 'failed';
  error?: string;
}

/**
 * Envia la factura por WhatsApp.
 *
 * Estrategia:
 * 1. Intenta usar Web Share API con archivos (mobile + desktop moderno)
 *    → permite adjuntar el PDF directamente y elegir WhatsApp del share sheet
 * 2. Si no hay soporte: descarga el PDF localmente y abre wa.me con mensaje pre-escrito
 *    → el usuario adjunta manualmente el PDF descargado
 */
export async function sendInvoiceViaWhatsApp(
  invoice: Invoice,
  customer: Customer | null | undefined,
  contexto: ContextoPdf,
  reportLink?: string,
): Promise<SendResult> {
  const phone = normalizePhoneForWhatsApp(customer?.phone);
  const message = buildMessage(invoice, customer, contexto, reportLink);

  // 1. Web Share API con archivos
  try {
    const file = generateInvoiceFile(invoice, customer, contexto);
    const shareData = {
      files: [file],
      title: `Factura ${invoice.invoiceNumber}`,
      text: message,
    };

    if (
      typeof navigator !== 'undefined' &&
      navigator.canShare &&
      navigator.canShare(shareData) &&
      navigator.share
    ) {
      await navigator.share(shareData);
      return { method: 'share' };
    }
  } catch (err) {
    // Si el usuario cancela el share, no continuar al fallback
    if (err instanceof Error && err.name === 'AbortError') {
      return { method: 'share' };
    }
    // Otros errores → seguir al fallback
  }

  // 2. Fallback: descargar PDF + abrir wa.me
  try {
    downloadInvoicePDF(invoice, customer, contexto);
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    return { method: 'wa-link' };
  } catch (err) {
    return {
      method: 'failed',
      error: err instanceof Error ? err.message : 'Error desconocido',
    };
  }
}
