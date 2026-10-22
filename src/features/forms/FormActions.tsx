import { Button } from '@/components/shared/button/Button';
import { Loader2, Save } from 'lucide-react';

interface FormActionsProps {
  isSubmitting: boolean;
  isNew: boolean;
  onCancel: () => void;
}

export default function FormActions({
  isSubmitting,
  isNew,
  onCancel,
}: FormActionsProps) {
  return (
    <div className="bg-surface/90 backdrop-blur-sm border border-line/50 rounded-xl shadow-sm px-4 py-3 flex items-center justify-end gap-3">
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={isSubmitting}
      >
        Cancelar
      </Button>
      <Button type="submit" variant="default" disabled={isSubmitting}>
        {isSubmitting ? (
          <span className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            {isNew ? 'Creando...' : 'Guardando...'}
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Save className="w-4 h-4" />
            {isNew ? 'Crear Producto' : 'Guardar Cambios'}
          </span>
        )}
      </Button>
    </div>
  );
}
