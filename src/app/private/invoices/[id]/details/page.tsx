'use client';
import { use, useState, useMemo } from 'react';
import {
  printThermalReceipt,
  checkPrintService,
} from '@/features/pos/services/thermalPrintService';
import { useDatosDeImpresion } from '@/features/pos/hooks/useDatosDeImpresion';
import Loader from '@/components/shared/Loader/Loader';
import { useLoadInvoiceDetails } from './hooks';
import { InvoiceHeader, InvoiceMainCard, SidePanel } from './components';
import { calculatePaymentMethodsSummary, buildOrderForPrint } from './utils';

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { invoiceDetails, isLoading } = useLoadInvoiceDetails(id);
  const [isReprinting, setIsReprinting] = useState(false);
  const datos = useDatosDeImpresion();

  // Estado derivado: cálculos que no requieren estado adicional
  const isFullyPaid = useMemo(
    () =>
      invoiceDetails
        ? invoiceDetails.totalPaid >= (invoiceDetails.invoice.total || 0)
        : false,
    [invoiceDetails],
  );

  const pendingBalance = useMemo(
    () =>
      invoiceDetails
        ? Math.max(
            0,
            (invoiceDetails.invoice.total || 0) - invoiceDetails.totalPaid,
          )
        : 0,
    [invoiceDetails],
  );

  const paymentMethodsSummary = useMemo(
    () =>
      invoiceDetails
        ? calculatePaymentMethodsSummary(invoiceDetails.payments)
        : [],
    [invoiceDetails],
  );

  const handleReprint = async () => {
    if (!invoiceDetails) return;
    setIsReprinting(true);
    try {
      const available = await checkPrintService();
      if (!available) {
        alert(
          'Servicio de impresion no disponible. Verifica que el print service este corriendo.',
        );
        return;
      }

      const { invoice: inv, payments: pmts } = invoiceDetails;
      const orderForPrint = buildOrderForPrint(inv);

      const result = await printThermalReceipt(orderForPrint, pmts, {
        customerName:
          inv.customerName || invoiceDetails.customer?.name || undefined,
        customerRif: inv.customerRif || undefined,
        datos,
      });

      if (result.success) {
        alert('Factura enviada a la impresora');
      } else {
        alert('Error al reimprimir: ' + (result.error || 'Error desconocido'));
      }
    } catch (err) {
      alert(
        'Error al reimprimir: ' +
          (err instanceof Error ? err.message : 'Error desconocido'),
      );
    } finally {
      setIsReprinting(false);
    }
  };

  if (isLoading) {
    return <Loader text="Cargando detalles de factura..." />;
  }

  if (!invoiceDetails) {
    return <div>Factura no encontrada</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated">
      <div className="container mx-auto p-6">
        <InvoiceHeader
          invoice={invoiceDetails.invoice}
          customer={invoiceDetails.customer}
          isReprinting={isReprinting}
          onReprint={handleReprint}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Panel principal */}
          <div className="lg:col-span-2">
            <InvoiceMainCard
              data={invoiceDetails}
              isFullyPaid={isFullyPaid}
              pendingBalance={pendingBalance}
            />
          </div>

          {/* Panel lateral */}
          <SidePanel
            data={invoiceDetails}
            paymentMethodsSummary={paymentMethodsSummary}
          />
        </div>
      </div>
    </div>
  );
}
