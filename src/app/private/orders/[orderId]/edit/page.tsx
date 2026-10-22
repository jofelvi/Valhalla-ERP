'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getRouteParam } from '@/shared/utils/routeParams';
import { useForm } from 'react-hook-form';
import {
  OrderStatusEnum,
  PaymentMethodEnum,
  PaymentStatusEnum,
} from '@/shared/types/enumShared';
import { useToast } from '@/components/hooks/useToast';
import { Button } from '@/components/shared/button/Button';
import { Badge } from '@/components/shared/badge/badge';
import BackButton from '@/components/shared/BackButton/BackButton';
import { Input } from '@/components/shared/input/input';
import SelectCustom from '@/components/shared/selectCustom/SelectCustom';
import { Loader } from '@/shared';
import { EmptyState } from '@/components/shared/EmptyState/EmptyState';
import { FormErrorSummary } from '@/components/shared/formErrorSummary/FormErrorSummary';
import { TextareaWithError } from '@/shared/ui/textarea/TextareaWithError';
import { Order } from '@/modelTypes/order';
import { useOrder, useUpdateOrder } from '@/hooks/useOrders';
import { formatearUsdConMiles } from '@/shared/utils/dinero';
import { FilaDeResumen } from '@/components/shared/resumen/FilaDeResumen';
import {
  getStatusColor,
  getStatusLabel,
} from '@/shared/utils/orderStatusHelpers';

interface OrderFormData {
  status: OrderStatusEnum;
  paymentMethod: PaymentMethodEnum | '';
  paymentStatus: PaymentStatusEnum | '';
  notes: string;
  tableId: string;
}

