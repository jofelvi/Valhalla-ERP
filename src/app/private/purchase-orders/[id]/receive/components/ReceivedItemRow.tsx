import { UseFormRegister, FieldErrors } from 'react-hook-form';
import { Input } from '@/components/shared/input/input';
import { TextareaWithError } from '@/shared/ui/textarea/TextareaWithError';
import { Badge } from '@/components/shared/badge/badge';
import { formatearUsdConMiles } from '@/shared/utils/dinero';
import { ReceiptFormData } from '../types';
import {
  hasSignificantPriceVariance,
  calculateItemPriceVariance,
  calculateVariancePercentage,
  getVarianceColor,
} from '../utils';

interface ReceivedItemRowProps {
  index: number;
  field: { id: string };
  register: UseFormRegister<ReceiptFormData>;
  errors: FieldErrors<ReceiptFormData>;
  watchedItem: ReceiptFormData['items'][number] | undefined;
}

export const ReceivedItemRow: React.FC<ReceivedItemRowProps> = ({
  index,
  field,
  register,
  errors,
  watchedItem,
}) => {
  if (!watchedItem) return null;

  const hasVariance = hasSignificantPriceVariance(
    watchedItem.receivedUnitPrice,
    watchedItem.orderedUnitPrice,
  );

  const itemVariance = calculateItemPriceVariance(
    watchedItem.receivedUnitPrice,
    watchedItem.orderedUnitPrice,
  );

  const variancePercentage = calculateVariancePercentage(
    watchedItem.receivedUnitPrice,
    watchedItem.orderedUnitPrice,
  );

  const isPartialDelivery =
    (watchedItem.receivedQuantity || 0) < watchedItem.orderedQuantity;

  return (
    <div key={field.id} className="border rounded-lg p-4 bg-elevated">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-medium text-content">
            {watchedItem.productName}
          </h3>
          <p className="text-sm text-dim">Unidad: {watchedItem.unit}</p>
        </div>
        <Badge
          className={
            isPartialDelivery ? 'bg-accent/15 text-accent' : 'bg-ok/15 text-ok'
          }
        >
          {isPartialDelivery ? 'Entrega Parcial' : 'Completo'}
        </Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-dim mb-1">
            Cant. Pedida
          </label>
          <div className="px-3 py-2 bg-elevated rounded-md text-sm text-dim">
            {watchedItem.orderedQuantity}
          </div>
        </div>

        <div>
          <Input
            label="Cant. Recibida"
            type="number"
            step="0.01"
            min="0"
            {...register(`items.${index}.receivedQuantity`, {
              valueAsNumber: true,
            })}
            error={errors.items?.[index]?.receivedQuantity}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-dim mb-1">
            Precio Pedido
          </label>
          <div className="px-3 py-2 bg-elevated rounded-md text-sm text-dim">
            {formatearUsdConMiles(watchedItem.orderedUnitPrice)}
          </div>
        </div>

        <div>
          <Input
            label="Precio Recibido"
            type="number"
            step="0.01"
            min="0"
            {...register(`items.${index}.receivedUnitPrice`, {
              valueAsNumber: true,
            })}
            error={errors.items?.[index]?.receivedUnitPrice}
          />
        </div>
      </div>

      <div className="mt-4">
        <TextareaWithError
          label="Observaciones del item"
          placeholder="Notas específicas de este producto..."
          {...register(`items.${index}.notes`)}
          error={errors.items?.[index]?.notes}
          rows={2}
        />
      </div>

      {/* Mostrar variación si existe */}
      {hasVariance && (
        <div className="mt-3 p-3 bg-accent/15 border border-accent/20 rounded-md">
          <div className="flex justify-between items-center text-sm">
            <span className="text-accent font-medium">
              Variación de precio:
            </span>
            <div className="flex items-center gap-2">
              <span className={getVarianceColor(itemVariance)}>
                {itemVariance > 0 ? '+' : ''}
                {formatearUsdConMiles(itemVariance)}
              </span>
              <span className="text-dim">({variancePercentage})</span>
            </div>
          </div>
        </div>
      )}

      {/* Campos ocultos para mantener los datos */}
      <input type="hidden" {...register(`items.${index}.productId`)} />
      <input type="hidden" {...register(`items.${index}.productName`)} />
      <input type="hidden" {...register(`items.${index}.orderedQuantity`)} />
      <input type="hidden" {...register(`items.${index}.orderedUnitPrice`)} />
      <input type="hidden" {...register(`items.${index}.unit`)} />
    </div>
  );
};
