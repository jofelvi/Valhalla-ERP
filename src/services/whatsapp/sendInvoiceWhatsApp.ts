'use client';

import { generateInvoicePDF } from '@/shared/utils/pdfGenerator';
import { Invoice, type NegocioConfig, type MarcaConfig } from '@odin6/types';
import { Customer } from '@odin6/types';
import { sendPurchaseReceiptPdf, normalizePhone } from './whatsappService';

/**
 * Convierte un Blob a base64 (sin el prefijo `data:...;base64,`).
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Quitar el prefijo "data:application/pdf;base64,"
      const base64 = result.split(',')[1] ?? '';
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Error al leer el PDF'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Genera el PDF de la factura/precuenta en base64 y lo envia por WhatsApp.
 * El microservicio sube el PDF a Meta Media API (gratis, vive 30 dias).
 * NO usa Firebase Storage para evitar costos.
 *
 * Requiere que el cliente tenga un telefono valido (normalizable).
 */
export async function sendInvoiceWhatsApp(
  invoice: Invoice,
  customer: Customer | null | undefined,
  contexto: { negocio: NegocioConfig; marca: MarcaConfig },
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Validar telefono del cliente
    const rawPhone = customer?.phone?.trim();
    if (!rawPhone) {
      return {
        success: false,
        error: 'El cliente no tiene telefono registrado',
      };
    }
    const phone = normalizePhone(rawPhone);
    if (!phone || phone.length < 10) {
      return { success: false, error: 'Telefono del cliente invalido' };
    }

    // 2. Generar PDF como blob
    const doc = generateInvoicePDF({ invoice, customer, contexto });
    const pdfBlob: Blob = doc.output('blob');

    // 3. Convertir a base64 (sin prefijo data:)
    const pdfBase64 = await blobToBase64(pdfBlob);
    if (!pdfBase64) {
      return { success: false, error: 'No se pudo generar el PDF' };
    }

    // 4. Enviar al microservicio (que sube a Meta y envia el template)
    const orderCode = invoice.invoiceNumber || invoice.id;
    const safeCode = orderCode.replace(/[^a-zA-Z0-9_-]/g, '_');
    const customerName = (
      customer?.name ||
      invoice.customerName ||
      'Cliente'
    ).substring(0, 60);

    await sendPurchaseReceiptPdf({
      to: phone,
      customerName,
      orderCode,
      pdfBase64,
      pdfFilename: `factura-${safeCode}.pdf`,
    });

    return { success: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error desconocido';
    console.error('[sendInvoiceWhatsApp]', message);
    return { success: false, error: message };
  }
}
