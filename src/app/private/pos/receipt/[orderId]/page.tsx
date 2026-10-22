// app/pos/receipt/[orderId]/page.tsx
'use client';
import { use, useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useOrder } from '@/hooks/useOrders';
import { useUpdateTable } from '@/hooks/useTables';
import { useInvoiceByOrder } from '@/hooks/useInvoices';
import { usePaymentsByOrder } from '@/hooks/usePayments';
import { useTipByOrder } from '@/hooks/useTips';
import { useWaiters } from '@/hooks/useUsers';
import { TableStatusEnum, PaymentStatusEnum } from '@/shared';
import { Order } from '@/modelTypes/order';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/shared/button/Button';
import Receipt from '@/features/pos/Receipt';
import { aFecha } from '@/shared/utils/dateHelpers';
import { PRIVATE_ROUTES } from '@/shared';
import {
  checkPrintService,
  printThermalReceipt,
} from '@/features/pos/services/thermalPrintService';
import { useDatosDeImpresion } from '@/features/pos/hooks/useDatosDeImpresion';

interface PageProps {
  params: Promise<{ orderId: string }>;
}

export default function ReceiptPage({ params }: PageProps) {
  const { orderId } = use(params);
  const router = useRouter();
  const datos = useDatosDeImpresion();
  const { data: orderData, isLoading: orderLoading } = useOrder(orderId);
  const updateTable = useUpdateTable();
  // Las TRES consultas filtran por orden en el SERVIDOR. Antes eran
  // `usePayments()`, `useInvoices()` y `useTips()` sin un solo filtro: imprimir
  // un ticket se bajaba el historico completo de pagos, facturas y propinas del
  // negocio —5,2 MB solo en facturas— para usar un registro de cada uno, en la
  // PC de la caja y en hora pico.
  const { data: payments = [] } = usePaymentsByOrder(orderId);
  const { data: factura = null } = useInvoiceByOrder(orderId);
  const { data: propina = null } = useTipByOrder(orderId);
  const { data: usersData = [] } = useWaiters();
  const [printerOnline, setPrinterOnline] = useState<boolean | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  // "Cliente no especificado" es un relleno, no un nombre: las facturas viejas
  // lo tienen grabado aunque la orden si traiga el nombre de quien pidio.
  const NOMBRE_DE_RELLENO = 'Cliente no especificado';

  // Todo lo que sigue se CALCULA de lo que ya se pidio. Antes cada uno era un
  // useState alimentado por su propio useEffect, y como los `= []` de los
  // hooks crean un arreglo nuevo en cada render mientras la consulta no
  // resuelve, la pantalla entraba en bucle de render.
  const orderState = orderData ?? null;

  // El nombre viene guardado en la propia orden; la lista de mesoneros
  // activos es solo el respaldo para las ordenes viejas que no lo traen (y no
  // sirve para quien ya no trabaja: su nombre debe seguir en sus tickets).
  const waiterName = useMemo(
    () =>
      orderData?.waiterName ||
      usersData.find((u) => u.id === orderData?.waiterId)?.name,
    [orderData?.waiterName, usersData, orderData?.waiterId],
  );

  const customerName = useMemo(() => {
    const deLaFactura =
      factura?.customerName && factura.customerName !== NOMBRE_DE_RELLENO
        ? factura.customerName
        : undefined;
    return deLaFactura || orderData?.customerName || undefined;
  }, [factura, orderData?.customerName]);

  const customerRif = factura?.customerRif || undefined;

  const tipAmount = useMemo(() => {
    if (orderData?.tipAmount) return orderData.tipAmount;
    return propina?.amount || 0;
  }, [orderData?.tipAmount, propina]);

  // Guard para detectar si hemos cargado satisfactoriamente al menos una vez la orden.
  // Evita abortar la navegacion del usuario si el cache la ordena limpiar despues del render.
  const hasLoadedOrderRef = useRef(false);
  // Fire-once guard para liberar mesa. Sin este ref, incluir updateTable en las deps
  // del useEffect crea un loop: mutateAsync → re-render → nueva ref de updateTable → re-run.
  const hasReleasedTableRef = useRef(false);

  // 1) Guard de presencia: si la orden no existe, volvemos al POS.
  useEffect(() => {
    if (orderData) {
      hasLoadedOrderRef.current = true;
    }
    if (!orderData && !orderLoading) {
      // Si ya la habiamos cargado y estamos intentando salir, no redirigir para evitar
      // pisotear la transicion del router Next.js hacia el sidebar.
      if (hasLoadedOrderRef.current) return;
      router.push(PRIVATE_ROUTES.POS);
    }
  }, [orderData, orderLoading, router]);

  // 3) Fallback idempotente para liberar mesa cuando la orden ya está pagada.
  // updateTable omitido de deps intencionalmente: incluirlo causa loop porque
  // useMutation retorna un nuevo objeto en cada render tras llamar mutateAsync.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!orderData || hasReleasedTableRef.current) return;
    if (
      orderData.paymentStatus !== PaymentStatusEnum.PAID ||
      !orderData.tableId
    )
      return;

    hasReleasedTableRef.current = true;
    updateTable
      .mutateAsync({
        id: orderData.tableId,
        data: {
          orderId: null,
          status: TableStatusEnum.ISAVAILABLE,
          isAvailable: true,
        },
      })
      .catch((error) => {
        console.error(
          '[ReceiptPage] Error al liberar mesa en fallback:',
          error,
        );
        hasReleasedTableRef.current = false; // permite reintentar si falla
      });
  }, [orderData?.id, orderData?.paymentStatus, orderData?.tableId]);

  // Check print service status
  useEffect(() => {
    checkPrintService().then(setPrinterOnline);
  }, []);

  const handleNewOrder = useCallback(() => {
    router.push(PRIVATE_ROUTES.POS);
  }, [router]);

  const handleBrowserPrint = useCallback(() => {
    window.print();
  }, []);

  const handleThermalPrint = useCallback(async () => {
    if (!orderState || isPrinting) return;

    setIsPrinting(true);
    const order: Order = {
      ...orderState,
      createdAt: aFecha(orderState.createdAt),
      updatedAt: aFecha(orderState.updatedAt),
    };

    // Obtener tasa BCV del primer pago que la tenga, o fetch de la API
    const paymentBcvRate = payments.find(
      (p) => p.bcvRate && p.bcvRate > 0,
    )?.bcvRate;
    let bcvRate = paymentBcvRate || 0;
    if (!bcvRate) {
      try {
        const res = await fetch('/api/bcv-rate');
        const data = await res.json();
        if (data.success && data.rate) bcvRate = data.rate;
      } catch {
        /* usar 0 */
      }
    }

    const result = await printThermalReceipt(order, payments, {
      bcvRate,
      tipAmount,
      customerName,
      customerRif,
      datos,
    });

    if (!result.success) {
      console.warn('[ThermalPrint]', result.error);
      setPrinterOnline(false);
    } else {
      setPrinterOnline(true);
    }

    setIsPrinting(false);
    return result;
  }, [orderState, payments, isPrinting, tipAmount, datos]);

  const isPageLoading = orderLoading || !orderState;

  if (isPageLoading) {
    return (
      <div className="container mx-auto p-8 max-w-4xl flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-dim">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand" />
          <span>Cargando recibo...</span>
        </div>
      </div>
    );
  }

  const order: Order = {
    ...orderState,
    createdAt: aFecha(orderState.createdAt),
    updatedAt: aFecha(orderState.updatedAt),
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="no-print flex justify-between items-center bg-surface border border-line p-5 rounded-2xl shadow-sm mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2.5 rounded-xl hover:bg-elevated transition-colors text-dim hover:text-content bg-page border border-line"
            title="Volver"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black bg-gradient-to-r from-brand to-brand-light bg-clip-text text-transparent">
              Orden Completada #{orderId.slice(0, 6)}
            </h1>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-sm font-medium text-dim">
                El pago ha sido registrado exitosamente
              </span>
              {/* Printer status indicator */}
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                  printerOnline === null
                    ? 'bg-elevated text-dim border border-line'
                    : printerOnline
                      ? 'bg-ok/10 text-ok border border-ok/20'
                      : 'bg-danger/10 text-danger border border-danger/20'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    printerOnline === null
                      ? 'bg-dim'
                      : printerOnline
                        ? 'bg-ok'
                        : 'bg-danger'
                  }`}
                />
                {printerOnline === null
                  ? 'Verificando impresora...'
                  : printerOnline
                    ? 'Impresora Lista'
                    : 'Impresora Desconectada'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleNewOrder}
            className="!bg-page hover:!bg-elevated"
          >
            Nueva Orden
          </Button>
          <Button
            variant="outline"
            onClick={handleBrowserPrint}
            className="!bg-page hover:!bg-elevated"
          >
            Descargar PDF
          </Button>
          {printerOnline && (
            <Button
              variant="default"
              onClick={handleThermalPrint}
              disabled={isPrinting}
            >
              {isPrinting ? 'Imprimiendo...' : 'Imprimir Ticket'}
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto flex justify-center">
        <Receipt
          order={order}
          payments={payments}
          waiterName={waiterName}
          tipAmount={tipAmount}
          customerName={customerName}
          customerRif={customerRif}
        />
      </div>
    </div>
  );
}
