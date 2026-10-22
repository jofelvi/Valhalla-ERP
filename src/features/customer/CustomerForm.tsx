'use client';
import { useForm, Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { Customer } from '@odin6/types';
import { IdentificationType } from '@/shared';
import { Input } from '@/components/shared/input/input';
import SelectCustom from '@/components/shared/selectCustom/SelectCustom';
import { enumToSelectOptions } from '@/shared/utils/enumToSelectOptions';
import { Button } from '@/components/shared/button/Button';
import {
  CustomerFormData,
  customerSchema,
} from '@/shared/schemas/customerSchema';

interface CustomerFormProps {
  initialData?: Customer | null;
  onSubmitAction: (values: CustomerFormData) => Promise<void>;
  isSubmitting: boolean;
}

export default function CustomerForm({
  initialData,
  onSubmitAction,
  isSubmitting,
}: CustomerFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerFormData>({
    resolver: yupResolver(customerSchema) as Resolver<CustomerFormData>,
    defaultValues: {
      name: initialData?.name || '',
      email: initialData?.email || null,
      phone: initialData?.phone || null,
      address: initialData?.address || null,
      identificationId: initialData?.identificationId ?? null,
      identificationType: initialData?.identificationType || null,
      isActive: initialData?.isActive ?? true,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmitAction)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Nombre */}
        <div>
          <Input
            label="Nombre Completo *"
            id="name"
            {...register('name')}
            error={errors.name?.message}
          />
        </div>

        {/* Email */}
        <div>
          <Input
            id="email"
            type="email"
            label={'Email'}
            {...register('email')}
            error={errors.email?.message}
          />
        </div>

        {/* Teléfono */}
        <div>
          <Input
            label={'Teléfono'}
            id="phone"
            {...register('phone')}
            error={errors.phone?.message}
          />
        </div>

        {/* Dirección */}
        <div>
          <Input
            label={'Dirección'}
            id="address"
            {...register('address')}
            error={errors.address?.message}
          />
        </div>

        {/* Tipo de Identificación */}
        <div>
          <SelectCustom<CustomerFormData>
            id={`iden`}
            name={`identificationType`}
            label="Producto Base"
            options={enumToSelectOptions(IdentificationType)}
            error={errors.identificationType}
            placeholder="Seleccionar producto..."
            className="w-full"
            register={register}
          />
        </div>

        {/* Número de Identificación */}
        <div>
          <Input
            label="Número de Identificación"
            id="identificationId"
            {...register('identificationId')}
            error={errors.identificationId?.message}
          />
        </div>

        {/* Estado */}
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="isActive"
            {...register('isActive')}
            className="h-4 w-4 text-brand focus:ring-brand/50 border-line rounded"
          />
          <label htmlFor="isActive" className="block text-sm font-medium">
            Cliente Activo
          </label>
        </div>
      </div>

      <div className="flex justify-end space-x-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => window.history.back()}
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : 'Guardar Cliente'}
        </Button>
      </div>
    </form>
  );
}
