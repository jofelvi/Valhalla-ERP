// features/tables/TableForm.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  TableFormValues,
  tableSchema,
} from '@/features/types/schemaYup/tableSchema';
import { TableStatusEnum } from '@/shared';
import { useCreateTable, useUpdateTable } from '@/hooks/useTables';
import { Table } from '@odin6/types';
import { useEntityForm } from '@/shared/hooks/useEntityForm';

interface TableFormProps {
  initialData?: Table | null;
  isNew?: boolean;
}

export default function TableForm({
  initialData = null,
  isNew: _isNew = false,
}: TableFormProps) {
  const router = useRouter();
  const createTable = useCreateTable();
  const updateTable = useUpdateTable();

  const { form, handleFormSubmit } = useEntityForm<TableFormValues>({
    schema: tableSchema,
    defaultValues: {
      name: '',
      number: 0,
      capacity: 2,
      status: TableStatusEnum.ISAVAILABLE,
      isAvailable: true,
      orderId: null,
    },
    initialData: initialData ?? undefined,
    onCreate: async (data: TableFormValues) => {
      const tableData = {
        ...data,
      };

      await createTable.mutateAsync(tableData);
      router.push('/private/tables');
    },
    onUpdate: async (data: TableFormValues) => {
      if (!initialData?.id) {
        return;
      }

      const tableData = {
        ...data,
      };

      await updateTable.mutateAsync({ id: initialData.id, data: tableData });
      router.push('/private/tables');
    },
  });

  // Sincronizar isAvailable con status
  useEffect(() => {
    const status = form.watch('status');
    form.setValue('isAvailable', status === TableStatusEnum.ISAVAILABLE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.watch('status')]);

  return (
    <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
      {Object.keys(form.formState.errors).length > 0 && (
        <div className="bg-danger/10 border border-danger/30 text-danger px-4 py-3 rounded">
          <ul className="list-disc pl-5">
            {Object.entries(form.formState.errors).map(([key, err]) => (
              <li key={key}>{(err as { message: string }).message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Campo Nombre */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-dim">
            Nombre *
          </label>
          <input
            id="name"
            {...form.register('name')}
            className={`mt-1 block w-full border ${
              form.formState.errors.name ? 'border-danger' : 'border-line'
            } rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand focus:border-brand`}
          />
          {form.formState.errors.name && (
            <p className="mt-1 text-sm text-danger">
              {form.formState.errors.name.message}
            </p>
          )}
        </div>

        {/* Campo Número */}
        <div>
          <label
            htmlFor="number"
            className="block text-sm font-medium text-dim"
          >
            Número *
          </label>
          <input
            type="number"
            id="number"
            {...form.register('number')}
            className={`mt-1 block w-full border ${
              form.formState.errors.number ? 'border-danger' : 'border-line'
            } rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand focus:border-brand`}
          />
          {form.formState.errors.number && (
            <p className="mt-1 text-sm text-danger">
              {form.formState.errors.number.message}
            </p>
          )}
        </div>

        {/* Campo Capacidad */}
        <div>
          <label
            htmlFor="capacity"
            className="block text-sm font-medium text-dim"
          >
            Capacidad *
          </label>
          <input
            type="number"
            id="capacity"
            {...form.register('capacity')}
            className={`mt-1 block w-full border ${
              form.formState.errors.capacity ? 'border-danger' : 'border-line'
            } rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand focus:border-brand`}
          />
          {form.formState.errors.capacity && (
            <p className="mt-1 text-sm text-danger">
              {form.formState.errors.capacity.message}
            </p>
          )}
        </div>

        {/* Campo Estado */}
        <div>
          <label
            htmlFor="status"
            className="block text-sm font-medium text-dim"
          >
            Estado *
          </label>
          <select
            id="status"
            {...form.register('status')}
            className={`mt-1 block w-full border ${
              form.formState.errors.status ? 'border-danger' : 'border-line'
            } rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand focus:border-brand`}
          >
            <option value={TableStatusEnum.ISAVAILABLE}>Disponible</option>
            <option value={TableStatusEnum.OCCUPIED}>Ocupada</option>
            <option value={TableStatusEnum.RESERVED}>Reservada</option>
            <option value={TableStatusEnum.CLEANING}>Limpieza</option>
          </select>
          {form.formState.errors.status && (
            <p className="mt-1 text-sm text-danger">
              {form.formState.errors.status.message}
            </p>
          )}
        </div>

        {/* Campo Disponibilidad (automático) */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="isAvailable"
            {...form.register('isAvailable')}
            disabled
            className="h-4 w-4 text-brand focus:ring-brand border-line rounded"
          />
          <label htmlFor="isAvailable" className="ml-2 block text-sm text-dim">
            Disponible para reservar
          </label>
        </div>
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={() => router.push('/private/tables')}
          className="bg-surface py-2 px-4 border border-line rounded-md shadow-sm text-sm font-medium text-dim hover:bg-elevated focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand"
          disabled={form.formState.isSubmitting}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="bg-brand py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-on-brand hover:bg-brand/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand disabled:opacity-50"
          disabled={createTable.isPending || updateTable.isPending}
        >
          {createTable.isPending || updateTable.isPending ? (
            <span className="flex items-center">
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              {!initialData ? 'Creando...' : 'Actualizando...'}
            </span>
          ) : !initialData ? (
            'Crear Mesa'
          ) : (
            'Actualizar'
          )}
        </button>
      </div>
    </form>
  );
}
