'use client';

import { useState } from 'react';
import { Button } from '@/components/shared/button/Button';
import { Loader2, MessageCircle } from 'lucide-react';
import { Budget, OperacionConfig } from '@odin6/types';
import { BudgetStatusEnum } from '@/shared/types/enumShared';
import { generateBudgetPDF } from '@/shared/utils/pdfGenerator';
import { aFecha } from '@/shared/utils/dateHelpers';
import { useUpdateBudgetStatus } from '@/hooks/useBudgets';
import { formatearUsd } from '@/shared/utils/dinero';
import { useNombreApp, useOperacion, useTarifas } from '@/shared/config';
import { useContextoPdf } from '@/shared/hooks/useContextoPdf';
import { etiquetaServicio } from '@/features/pos/utils/etiquetasDeCobro';

interface ShareBudgetWhatsAppProps {
  budget: Budget;
  onStatusChange?: (newStatus: BudgetStatusEnum) => void;
}

/** Datos del negocio para el texto del mensaje. Vienen de la configuración. */
interface DatosMensaje {
  nombre: string;
  /** Línea de servicio ("Servicio (10%)"), o null si el negocio no cobra servicio. */
  servicio: string | null;
  operacion: OperacionConfig;
}

function formatDateVE(
  date: Date | string | unknown,
  operacion: OperacionConfig,
): string {
  const d = date instanceof Date ? date : aFecha(date as Date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(operacion.locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: operacion.timezone,
  });
}

function buildMessage(budget: Budget, datos: DatosMensaje): string {
  const lines: string[] = [];

  lines.push(`*Presupuesto ${budget.budgetNumber}*`);
  lines.push(`*${datos.nombre}*`);
  lines.push('');
  lines.push(`Evento: *${budget.eventName}*`);
  if (budget.eventDate) {
    lines.push(`Fecha: ${formatDateVE(budget.eventDate, datos.operacion)}`);
  }
  if (budget.eventGuests) {
    lines.push(`Invitados: ${budget.eventGuests}`);
  }
  lines.push('');
  lines.push('*Detalle:*');

  for (const item of budget.items) {
    lines.push(
      `  ${item.quantity}x ${item.name} — ${formatearUsd(item.total)}`,
    );
  }

  lines.push('');
  lines.push(`Subtotal: ${formatearUsd(budget.subtotal)}`);
  if (budget.serviceCharge > 0 && datos.servicio) {
    lines.push(`${datos.servicio}: ${formatearUsd(budget.serviceCharge)}`);
  }
  if (budget.discount > 0) {
    const discountLabel =
      budget.discountType === 'percentage'
        ? `Descuento (${budget.discountValue}%)`
        : 'Descuento';
    lines.push(`${discountLabel}: -${formatearUsd(budget.discount)}`);
  }
  lines.push(`*Total: ${formatearUsd(budget.total)}*`);

  if (budget.validUntil) {
    lines.push('');
    lines.push(
      `Valido hasta: ${formatDateVE(budget.validUntil, datos.operacion)}`,
    );
  }

  if (budget.notes) {
    lines.push('');
    lines.push(`Notas: ${budget.notes}`);
  }

  return lines.join('\n');
}

function formatPhone(phone: string | undefined, prefijo: string): string {
  let waPhone = (phone || '').replace(/[\s\-()]/g, '');
  if (waPhone.startsWith('0')) {
    waPhone = prefijo + waPhone.slice(1);
  } else if (!waPhone.startsWith('+') && !waPhone.startsWith(prefijo)) {
    waPhone = prefijo + waPhone;
  }
  return waPhone.replace('+', '');
}

function updateStatusToSent(
  budget: Budget,
  updateMutation: ReturnType<typeof useUpdateBudgetStatus>,
  onStatusChange?: (s: BudgetStatusEnum) => void,
) {
  if (budget.status !== BudgetStatusEnum.DRAFT) return;
  updateMutation.mutate(
    { id: budget.id, status: BudgetStatusEnum.SENT },
    {
      onSuccess: () => {
        onStatusChange?.(BudgetStatusEnum.SENT);
      },
    },
  );
}

export default function ShareBudgetWhatsApp({
  budget,
  onStatusChange,
}: ShareBudgetWhatsAppProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const updateBudgetStatus = useUpdateBudgetStatus();
  const nombre = useNombreApp();
  const tarifas = useTarifas();
  const operacion = useOperacion();
  const contexto = useContextoPdf();

  const handleShare = async () => {
    setIsGenerating(true);
    try {
      // Generar PDF con estado "Enviado" si esta en borrador
      const budgetForPdf =
        budget.status === BudgetStatusEnum.DRAFT
          ? { ...budget, status: BudgetStatusEnum.SENT }
          : budget;

      const doc = generateBudgetPDF(budgetForPdf, contexto);
      const pdfBlob = doc.output('blob');
      const fileName = `presupuesto-${budget.budgetNumber}.pdf`;
      const message = buildMessage(budgetForPdf, {
        nombre,
        servicio: etiquetaServicio(tarifas),
        operacion,
      });

      // Web Share API: adjunta PDF + mensaje de texto
      if (navigator.share && navigator.canShare) {
        const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
        const shareData = {
          files: [file],
          title: `Presupuesto ${budget.budgetNumber}`,
          text: message,
        };

        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          updateStatusToSent(budget, updateBudgetStatus, onStatusChange);
          return;
        }
      }

      // Fallback desktop: descargar PDF + abrir WhatsApp con mensaje
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);

      const waPhone = formatPhone(budget.customerPhone, operacion.phonePrefix);
      const encoded = encodeURIComponent(
        message +
          '\n\n_El PDF ha sido descargado, por favor adjuntelo a este chat._',
      );
      const waUrl = waPhone
        ? `https://wa.me/${waPhone}?text=${encoded}`
        : `https://wa.me/?text=${encoded}`;

      window.open(waUrl, '_blank');
      updateStatusToSent(budget, updateBudgetStatus, onStatusChange);
    } catch {
      alert('Error al generar el PDF para compartir');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleShare}
      disabled={isGenerating}
      className="border-ok text-ok hover:bg-ok/10"
    >
      {isGenerating ? (
        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
      ) : (
        <MessageCircle className="w-4 h-4 mr-1.5" />
      )}
      {isGenerating ? 'Generando...' : 'Enviar WhatsApp'}
    </Button>
  );
}
