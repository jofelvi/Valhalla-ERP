'use client';

import { useContextoPdf } from '@/shared/hooks/useContextoPdf';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/shared/button/Button';
import { Bell, Loader2, MessageCircle } from 'lucide-react';
import { api } from '@/services/api/apiClient';
import { arKeys } from '@/hooks/useAccountsReceivable';
import { sendInvoiceViaWhatsApp } from '@/shared/utils/whatsappSender';
import { AccountReceivable } from '@/modelTypes/accountReceivable';
import { Customer } from '@/modelTypes/customer';
import { useToast } from '@/components/hooks/useToast';
import { generateInvoicePDF } from '@/shared/utils/pdfGenerator';
import { formatDate } from '@/shared/utils/dateHelpers';
import { buildInvoiceForPdf } from './buildInvoiceForPdf';
import { formatearUsd } from '@/shared/utils/dinero';

interface WhatsAppSendButtonProps {
  account: AccountReceivable;
}

export default function WhatsAppSendButton({
  account,
}: WhatsAppSendButtonProps) {
  const contexto = useContextoPdf();
  const toast = useToast();
  const qc = useQueryClient();
  const [isSendingReminder, setIsSendingReminder] = useState(false);
  const [isSendingPdf, setIsSendingPdf] = useState(false);

  // Envía el template oficial `pago_pendiente` con PDF adjunto
  // (body: nombre, monto, orden, fecha + boton URL dinamico)
  const handleSendReminder = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isSendingReminder) return;

    setIsSendingReminder(true);
    try {
      // Construir invoice para PDF (soporta consolidadas: agrega items de todas
      // las ordenes fusionadas con section headers).
      const { invoice: invoiceForPdf } = await buildInvoiceForPdf(account);

      // Obtener customer para el telefono. El PDF puede generarse sin customer,
      // pero WhatsApp lo necesita.
      let customer: Customer | null = null;
      if (account.customerId) {
        try {
          customer = await api.get<Customer>(
            `/api/customers/${account.customerId}`,
          );
        } catch {
          /* cliente no encontrado */
        }
      }

      const phone = customer?.phone;
      if (!phone) {
        toast.error({
          title: 'Sin telefono',
          description: 'El cliente no tiene telefono registrado',
        });
        return;
      }

      // Normalizar telefono a E.164 sin +
      let normalized = String(phone).replace(/[\s\-()+]/g, '');
      if (normalized.startsWith('0')) normalized = '58' + normalized.slice(1);
      else if (!normalized.startsWith('58')) normalized = '58' + normalized;

      if (!/^\d{8,15}$/.test(normalized)) {
        toast.error({
          title: 'Telefono invalido',
          description: `Formato incorrecto: ${phone}`,
        });
        return;
      }

      const doc = generateInvoicePDF({
        invoice: invoiceForPdf,
        customer,
        contexto,
      });
      const pdfBlob = doc.output('blob');
      const pdfBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const res = reader.result;
          if (typeof res !== 'string') return reject(new Error('reader error'));
          resolve(res.split(',')[1] ?? '');
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(pdfBlob);
      });

      // Enviar via endpoint NestJS que proxea al whatsapp-service con template pago_pendiente
      const safeOrderCode = account.invoiceNumber
        .replace(/\s*\(Consolidada.*?\)\s*$/i, '')
        .slice(0, 30);
      await api.post('/api/notifications/pago-pendiente', {
        to: normalized,
        customerName: account.customerName,
        amount: formatearUsd(account.amount - account.paidAmount),
        orderCode: safeOrderCode,
        date: formatDate(account.createdAt),
        pdfBase64,
        pdfFilename: `consumo-${safeOrderCode}.pdf`,
        accountReceivableId: account.id,
      });

      // Registrar timestamp del envio exitoso (mostrar en lista/detalle)
      try {
        await api.patch(`/api/accounts-receivable/${account.id}`, {
          lastNotificationAt: new Date().toISOString(),
          lastNotificationChannel: 'whatsapp',
        });
        qc.invalidateQueries({ queryKey: arKeys.lists() });
        qc.invalidateQueries({ queryKey: arKeys.detail(account.id) });
      } catch {
        /* no bloquear flujo si falla el patch */
      }

      toast.success({
        title: 'Notificacion enviada',
        description: `WhatsApp enviado a ${account.customerName} con PDF adjunto`,
      });
    } catch (err) {
      toast.error({
        title: 'Error al enviar notificacion',
        description: err instanceof Error ? err.message : 'desconocido',
        duration: 10000,
      });
    } finally {
      setIsSendingReminder(false);
    }
  };

  // Envía el PDF manualmente (Web Share API / wa.me)
  const handleSendPdf = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isSendingPdf) return;

    setIsSendingPdf(true);
    try {
      const { invoice } = await buildInvoiceForPdf(account);
      let customer: Customer | null = null;
      if (account.customerId) {
        try {
          customer = await api.get<Customer>(
            `/api/customers/${account.customerId}`,
          );
        } catch {
          /* sin customer */
        }
      }

      const reportLink = `${window.location.origin}/public/reportar-pago/${account.id}`;
      const result = await sendInvoiceViaWhatsApp(
        invoice,
        customer,
        contexto,
        reportLink,
      );
      if (result.method === 'failed') {
        toast.error({
          title: 'Error al enviar',
          description: result.error || 'desconocido',
        });
      }
    } catch (err) {
      toast.error({
        title: 'Error al preparar la factura',
        description: err instanceof Error ? err.message : 'desconocido',
      });
    } finally {
      setIsSendingPdf(false);
    }
  };

  return (
    <div className="flex items-center gap-1 shrink-0">
      {/* Recordatorio automático vía API oficial de Meta */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleSendReminder}
        disabled={isSendingReminder}
        title="Enviar notificacion de pago pendiente por WhatsApp (con PDF)"
        className="border-ok text-ok hover:bg-ok/10 hover:border-ok"
      >
        {isSendingReminder ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Bell className="w-4 h-4" />
        )}
      </Button>

      {/* Envío manual del PDF */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleSendPdf}
        disabled={isSendingPdf}
        title="Enviar PDF manualmente por WhatsApp"
        className="border-ok text-ok hover:bg-ok/10 hover:border-ok"
      >
        {isSendingPdf ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <MessageCircle className="w-4 h-4" />
        )}
      </Button>
    </div>
  );
}
