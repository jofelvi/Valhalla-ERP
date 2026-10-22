// Componente para los botones de acción (cancelar y enviar)
'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/shared/button/Button';
import { PRIVATE_ROUTES } from '@/shared';

interface FormActionsProps {
  isNew: boolean;
  isSubmitting: boolean;
  canSubmit: boolean;
  initialDataId?: string;
}

/**
 * Componente con los botones de acción del formulario (Cancelar y Enviar)
 */
export function FormActions({
  isNew,
  isSubmitting,
  canSubmit,
  initialDataId,
}: FormActionsProps) {
  const router = useRouter();

  const handleCancel = () => {
    if (initialDataId) {
      // Si estamos editando, volver a los detalles
      router.push(PRIVATE_ROUTES.PURCHASE_ORDERS_DETAILS(initialDataId));
    } else {
      // Si estamos creando, volver a la lista
      router.push(PRIVATE_ROUTES.PURCHASE_ORDERS);
    }
  };

  return (
    <div className="flex justify-end space-x-4 pt-6 border-t border-line">
      <Button
        type="button"
        variant="ghost"
        onClick={handleCancel}
        disabled={isSubmitting}
      >
        Cancelar
      </Button>
      <Button type="submit" disabled={!canSubmit} isLoading={isSubmitting}>
        {isSubmitting
          ? isNew
            ? 'Creando...'
            : 'Actualizando...'
          : isNew
            ? 'Crear Orden'
            : 'Actualizar Orden'}
      </Button>
    </div>
  );
}
