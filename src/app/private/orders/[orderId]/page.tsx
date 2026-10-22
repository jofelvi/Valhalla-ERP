'use client';
import { formatearBs, formatearNumero } from '@/shared/utils/dinero';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { OrderStatusEnum } from '@/shared/types/enumShared';
import { useToast } from '@/shared/hooks/useToast';
import { Button } from '@/components/shared/button/Button';
import { Badge } from '@/components/shared/badge/badge';
import BackButton from '@/components/shared/BackButton/BackButton';
import { Loader } from '@/shared';
import { EmptyState } from '@/components/shared/EmptyState/EmptyState';
import { useOrder, useUpdateOrderStatus } from '@/hooks/useOrders';
import { formatearUsdConMiles } from '@/shared/utils/dinero';
import { FilaDeResumen } from '@/components/shared/resumen/FilaDeResumen';
import {
  getStatusColor,
  getStatusLabel,
} from '@/shared/utils/orderStatusHelpers';

export default function OrderDetailsPage() {
  const params = useParams<{ orderId: string }>();
  const router = useRouter();
  const { success, error } = useToast();

  const { orderId } = params;

  const {
    data: order,
    isLoading: loading,
    isError: hasError,
  } = useOrder(orderId as string);

  const { mutate: updateOrderStatus, isPending: updating } =
    useUpdateOrderStatus();

  useEffect(() => {
    if (hasError) {
      error({ title: 'Error al cargar la orden' });
      router.push('/private/sales');
    }
  }, [hasError, error, router]);

  const handleStatusUpdate = (newStatus: OrderStatusEnum) => {
    updateOrderStatus(
      { id: orderId as string, status: newStatus },
      {
        onSuccess: () => {
          success({
            title: `Orden ${getStatusLabel(newStatus).toLowerCase()}`,
          });
        },
        onError: () => {
          error({ title: 'Error al actualizar la orden' });
        },
      },
    );
  };

  const formatDateTime = (date: Date) => {
    return new Intl.DateTimeFormat('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  // Monto en Bs, formato venezolano (21.915,08). Se usa con la tasa BCV que
  // quedó guardada en la orden al momento del pago (order.bcvRate).
  const getAvailableActions = (currentStatus: OrderStatusEnum) => {
    const actions: {
      status: OrderStatusEnum;
      label: string;
      variant?: 'default' | 'outline' | 'destructive';
    }[] = [];

    switch (currentStatus) {
      case OrderStatusEnum.PENDING:
        actions.push(
          { status: OrderStatusEnum.IN_PROGRESS, label: 'Aceptar Orden' },
          {
            status: OrderStatusEnum.CANCELLED,
            label: 'Cancelar',
            variant: 'destructive',
          },
        );
        break;
      case OrderStatusEnum.IN_PROGRESS:
        actions.push(
          { status: OrderStatusEnum.READY, label: 'Marcar como Lista' },
          {
            status: OrderStatusEnum.CANCELLED,
            label: 'Cancelar',
            variant: 'destructive',
          },
        );
        break;
      case OrderStatusEnum.READY:
        actions.push({
          status: OrderStatusEnum.DELIVERED,
          label: 'Marcar como Entregada',
        });
        break;
      case OrderStatusEnum.CREDIT:
      case OrderStatusEnum.CANCELLED:
        // Estados terminales - sin acciones disponibles
        break;
    }

    return actions;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-elevated">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-center items-center h-64">
            <Loader />
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-elevated">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <EmptyState
            title="Orden no encontrada"
            description="La orden que buscas no existe o fue eliminada"
            icon="📋"
            actionLabel="Volver a Ventas"
            actionHref="/private/sales"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-elevated">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <BackButton href="/private/sales" className="mb-4" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-content">
                Orden #{order.id.slice(-8)}
              </h1>
              <p className="text-dim mt-1">
                Creada el {formatDateTime(order.createdAt)}
                {order.updatedAt &&
                  new Date(order.updatedAt).getTime() !==
                    new Date(order.createdAt).getTime() && (
                    <span className="ml-2">
                      • Actualizada el {formatDateTime(order.updatedAt)}
                    </span>
                  )}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={`${getStatusColor(order.status)} border`}>
                {getStatusLabel(order.status)}
              </Badge>
              <Button
                onClick={() => router.push(`/private/orders/${order.id}/edit`)}
                variant="outline"
                disabled={
                  order.status === OrderStatusEnum.DELIVERED ||
                  order.status === OrderStatusEnum.CREDIT ||
                  order.status === OrderStatusEnum.CANCELLED
                }
              >
                Editar Orden
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Información Principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Detalles de la Orden */}
            <div className="bg-surface rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-content mb-4">
                Detalles de la Orden
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-dim">Mesa</label>
                  <p className="text-content">
                    {order.tableId || 'Para llevar'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-dim">Estado</label>
                  <div className="mt-1">
                    <Badge className={getStatusColor(order.status)}>
                      {getStatusLabel(order.status)}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-dim">
                    Método de Pago
                  </label>
                  <p className="text-content">
                    {order.paymentMethod || 'No especificado'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-dim">
                    Estado de Pago
                  </label>
                  <p className="text-content">
                    {order.paymentStatus || 'Pendiente'}
                  </p>
                </div>
              </div>
              {order.notes && (
                <div className="mt-4">
                  <label className="text-sm font-medium text-dim">Notas</label>
                  <p className="text-content mt-1 p-3 bg-elevated rounded-md">
                    {order.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Items de la Orden */}
            <div className="bg-surface rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-content mb-4">
                Items ({order.items.length})
              </h2>
              <div className="space-y-4">
                {order.items.map((item, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-start p-4 bg-elevated rounded-lg"
                  >
                    <div className="flex-1">
                      <h3 className="font-medium text-content">{item.name}</h3>
                      <p className="text-sm text-dim">
                        {formatearUsdConMiles(item.unitPrice)} x {item.quantity}
                      </p>
                      {item.notes && (
                        <p className="text-sm text-dim mt-1 italic">
                          Nota: {item.notes}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-content">
                        {formatearUsdConMiles(item.total)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Resumen de Totales */}
            <div className="bg-surface rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-content mb-4">
                Resumen
              </h2>
              <div className="space-y-3">
                <FilaDeResumen
                  className="text-dim"
                  etiqueta="Subtotal:"
                  valor={formatearUsdConMiles(order.subtotal)}
                />
                <FilaDeResumen
                  className="text-dim"
                  etiqueta="Impuestos:"
                  valor={formatearUsdConMiles(order.tax)}
                />
                <hr className="my-3" />
                <FilaDeResumen
                  className="text-lg font-semibold text-content"
                  etiqueta="Total:"
                  valor={formatearUsdConMiles(order.total)}
                />
                {order.bcvRate ? (
                  <FilaDeResumen
                    className="text-base font-medium text-content"
                    etiqueta={
                      <>Total en Bs (tasa {formatearNumero(order.bcvRate)}):</>
                    }
                    valor={formatearBs(order.total * order.bcvRate)}
                  />
                ) : (
                  <div className="text-xs text-dim">
                    Esta orden no guardó la tasa del día al pagar.
                  </div>
                )}
              </div>
            </div>

            {/* Acciones */}
            {getAvailableActions(order.status).length > 0 && (
              <div className="bg-surface rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-semibold text-content mb-4">
                  Acciones
                </h2>
                <div className="space-y-3">
                  {getAvailableActions(order.status).map((action) => (
                    <Button
                      key={action.status}
                      onClick={() => handleStatusUpdate(action.status)}
                      variant={action.variant || 'default'}
                      className="w-full"
                      disabled={updating}
                    >
                      {updating ? 'Actualizando...' : action.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
