'use client';

import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/shared/button/Button';
import { useToast } from '@/components/hooks/useToast';
import { api } from '@/services/api/apiClient';
import { Budget } from '@odin6/types';
import { generateBudgetPDF } from '@/shared/utils/pdfGenerator';
import { useContextoPdf } from '@/shared/hooks/useContextoPdf';
import { normalizePhoneForWhatsApp } from '@/shared/utils/whatsappSender';

interface SendBudgetWhatsAppButtonProps {
  budget: Budget;
}

interface SendBudgetResponse {
  success: boolean;
  method: 'template' | 'text';
  messageId?: string;
  warning?: string;
}

/**
 * Manda el presupuesto por el bot de WhatsApp, sin salir del POS.
 *
 * Se diferencia de ShareBudgetWhatsApp (que abre wa.me y obliga a adjuntar el
 * PDF a mano): aqui el backend habla con el whatsapp-service y el cliente
 * recibe el mensaje aunque nadie tenga WhatsApp Web abierto.
 *
 * El backend responde con `method` para poder decir si de verdad fue con PDF
 * (plantilla) o solo texto (ventana de 24h). Un envio que no llega es peor que
 * un error visible, asi que aqui se distingue con un aviso.
 */
export default function SendBudgetWhatsAppButton({
  budget,
}: SendBudgetWhatsAppButtonProps) {
  const toast = useToast();
  const contexto = useContextoPdf();
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (isSending) return;

    const phone = normalizePhoneForWhatsApp(budget.customerPhone);
    if (!phone) {
      toast.error({
        title: 'Sin teléfono',
        description: budget.customerPhone
          ? `El número "${budget.customerPhone}" no tiene un formato válido`
          : 'El presupuesto no tiene teléfono del cliente',
      });
      return;
    }

    setIsSending(true);
    try {
      const pdfBlob = generateBudgetPDF(budget, contexto).output('blob');
      const pdfBase64 = await blobToBase64(pdfBlob);

      const result = await api.post<SendBudgetResponse>(
        '/api/notifications/budget',
        {
          to: phone,
          customerName: budget.customerName,
          budgetNumber: budget.budgetNumber,
          eventName: budget.eventName,
          total: `$${budget.total.toFixed(2)}`,
          pdfBase64,
          pdfFilename: `presupuesto-${budget.budgetNumber}.pdf`,
          budgetId: budget.id,
        },
      );

      if (result.method === 'text') {
        toast.warning({
          title: 'Enviado, pero sin el PDF',
          description:
            result.warning ??
            'Se envió como texto porque no hay plantilla aprobada en Meta.',
          duration: 10000,
        });
        return;
      }

      toast.success({
        title: 'Presupuesto enviado',
        description: `${budget.customerName} lo recibió por WhatsApp con el PDF adjunto`,
      });
    } catch (err) {
      toast.error({
        title: 'No se pudo enviar',
        description: err instanceof Error ? err.message : 'Error desconocido',
        duration: 10000,
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleSend}
      disabled={isSending}
      title="Enviar el presupuesto al cliente por WhatsApp (lo manda el bot, con PDF)"
      className="border-ok text-ok hover:bg-ok/10 hover:border-ok"
    >
      {isSending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Send className="h-4 w-4" />
      )}
      <span className="ml-2 hidden sm:inline">Enviar por WhatsApp</span>
    </Button>
  );
}

/** El backend espera el PDF en base64 sin el prefijo `data:`. */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('No se pudo leer el PDF'));
        return;
      }
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
