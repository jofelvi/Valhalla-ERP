'use client';

import { useState } from 'react';
import { Button } from '@/components/shared/button/Button';
import { Download, FileText, Loader2 } from 'lucide-react';
import { Invoice } from '@odin6/types';
import { Customer } from '@odin6/types';
import {
  downloadInvoicePDF,
  previewInvoicePDF,
} from '@/shared/utils/pdfGenerator';
import { useContextoPdf } from '@/shared/hooks/useContextoPdf';

interface PDFDownloadButtonProps {
  invoice: Invoice;
  customer?: Customer | null;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  showPreview?: boolean;
  /**
   * Cuando `invoice` viene RECORTADA (el listado pide `?vista=lista`, que no
   * trae `items`), esto trae la completa al pulsar. Sin ella el PDF saldria
   * con la tabla de lineas vacia y sin un solo error.
   */
  cargarFactura?: () => Promise<Invoice>;
}

export default function PDFDownloadButton({
  invoice,
  customer,
  variant = 'outline',
  size,
  showPreview = true,
  cargarFactura,
}: PDFDownloadButtonProps) {
  const contexto = useContextoPdf();
  const [isGenerating, setIsGenerating] = useState(false);

  // La espera real (traer la factura completa) reemplaza al delay de adorno
  // que habia antes. Si no hay que traer nada, se conserva el delay para que
  // el spinner no parpadee.
  const facturaParaElPdf = async (msDeAdorno: number): Promise<Invoice> => {
    if (cargarFactura) return cargarFactura();
    await new Promise((resolve) => setTimeout(resolve, msDeAdorno));
    return invoice;
  };

  const handleDownloadPDF = async () => {
    try {
      setIsGenerating(true);
      downloadInvoicePDF(await facturaParaElPdf(500), customer, contexto);
    } catch {
      alert('Error al generar el PDF. Por favor, intenta de nuevo.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePreviewPDF = async () => {
    try {
      setIsGenerating(true);
      previewInvoicePDF(await facturaParaElPdf(300), customer, contexto);
    } catch {
      alert(
        'Error al generar la vista previa del PDF. Por favor, intenta de nuevo.',
      );
    } finally {
      setIsGenerating(false);
    }
  };

  if (showPreview) {
    return (
      <div className="flex gap-2">
        <Button
          variant={variant}
          size="md"
          onClick={handlePreviewPDF}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <FileText className="w-4 h-4 mr-2" />
          )}
          Vista Previa
        </Button>
        <Button
          variant={variant}
          size="md"
          onClick={handleDownloadPDF}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          Descargar PDF
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant={variant}
      size={size ?? 'md'}
      onClick={handleDownloadPDF}
      disabled={isGenerating}
    >
      {isGenerating ? (
        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
      ) : (
        <Download className="w-4 h-4 mr-1.5" />
      )}
      Descargar PDF
    </Button>
  );
}