export default function OrderEditPage() {
  const params = useParams();
  const router = useRouter();
  const { success, error } = useToast();
  const [saving, setSaving] = useState(false);

  const orderId = getRouteParam(params.orderId);
  const { data: order, isLoading } = useOrder(orderId);
  const updateOrderMutation = useUpdateOrder();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
    watch,
  } = useForm<OrderFormData>();

  useEffect(() => {
    if (!order) {
      if (!isLoading) {
        error({
          title: 'Orden no encontrada',
          description: 'La orden solicitada no fue encontrada',
        });
        router.push('/private/sales');
      }
      return;
    }

    if (
      order.status === OrderStatusEnum.DELIVERED ||
      order.status === OrderStatusEnum.CREDIT ||
      order.status === OrderStatusEnum.CANCELLED
    ) {
      error({
        title: 'Acción no permitida',
        description:
          'No se puede editar una orden que ya fue entregada, enviada a crédito o cancelada',
      });
      router.push(`/private/orders/${orderId}`);
      return;
    }

    // Establecer valores del formulario
    setValue('status', order.status);
    setValue('paymentMethod', order.paymentMethod || '');
    setValue('paymentStatus', order.paymentStatus || '');
    setValue('notes', order.notes || '');
    setValue('tableId', order.tableId || '');
  }, [orderId, order, isLoading, error, router, setValue]);

  const onSubmit = async (data: OrderFormData) => {
    if (!order) return;

    try {
      setSaving(true);

      const updateData: Partial<Order> = {
        status: data.status,
        paymentMethod:
          data.paymentMethod === ''
            ? null
            : (data.paymentMethod as PaymentMethodEnum),
        paymentStatus:
          data.paymentStatus === ''
            ? null
            : (data.paymentStatus as PaymentStatusEnum),
        notes: data.notes || null,
        tableId: data.tableId || null,
      };

      await updateOrderMutation.mutateAsync({
        id: order.id,
        data: updateData,
      });
      success({
        title: 'Orden actualizada',
        description: 'La orden ha sido actualizada correctamente',
      });
      router.push(`/private/orders/${order.id}`);
    } catch {
      error({
        title: 'Error de actualización',
        description:
          'No se pudo actualizar la orden. Verifique los datos e inténtelo nuevamente.',
      });
    } finally {
      setSaving(false);
    }
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

  // Opciones para los selects
  const statusOptions = [
    { value: OrderStatusEnum.PENDING, label: 'Pendiente' },
    { value: OrderStatusEnum.IN_PROGRESS, label: 'En Progreso' },
    { value: OrderStatusEnum.READY, label: 'Lista' },
    { value: OrderStatusEnum.DELIVERED, label: 'Entregada' },
    { value: OrderStatusEnum.CREDIT, label: 'Crédito' },
    { value: OrderStatusEnum.CANCELLED, label: 'Cancelada' },
  ];

  const paymentMethodOptions = [
    { value: '', label: 'No especificado' },
    { value: PaymentMethodEnum.CASH_BS, label: 'Efectivo Bsf' },
    { value: PaymentMethodEnum.CASH_USD, label: 'Efectivo divisa' },
    { value: PaymentMethodEnum.CARD, label: 'Tarjeta' },
    { value: PaymentMethodEnum.TRANSFER, label: 'Transferencia' },
    { value: PaymentMethodEnum.PAGO_MOVIL, label: 'Pago Móvil' },
    { value: PaymentMethodEnum.PAGO_MOVIL_MANUAL, label: 'Pago Móvil Manual' },
  ];

  const paymentStatusOptions = [
    { value: '', label: 'No especificado' },
    { value: PaymentStatusEnum.PENDING, label: 'Pendiente' },
    { value: PaymentStatusEnum.PAID, label: 'Pagado' },
    { value: PaymentStatusEnum.REFUNDED, label: 'Cancelado' },
    { value: PaymentStatusEnum.REFUNDED, label: 'Cancelado' },
  ];

  if (isLoading) {
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

  const currentStatus = watch('status');

  return (
    <div className="min-h-screen bg-elevated">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <BackButton href={`/private/orders/${order.id}`} className="mb-4" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-content">
                Editar Orden #{order.id.slice(-8)}
              </h1>
              <p className="text-dim mt-1">
                Creada el {formatDateTime(order.createdAt)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={`${getStatusColor(currentStatus)} border`}>
                {getStatusLabel(currentStatus)}
              </Badge>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Formulario Principal */}
            <div className="lg:col-span-2 space-y-6">
              {/* Información de la Orden */}
              <div className="bg-surface rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-semibold text-content mb-6">
                  Información de la Orden
                </h2>

                <FormErrorSummary errors={errors} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <SelectCustom
                      id="status"
                      label="Estado de la Orden"
                      options={statusOptions}
                      register={register}
                      name="status"
                      error={errors.status}
                      required
                    />
                  </div>

                  <div>
                    <Input
                      label="Mesa"
                      placeholder="Número de mesa (opcional)"
                      {...register('tableId')}
                      error={errors.tableId}
                    />
                  </div>

                  <div>
                    <SelectCustom
                      id="paymentMethod"
                      label="Método de Pago"
                      options={paymentMethodOptions}
                      register={register}
                      name="paymentMethod"
                      error={errors.paymentMethod}
                    />
                  </div>

                  <div>
                    <SelectCustom
                      id="paymentStatus"
                      label="Estado del Pago"
                      options={paymentStatusOptions}
                      register={register}
                      name="paymentStatus"
                      error={errors.paymentStatus}
                    />
                  </div>
                </div>

                <div className="mt-6">
                  <TextareaWithError
                    label="Notas"
                    placeholder="Notas adicionales sobre la orden..."
                    {...register('notes')}
                    error={errors.notes}
                    rows={3}
                  />
                </div>
              </div>

              {/* Items de la Orden (Solo lectura) */}
              <div className="bg-surface rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-semibold text-content mb-4">
                  Items de la Orden ({order.items.length})
                </h2>
                <p className="text-sm text-dim mb-4">
                  Los items no se pueden modificar desde aquí. Para cambiar
                  items, cancela esta orden y crea una nueva.
                </p>
                <div className="space-y-3">
                  {order.items.map((item, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-start p-4 bg-elevated rounded-lg"
                    >
                      <div className="flex-1">
                        <h3 className="font-medium text-content">
                          {item.name}
                        </h3>
                        <p className="text-sm text-dim">
                          {formatearUsdConMiles(item.unitPrice)} x{' '}
                          {item.quantity}
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
                </div>
              </div>

              {/* Acciones */}
              <div className="bg-surface rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-semibold text-content mb-4">
                  Acciones
                </h2>
                <div className="space-y-3">
                  <Button type="submit" className="w-full" disabled={saving}>
                    {saving ? 'Guardando...' : 'Guardar Cambios'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => router.push(`/private/orders/${order.id}`)}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
