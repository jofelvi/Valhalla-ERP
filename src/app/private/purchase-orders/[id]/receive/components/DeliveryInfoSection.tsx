import { UseFormRegister, FieldErrors } from 'react-hook-form';
import { Input } from '@/components/shared/input/input';
import { TextareaWithError } from '@/shared/ui/textarea/TextareaWithError';
import { FormErrorSummary } from '@/components/shared/formErrorSummary/FormErrorSummary';
import { ReceiptFormData } from '../types';

interface DeliveryInfoSectionProps {
  register: UseFormRegister<ReceiptFormData>;
  errors: FieldErrors<ReceiptFormData>;
}

export const DeliveryInfoSection: React.FC<DeliveryInfoSectionProps> = ({
  register,
  errors,
}) => {
  return (
    <div className="bg-surface rounded-lg shadow-sm p-6">
      <h2 className="text-xl font-semibold text-content mb-6">
        Información de Entrega
      </h2>

      <FormErrorSummary errors={errors} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Input
            label="Nombre de quien entrega"
            placeholder="Nombre del contacto de entrega"
            {...register('deliveryContactName')}
            error={errors.deliveryContactName}
          />
        </div>

        <div>
          <Input
            label="Teléfono de contacto"
            placeholder="Teléfono del contacto"
            {...register('deliveryContactPhone')}
            error={errors.deliveryContactPhone}
          />
        </div>
      </div>

      <div className="mt-6">
        <TextareaWithError
          label="Observaciones generales"
          placeholder="Notas adicionales sobre la recepción..."
          {...register('notes')}
          error={errors.notes}
          rows={3}
        />
      </div>
    </div>
  );
};
