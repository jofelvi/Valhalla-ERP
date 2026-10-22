// app/pos/AccountReceivableForm.tsx
'use client';
import { formatearBs } from '@/shared/utils/dinero';

import { useMemo, useState } from 'react';
import { Resolver, SubmitHandler, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/shared/button/Button';
import { Input } from '@/components/shared/input/input';
import SelectCustom from '@/components/shared/selectCustom/SelectCustom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/shared/card/card';

import { useCustomers } from '@/hooks/useCustomers';
import {
  useCreateAccountsReceivable,
  useUpdateAccountsReceivable,
} from '@/hooks/useAccountsReceivable';
import { AccountReceivable } from '@/modelTypes/accountReceivable';
import { InvoiceStatusEnum } from '@/shared';

const accountReceivableSchema = yup.object({
  customerId: yup.string().required('Cliente es requerido'),
  invoiceNumber: yup.string().required('Número de factura es requerido'),
  amount: yup
    .number()
    .min(0.01, 'El monto debe ser mayor a 0')
    .required('Monto es requerido'),
  paidAmount: yup
    .number()
    .min(0, 'El monto pagado no puede ser negativo')
    .default(0),
  dueDate: yup
    .string()
    .required('Fecha de vencimiento es requerida')
    .matches(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido'),
  description: yup.string().optional(),
});

type AccountReceivableFormData = yup.InferType<typeof accountReceivableSchema>;

interface AccountReceivableFormProps {
  accountReceivable?: AccountReceivable;
  onSuccess?: () => void;
}

export default function AccountReceivableForm({
  accountReceivable,
  onSuccess,
}: AccountReceivableFormProps) {
  const router = useRouter();
  // El selector solo ofrece clientes activos y solo muestra el nombre: no hay
  // motivo para bajarse la ficha completa de los 2.955. `activos: 'true'` lo
  // hace Mongo; el `.filter((c) => c.isActive)` de abajo queda como red por si
  // el servidor todavia no tiene el parametro.
  const { data: customersData = [] } = useCustomers({
    vista: 'lista',
    activos: 'true',
  });
  const createAR = useCreateAccountsReceivable();
  const updateAR = useUpdateAccountsReceivable();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<AccountReceivableFormData>({
    resolver: yupResolver(
      accountReceivableSchema,
    ) as Resolver<AccountReceivableFormData>,
    defaultValues: accountReceivable
      ? {
          customerId: accountReceivable.customerId,
          invoiceNumber: accountReceivable.invoiceNumber,
          amount: accountReceivable.amount,
          paidAmount: accountReceivable.paidAmount,
          dueDate: new Date(accountReceivable.dueDate)
            .toISOString()
            .split('T')[0],
          description: accountReceivable.description || '',
        }
      : {
          paidAmount: 0,
          dueDate: new Date().toISOString().split('T')[0],
        },
  });

  const [isLoading, setIsLoading] = useState(false);

  const watchedAmount = watch('amount');
  const watchedPaidAmount = watch('paidAmount');

  // Filter active customers
  const customers = useMemo(
    () => customersData.filter((c) => c.isActive),
    [customersData],
  );

  const calculateStatus = (amount: number, paid: number): InvoiceStatusEnum => {
    if (paid === 0) return InvoiceStatusEnum.PENDING;
    if (paid >= amount) return InvoiceStatusEnum.PAID;
    return InvoiceStatusEnum.PARTIALLY_PAID;
  };

  const onSubmit: SubmitHandler<AccountReceivableFormData> = async (data) => {
    setIsLoading(true);
    try {
      const cust = customers.find((c) => c.id === data.customerId);
      const status = calculateStatus(data.amount, data.paidAmount);

      const payload = {
        customerId: data.customerId,
        customerName: cust?.name || '',
        invoiceNumber: data.invoiceNumber,
        amount: data.amount,
        paidAmount: data.paidAmount,
        dueDate: new Date(data.dueDate),
        status,
        description: data.description || null,
        createdAt: accountReceivable?.createdAt || new Date(),
        updatedAt: new Date(),
      };

      if (accountReceivable) {
        await updateAR.mutateAsync({ id: accountReceivable.id, data: payload });
      } else {
        await createAR.mutateAsync(payload);
      }

      if (onSuccess) onSuccess();
      else router.push('/private/accounts-receivable');
    } catch {
      // console
    } finally {
      setIsLoading(false);
    }
  };

  const customerOptions = customers.map((c) => ({
    value: c.id,
    label: c.name,
  }));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card className="bg-surface/95 backdrop-blur-sm border-line shadow-lg">
        <CardHeader className="bg-gradient-to-r from-page to-elevated border-b border-line">
          <CardTitle className="text-content">
            {accountReceivable
              ? 'Editar Cuenta por Cobrar'
              : 'Nueva Cuenta por Cobrar'}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6 p-6">
          <SelectCustom
            id="customerId"
            label="Cliente"
            options={customerOptions}
            placeholder="Seleccionar cliente"
            register={register}
            name="customerId"
            required
            error={errors.customerId}
            disabled={false}
          />

          <Input
            {...register('invoiceNumber')}
            label="Número de Factura"
            placeholder="Ej: FAC-001"
            required
            error={errors.invoiceNumber}
          />

          <Input
            {...register('amount')}
            label="Monto Total"
            type="number"
            step="0.01"
            placeholder="0.00"
            variant="numeric"
            required
            error={errors.amount}
          />

          <Input
            {...register('paidAmount')}
            label="Monto Pagado"
            type="number"
            step="0.01"
            placeholder="0.00"
            variant="numeric"
            error={errors.paidAmount}
            textHelper="Cantidad ya pagada por el cliente"
          />

          <Input
            {...register('dueDate')}
            label="Fecha de Vencimiento"
            type="date"
            required
            error={errors.dueDate}
          />

          <div>
            <label className="block text-sm font-semibold mb-2 text-dim">
              Descripción
            </label>
            <textarea
              {...register('description')}
              className="w-full rounded-xl border border-line bg-surface/90 backdrop-blur-sm p-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              rows={3}
              placeholder="Descripción opcional..."
            />
          </div>

          {watchedAmount !== undefined && (
            <div className="bg-gradient-to-r from-page to-elevated p-6 rounded-xl border border-line shadow-sm">
              <h4 className="font-semibold mb-4 text-content flex items-center gap-2">
                <span className="w-2 h-2 bg-brand rounded-full" />
                Resumen de la Cuenta
              </h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-dim">Monto Total:</span>
                  <span className="text-lg font-semibold text-content">
                    {formatearBs(watchedAmount!)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dim">Monto Pagado:</span>
                  <span className="text-lg font-semibold text-ok">
                    {formatearBs(watchedPaidAmount!)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-line pt-3">
                  <span className="font-medium text-dim">Pendiente:</span>
                  <span className="text-lg font-bold text-danger">
                    {formatearBs(watchedAmount! - watchedPaidAmount!)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-dim">Estado:</span>
                  <span className="px-3 py-1 bg-elevated rounded-lg font-semibold text-dim">
                    {calculateStatus(watchedAmount!, watchedPaidAmount!) ===
                    InvoiceStatusEnum.PAID
                      ? 'Pagado'
                      : calculateStatus(watchedAmount!, watchedPaidAmount!) ===
                          InvoiceStatusEnum.PARTIALLY_PAID
                        ? 'Parcialmente Pagado'
                        : 'Pendiente'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          className="flex-1"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={isLoading}
          className="flex-1 bg-gradient-to-r from-brand to-brand hover:from-brand hover:to-brand"
        >
          {isLoading
            ? 'Guardando...'
            : accountReceivable
              ? 'Actualizar'
              : 'Crear'}
        </Button>
      </div>
    </form>
  );
}
