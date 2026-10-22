import {
  UseFormRegister,
  FieldErrors,
  FieldArrayWithId,
} from 'react-hook-form';
import { ReceiptFormData } from '../types';
import { ReceivedItemRow } from './ReceivedItemRow';

interface ReceivedItemsSectionProps {
  fields: FieldArrayWithId<ReceiptFormData, 'items', 'id'>[];
  register: UseFormRegister<ReceiptFormData>;
  errors: FieldErrors<ReceiptFormData>;
  watchedItems: ReceiptFormData['items'] | undefined;
}

export const ReceivedItemsSection: React.FC<ReceivedItemsSectionProps> = ({
  fields,
  register,
  errors,
  watchedItems,
}) => {
  return (
    <div className="bg-surface rounded-lg shadow-sm p-6">
      <h2 className="text-xl font-semibold text-content mb-6">
        Items Recibidos
      </h2>

      <div className="space-y-6">
        {fields.map((field, index) => (
          <ReceivedItemRow
            key={field.id}
            index={index}
            field={field}
            register={register}
            errors={errors}
            watchedItem={watchedItems?.[index]}
          />
        ))}
      </div>
    </div>
  );
};
