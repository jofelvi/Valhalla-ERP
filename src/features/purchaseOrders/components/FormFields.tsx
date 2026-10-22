// Componente para los campos principales del formulario
'use client';

import { Controller, UseFormReturn } from 'react-hook-form';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { PurchaseOrderFormValues } from '@/shared/schemas/purchaseOrderSchema';
import { PurchaseOrderStatusEnum } from '@/shared';

interface FormFieldsProps {
  form: UseFormReturn<PurchaseOrderFormValues>;
  suppliers: Array<{ id: string; name: string }>;
}

/**
 * Componente con los campos principales del formulario (supplier, currency, status, fecha, total)
 */
export function FormFields({ form, suppliers }: FormFieldsProps) {
  const {
    register,
    control,
    formState: { errors },
  } = form;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Proveedor */}
      <div className="md:col-span-2">
        <label
          htmlFor="supplierId"
          className="block text-sm font-medium text-dim"
        >
          Proveedor *
        </label>
        <Controller
          control={control}
          name="supplierId"
          render={({ field }) => (
            <select
              id="supplierId"
              {...field}
              className={`mt-1 block w-full border ${
                errors.supplierId ? 'border-danger' : 'border-line'
              } rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand/30 focus:border-brand`}
            >
              <option value="">Seleccione un proveedor</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          )}
        />
        {errors.supplierId && (
          <p className="mt-1 text-sm text-danger">
            {errors.supplierId.message}
          </p>
        )}
      </div>

      {/* Moneda */}
      <div>
        <label
          htmlFor="currency"
          className="block text-sm font-medium text-dim"
        >
          Moneda *
        </label>
        <select
          id="currency"
          {...register('currency')}
          className={`mt-1 block w-full border ${
            errors.currency ? 'border-danger' : 'border-line'
          } rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand/30 focus:border-brand`}
        >
          <option value="USD">Dólares (USD)</option>
          <option value="EUR">Euros (EUR)</option>
          <option value="COP">Pesos Colombianos (COP)</option>
          <option value="MXN">Pesos Mexicanos (MXN)</option>
        </select>
        {errors.currency && (
          <p className="mt-1 text-sm text-danger">{errors.currency.message}</p>
        )}
      </div>

      {/* Estado */}
      <div>
        <label htmlFor="status" className="block text-sm font-medium text-dim">
          Estado *
        </label>
        <select
          id="status"
          {...register('status')}
          className={`mt-1 block w-full border ${
            errors.status ? 'border-danger' : 'border-line'
          } rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand/30 focus:border-brand`}
        >
          <option value={PurchaseOrderStatusEnum.PENDING}>Pendiente</option>
          <option value={PurchaseOrderStatusEnum.APPROVED}>Aprobada</option>
          <option value={PurchaseOrderStatusEnum.RECEIVED}>Recibida</option>
          <option value={PurchaseOrderStatusEnum.CANCELED}>Cancelada</option>
          <option value={PurchaseOrderStatusEnum.PARTIALLY_RECEIVED}>
            Parcialmente Recibida
          </option>
        </select>
        {errors.status && (
          <p className="mt-1 text-sm text-danger">{errors.status.message}</p>
        )}
      </div>

      {/* Fecha de Entrega */}
      <div>
        <label
          htmlFor="expectedDeliveryDate"
          className="block text-sm font-medium text-dim"
        >
          Fecha Esperada de Entrega
        </label>
        <Controller
          control={control}
          name="expectedDeliveryDate"
          render={({ field }) => (
            <DatePicker
              selected={field.value ? new Date(field.value) : null}
              onChange={(date) => field.onChange(date)}
              className={`mt-1 block w-full border ${
                errors.expectedDeliveryDate ? 'border-danger' : 'border-line'
              } rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand/30 focus:border-brand`}
              dateFormat="dd/MM/yyyy"
              placeholderText="Seleccione una fecha"
            />
          )}
        />
      </div>

      {/* Total */}
      <div>
        <label
          htmlFor="totalAmount"
          className="block text-sm font-medium text-dim"
        >
          Total
        </label>
        <input
          id="totalAmount"
          type="number"
          {...register('totalAmount')}
          disabled
          className="mt-1 block w-full border border-line rounded-md shadow-sm py-2 px-3 bg-elevated focus:outline-none focus:ring-brand/30 focus:border-brand"
        />
      </div>
    </div>
  );
}
