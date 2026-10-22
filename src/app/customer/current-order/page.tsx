'use client';
export const dynamic = 'force-dynamic';
import { useMemo, useEffect } from 'react';
import { useUserStore } from '@/shared/store/useUserStore';
import { CheckCircle, ChefHat, Coffee, Package, XCircle } from 'lucide-react';
import { OrderStatusEnum } from '@/shared';
import { CUSTOMER_ROUTES } from '@/shared';
import { useOrders } from '@/hooks';
import { FilaDeResumen } from '@/components/shared/resumen/FilaDeResumen';

const statusSteps = [
  {
    status: OrderStatusEnum.PENDING,
    label: 'Pedido Recibido',
    icon: Coffee,
    description: 'Tu pedido ha sido recibido y está en cola',
  },
  {
    status: OrderStatusEnum.IN_PROGRESS,
    label: 'Preparando',
    icon: ChefHat,
    description: 'Nuestro equipo está preparando tu pedido',
  },
  {
    status: OrderStatusEnum.READY,
    label: 'Listo',
    icon: Package,
    description: 'Tu pedido está listo para recoger',
  },
  {
    status: OrderStatusEnum.DELIVERED,
    label: 'Entregado',
    icon: CheckCircle,
    description: 'Tu pedido ha sido entregado',
  },
];

