'use client';

import { useContextoPdf } from '@/shared/hooks/useContextoPdf';
import { useState } from 'react';
import { Button } from '@/components/shared/button/Button';
import { Loader2, MessageCircle } from 'lucide-react';
import { Invoice } from '@/modelTypes/invoice';
import { Customer } from '@/modelTypes/customer';
import { generateInvoicePDF } from '@/shared/utils/pdfGenerator';
import { computeInvoiceTotals } from '@/shared/utils/invoiceTotals';
import { formatDate } from '@/shared/utils/dateHelpers';
import { api } from '@/services/api/apiClient';
import { formatearUsd } from '@/shared/utils/dinero';

interface ShareWhatsAppButtonProps {
  invoice: Invoice;
  customer?: Customer | null;
  phone?: string | null;
  accountId?: string;
}

/**
 * Convierte un Blob a base64 (sin el prefijo data:...) para enviar al backend.
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Unexpected reader result'));
        return;
      }
      const base64 = result.split(',')[1] ?? '';
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Normaliza un telefono venezolano a formato E.164 sin +.
 * Ej: "0414-1234567" -> "584141234567"
 */
function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return '';
  let phone = raw.replace(/[\s\-()+]/g, '');
  if (phone.startsWith('0')) phone = '58' + phone.slice(1);
  else if (!phone.startsWith('58')) phone = '58' + phone;
  return phone;
}

export default function ShareWhatsAppButton({
  invoice,
  customer,
  phone,
  accountId,
}: ShareWhatsAppButtonProps) {
  const contexto = useContextoPdf();
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    const target = phone ?? customer?.phone ?? null;
    if (!target) {
      alert('El cliente no tiene telefono registrado.');
      return;
    }

    const normalized = normalizePhone(target);
    if (!/^\d{8,15}$/.test(normalized)) {
      alert(`Telefono invalido: ${target}`);
      return;
    }

    setIsSending(true);
    try {
      // 1. Generar PDF en memoria
      const doc = generateInvoicePDF({ invoice, customer, contexto });
      const pdfBlob = doc.output('blob');
      const pdfBase64 = await blobToBase64(pdfBlob);

      // 2. Preparar variables del template
      // El template `pago_pendiente` informa lo que el cliente debe: si hay
      // abonos registrados, el monto es el saldo, no el total facturado.
      const customerName = customer?.name || invoice.customerName || 'Cliente';
      const { balance } = computeInvoiceTotals({
        subtotal: invoice.subtotal,
        tax: invoice.tax,
        tip: invoice.tip,
        total: invoice.total,
        paidAmount: invoice.paidAmount,
      });
      const amount = formatearUsd(balance);
      const orderCode = invoice.invoiceNumber
        .replace(/\s*\(Consolidada.*?\)\s*$/i, '')
        .slice(0, 30);
      const date = formatDate(invoice.createdAt);
      const pdfFilename = `consumo-${orderCode}.pdf`;

      // 3. Llamar al endpoint del API (proxy al whatsapp-service)
      await api.post('/api/notifications/pago-pendiente', {
        to: normalized,
        customerName,
        amount,
        orderCode,
        date,
        pdfBase64,
        pdfFilename,
        accountReceivableId: accountId,
      });

      alert(`Notificacion enviada a ${target}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      alert(`Error al enviar: ${message}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSend}
      disabled={isSending}
      className="border-ok text-ok hover:bg-ok/10"
    >
      {isSending ? (
        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
      ) : (
        <MessageCircle className="w-4 h-4 mr-1.5" />
      )}
      {isSending ? 'Enviando...' : 'WhatsApp'}
    </Button>
  );
}
