'use client';
import Modal from '@/components/shared/modal';
import { useEffect, useState } from 'react';
import { XIcon, Loader2, AlertCircle } from 'lucide-react';
import { useCreateWarehouse, useUpdateWarehouse } from '@/hooks/useInventory';
import { Warehouse, WarehouseArea } from '@odin6/types';

interface WarehouseModalProps {
  warehouse?: Warehouse | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const AREAS: { value: WarehouseArea; label: string }[] = [
  { value: 'GENERAL', label: 'General' },
  { value: 'COCINA', label: 'Cocina' },
  { value: 'PIZZERIA', label: 'Pizzería' },
  { value: 'BARRA', label: 'Barra' },
];

export default function WarehouseModal({
  warehouse,
  onClose,
  onSuccess,
}: WarehouseModalProps) {
  const createWarehouse = useCreateWarehouse();
  const updateWarehouse = useUpdateWarehouse();

  const isCreateMode = !warehouse;
  const isLoading = createWarehouse.isPending || updateWarehouse.isPending;

  const [name, setName] = useState('');
  const [area, setArea] = useState<WarehouseArea>('GENERAL');
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize fields from warehouse in edit mode
  useEffect(() => {
    if (warehouse) {
      setName(warehouse.name);
      setArea(warehouse.area);
      setIsDefault(warehouse.isDefault || false);
      setIsActive(warehouse.isActive !== false);
    } else {
      setName('');
      setArea('GENERAL');
      setIsDefault(false);
      setIsActive(true);
    }
    setError(null);
  }, [warehouse]);

  const canSubmit = name.trim().length > 0 && !isLoading;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setError(null);
    try {
      const nameToSubmit = name.trim();

      if (isCreateMode) {
        await createWarehouse.mutateAsync({
          name: nameToSubmit,
          area,
          isDefault,
          isActive,
        });
      } else if (warehouse) {
        await updateWarehouse.mutateAsync({
          id: warehouse.id,
          data: {
            name: nameToSubmit,
            area,
            isDefault,
            isActive,
          },
        });
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMsg);
    }
  };

  if (typeof document === 'undefined') return null;

  return (
    <Modal
      isOpen
      estiloPropio
      onClose={onClose}
      classNameFondo="bg-black/60"
      classNameWrap="p-4"
      className="bg-surface rounded-2xl shadow-2xl w-full max-w-md border border-line max-h-[90vh] flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-line">
        <h2 className="font-semibold text-content">
          {isCreateMode ? 'Crear Almacén' : 'Editar Almacén'}
        </h2>
        <button onClick={onClose} className="text-dim hover:text-content">
          <XIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="p-5 space-y-4 overflow-y-auto flex-1">
        {error && (
          <div className="bg-danger/10 border border-danger/30 rounded-xl p-3 flex gap-2">
            <AlertCircle className="h-4 w-4 text-danger flex-shrink-0 mt-0.5" />
            <p className="text-sm text-danger">{error}</p>
          </div>
        )}

        {/* Name */}
        <div>
          <label className="text-xs font-semibold text-content block mb-2">
            Nombre *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Almacén Principal"
            className="input-field w-full"
            disabled={isLoading}
          />
        </div>

        {/* Area */}
        <div>
          <label className="text-xs font-semibold text-content block mb-2">
            Área *
          </label>
          <select
            value={area}
            onChange={(e) => setArea(e.target.value as WarehouseArea)}
            className="input-field w-full"
            disabled={isLoading}
          >
            {AREAS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </div>

        {/* Default checkbox */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="w-4 h-4"
            disabled={isLoading}
          />
          <span className="text-sm text-content">
            Almacén por defecto del área
          </span>
        </label>

        {/* Active checkbox (only in edit mode) */}
        {!isCreateMode && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4"
              disabled={isLoading}
            />
            <span className="text-sm text-content">Activo</span>
          </label>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-line p-5 flex gap-2">
        <button
          onClick={onClose}
          disabled={isLoading}
          className="flex-1 px-4 py-2.5 rounded-xl bg-elevated text-content font-medium hover:bg-elevated/80 transition-colors disabled:opacity-40"
        >
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="flex-1 px-4 py-2.5 rounded-xl bg-accent text-on-brand font-medium hover:bg-accent/90 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isCreateMode ? (
            'Crear'
          ) : (
            'Guardar'
          )}
        </button>
      </div>
    </Modal>
  );
}