export default function CurrentOrder() {
  const { user } = useUserStore();
  const { data: allOrders = [], isLoading } = useOrders();

  // Find the most recent active order
  const currentOrder = useMemo(() => {
    if (!user?.id) return null;

    const activeOrderStatuses = [
      OrderStatusEnum.PENDING,
      OrderStatusEnum.IN_PROGRESS,
      OrderStatusEnum.READY,
    ];

    const userOrders = allOrders
      .filter(
        (order) =>
          order.customerId === user.id &&
          activeOrderStatuses.includes(order.status),
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

    return userOrders.length > 0 ? userOrders[0] : null;
  }, [user?.id, allOrders]);

  // Set up interval to refresh order status every 30 seconds
  useEffect(() => {
    if (user?.id) {
      const interval = setInterval(() => {
        // Query will auto-refetch due to React Query's stale time
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [user?.id]);

  const getStatusStepIndex = (status: OrderStatusEnum) => {
    return statusSteps.findIndex((step) => step.status === status);
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  const getEstimatedTime = () => {
    if (!currentOrder) return '';

    const orderTime = currentOrder.createdAt.getTime();
    const now = Date.now();
    const elapsed = now - orderTime;

    // Estimate 15-20 minutes total preparation time
    const estimatedTotal = 20 * 60 * 1000; // 20 minutes in milliseconds
    const remaining = Math.max(0, estimatedTotal - elapsed);

    if (remaining === 0) return 'Muy pronto';

    const minutes = Math.ceil(remaining / (60 * 1000));
    return `${minutes} min aprox.`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-brand"></div>
      </div>
    );
  }

  if (!currentOrder) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold text-teal-900">
            Estado del Pedido
          </h1>
          <p className="text-brand">
            Seguimiento en tiempo real de tu pedido actual
          </p>
        </div>

        <div className="text-center py-12">
          <Package className="h-12 w-12 text-brand mx-auto mb-4" />
          <h3 className="text-lg font-medium text-teal-900 mb-2">
            No tienes pedidos activos
          </h3>
          <p className="text-brand mb-4">
            Realiza un pedido para ver su estado aquí.
          </p>
          <a
            href={CUSTOMER_ROUTES.CATALOG}
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all duration-200 shadow-lg shadow-teal-500/25"
          >
            Ver Productos
          </a>
        </div>
      </div>
    );
  }

  const currentStepIndex = getStatusStepIndex(currentOrder.status);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-teal-900">Estado del Pedido</h1>
        <p className="text-brand">
          Seguimiento en tiempo real de tu pedido actual
        </p>
      </div>

      {/* Order Header */}
      <div className="bg-surface/80 backdrop-blur-sm rounded-xl shadow-sm border border-teal-200 p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-semibold text-teal-900">
              Pedido #{currentOrder.id.slice(-8)}
            </h2>
            <p className="text-brand">
              Realizado el {formatDate(currentOrder.createdAt)} a las{' '}
              {formatTime(currentOrder.createdAt)}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
              ${currentOrder.total.toFixed(2)}
            </div>
            <div className="text-sm text-ok font-medium">
              Tiempo estimado: {getEstimatedTime()}
            </div>
          </div>
        </div>
      </div>

      {/* Status Progress */}
      <div className="bg-surface/80 backdrop-blur-sm rounded-xl shadow-sm border border-teal-200 p-6">
        <h3 className="text-lg font-semibold text-teal-900 mb-6">
          Progreso del Pedido
        </h3>

        <div className="relative">
          <div className="flex justify-between items-center">
            {statusSteps.map((step, index) => {
              const StepIcon = step.icon;
              const isCompleted = index <= currentStepIndex;
              const isCurrent = index === currentStepIndex;

              return (
                <div
                  key={step.status}
                  className="flex flex-col items-center relative"
                >
                  {/* Connector Line */}
                  {index < statusSteps.length - 1 && (
                    <div
                      className={`absolute top-6 left-full w-full h-0.5 ${
                        index < currentStepIndex
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                          : 'bg-teal-200'
                      }`}
                      style={{ width: 'calc(100% + 2rem)' }}
                    />
                  )}

                  {/* Step Circle */}
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-colors ${
                      isCompleted
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                        : isCurrent
                          ? 'bg-gradient-to-r from-cyan-500 to-teal-500 border-brand text-white animate-pulse shadow-lg shadow-cyan-500/25'
                          : 'bg-teal-50 border-teal-200 text-brand'
                    }`}
                  >
                    <StepIcon className="h-5 w-5" />
                  </div>

                  {/* Step Label */}
                  <div className="mt-4 text-center max-w-24">
                    <div
                      className={`text-sm font-medium ${
                        isCompleted || isCurrent
                          ? 'text-teal-900'
                          : 'text-brand'
                      }`}
                    >
                      {step.label}
                    </div>
                    <div className="text-xs text-brand mt-1">
                      {step.description}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {currentOrder.status === OrderStatusEnum.CANCELLED && (
          <div className="mt-6 p-4 bg-red-50 border border-danger rounded-xl">
            <div className="flex items-center">
              <XCircle className="h-5 w-5 text-danger mr-2" />
              <span className="text-danger font-medium">Pedido Cancelado</span>
            </div>
            <p className="text-danger text-sm mt-1">
              Tu pedido ha sido cancelado. Si tienes alguna pregunta, por favor
              contáctanos.
            </p>
          </div>
        )}
      </div>

      {/* Order Details */}
      <div className="bg-surface/80 backdrop-blur-sm rounded-xl shadow-sm border border-teal-200 p-6">
        <h3 className="text-lg font-semibold text-teal-900 mb-4">
          Detalles del Pedido
        </h3>

        <div className="space-y-3">
          {currentOrder.items.map((item, index) => (
            <div
              key={index}
              className="flex justify-between items-center bg-teal-50 rounded-lg p-3 border border-teal-100"
            >
              <div>
                <span className="font-medium text-teal-900">{item.name}</span>
                {item.notes && (
                  <p className="text-sm text-brand mt-1">Nota: {item.notes}</p>
                )}
              </div>
              <div className="text-right">
                <div className="font-medium text-teal-900">
                  {item.quantity}x ${item.unitPrice.toFixed(2)}
                </div>
                <div className="text-sm text-brand">
                  ${item.total.toFixed(2)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {currentOrder.notes && (
          <div className="mt-4 p-3 bg-elevated border border-line rounded-xl">
            <h4 className="font-medium text-content mb-1">Notas especiales:</h4>
            <p className="text-content text-sm">{currentOrder.notes}</p>
          </div>
        )}

        <div className="border-t border-teal-200 pt-4 mt-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-brand">Subtotal:</span>
            <span className="font-medium text-teal-900">
              ${currentOrder.subtotal.toFixed(2)}
            </span>
          </div>
          <FilaDeResumen
            className="items-center text-sm mt-1"
            etiqueta="Impuestos:"
            classNameEtiqueta="text-brand"
            valor={<>${currentOrder.tax.toFixed(2)}</>}
            classNameValor="font-medium text-teal-900"
          />
          <div className="flex justify-between items-center text-lg font-bold mt-2 pt-2 border-t border-teal-200">
            <span className="text-teal-900">Total:</span>
            <span className="bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
              ${currentOrder.total.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Help Section */}
      <div className="bg-teal-50 rounded-xl p-6 border border-teal-200">
        <h3 className="text-lg font-semibold text-teal-900 mb-2">
          ¿Necesitas ayuda?
        </h3>
        <p className="text-brand mb-4">
          Si tienes alguna pregunta sobre tu pedido o necesitas hacer algún
          cambio, no dudes en contactarnos.
        </p>
        <div className="flex space-x-4">
          <button className="bg-gradient-to-r from-teal-500 to-cyan-500 text-white px-4 py-2 rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all duration-200 shadow-md shadow-teal-500/20">
            Contactar Soporte
          </button>
          <a
            href={CUSTOMER_ROUTES.HISTORY}
            className="border border-teal-300 text-brand px-4 py-2 rounded-xl hover:bg-teal-100 transition-all duration-200"
          >
            Ver Historial
          </a>
        </div>
      </div>
    </div>
  );
}
