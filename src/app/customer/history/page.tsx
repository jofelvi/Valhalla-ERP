'use client';
export const dynamic = 'force-dynamic';
import { useMemo } from 'react';
import { useUserStore } from '@/shared/store/useUserStore';
import {
  Calendar,
  CheckCircle,
  Clock,
  DollarSign,
  Package,
  XCircle,
} from 'lucide-react';
import { OrderStatusEnum, PaymentStatusEnum } from '@/shared';
import { CUSTOMER_ROUTES } from '@/shared';
import Link from 'next/link';
import { useOrders } from '@/hooks';

const statusConfig = {
  [OrderStatusEnum.PENDING]: {
    color: 'bg-amber-100 text-amber-800 border border-amber-200',
    icon: Clock,
    label: 'Pendiente',
  },
  [OrderStatusEnum.IN_PROGRESS]: {
    color: 'bg-elevated text-content border border-line',
    icon: Package,
    label: 'En Progreso',
  },
  [OrderStatusEnum.READY]: {
    color: 'bg-ok text-ok border border-emerald-200',
    icon: CheckCircle,
    label: 'Listo',
  },
  [OrderStatusEnum.DELIVERED]: {
    color: 'bg-teal-100 text-teal-800 border border-teal-200',
    icon: CheckCircle,
    label: 'Entregado',
  },
  [OrderStatusEnum.CREDIT]: {
    color: 'bg-elevated text-content border border-line',
    icon: Clock,
    label: 'Crédito Pendiente',
  },
  [OrderStatusEnum.CANCELLED]: {
    color: 'bg-danger text-danger border border-danger',
    icon: XCircle,
    label: 'Cancelado',
  },
  [OrderStatusEnum.PAID]: {
    color: 'bg-elevated text-content border border-line',
    icon: DollarSign,
    label: 'Pagado',
  },
};

const paymentStatusConfig = {
  [PaymentStatusEnum.PENDING]: {
    color: 'bg-amber-100 text-amber-800 border border-amber-200',
    label: 'Pendiente',
  },
  [PaymentStatusEnum.PENDING_VERIFICATION]: {
    color: 'bg-amber-100 text-amber-800 border border-amber-200',
    label: 'Pendiente de verificación',
  },
  [PaymentStatusEnum.PARTIAL]: {
    color: 'bg-orange-100 text-orange-800 border border-orange-200',
    label: 'Parcial',
  },
  [PaymentStatusEnum.PAID]: {
    color: 'bg-ok text-ok border border-emerald-200',
    label: 'Pagado',
  },
  [PaymentStatusEnum.REFUNDED]: {
    color: 'bg-elevated text-slate-800 border border-line',
    label: 'Reembolsado',
  },
  [PaymentStatusEnum.CANCELLED]: {
    color: 'bg-danger text-danger border border-danger',
    label: 'Cancelado',
  },
};

export default function CustomerOrders() {
  const { user } = useUserStore();
  const { data: allOrders = [], isLoading } = useOrders();

  const orders = useMemo(() => {
    if (!user?.id) return [];
    return allOrders
      .filter((order) => order.customerId === user.id)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [user?.id, allOrders]);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-brand"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-teal-900">
          Historial de Pedidos
        </h1>
        <p className="text-brand">Revisa todos tus pedidos anteriores</p>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-brand mx-auto mb-4" />
          <h3 className="text-lg font-medium text-teal-900 mb-2">
            No tienes pedidos aún
          </h3>
          <p className="text-brand mb-4">
            ¡Realiza tu primer pedido y aparecerá aquí!
          </p>
          <Link
            href={CUSTOMER_ROUTES.CATALOG}
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all duration-200 shadow-lg shadow-teal-500/25"
          >
            Ver Productos
          </Link>
        </div>
      ) : (
        <div className="grid gap-6">
          {orders.map((order) => {
            const statusInfo = statusConfig[order.status];
            const paymentInfo = order.paymentStatus
              ? paymentStatusConfig[order.paymentStatus]
              : null;
            const StatusIcon = statusInfo.icon;

            return (
              <div
                key={order.id}
                className="bg-surface/80 backdrop-blur-sm rounded-xl shadow-sm border border-teal-200 overflow-hidden hover:shadow-lg transition-all duration-200"
              >
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-teal-900">
                          Pedido #{order.id.slice(-8)}
                        </h3>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}
                        >
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusInfo.label}
                        </span>
                        {paymentInfo && (
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${paymentInfo.color}`}
                          >
                            {paymentInfo.label}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center text-sm text-brand space-x-4">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-1" />
                          {formatDate(order.createdAt)}
                        </div>
                        <div className="flex items-center">
                          <Package className="h-4 w-4 mr-1" />
                          {order.items.length} productos
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
                        ${order.total.toFixed(2)}
                      </div>
                      <div className="text-sm text-brand">
                        {order.paymentMethod && `Pago: ${order.paymentMethod}`}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-teal-200 pt-4">
                    <h4 className="font-medium text-teal-900 mb-3">
                      Productos:
                    </h4>
                    <div className="space-y-2">
                      {order.items.map((item, index) => (
                        <div
                          key={index}
                          className="flex justify-between items-center bg-teal-50 rounded-lg p-3 border border-teal-100"
                        >
                          <div>
                            <span className="font-medium text-teal-900">
                              {item.name}
                            </span>
                            {item.notes && (
                              <p className="text-sm text-brand mt-1">
                                Nota: {item.notes}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="font-medium text-teal-900">
                              {item.quantity}x ${item.unitPrice.toFixed(2)}
                            </div>
                            <div className="text-sm text-brand">
                              Total: ${item.total.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {order.notes && (
                    <div className="border-t border-teal-200 pt-4 mt-4">
                      <h4 className="font-medium text-teal-900 mb-2">
                        Notas del pedido:
                      </h4>
                      <p className="text-brand bg-teal-50 rounded-lg p-3 border border-teal-100">
                        {order.notes}
                      </p>
                    </div>
                  )}

                  <div className="border-t border-teal-200 pt-4 mt-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-brand">Subtotal:</span>
                      <span className="font-medium text-teal-900">
                        ${order.subtotal.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm mt-1">
                      <span className="text-brand">Impuestos:</span>
                      <span className="font-medium text-teal-900">
                        ${order.tax.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-lg font-bold mt-2 pt-2 border-t border-teal-200">
                      <span className="text-teal-900">Total:</span>
                      <span className="bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
                        ${order.total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
