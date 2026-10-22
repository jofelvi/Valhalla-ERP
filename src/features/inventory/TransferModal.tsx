'use client';
import Modal from '@/components/shared/modal';
import { useState } from 'react';
import { XIcon, Loader2, AlertCircle } from 'lucide-react';
import { useTransfer, useWarehouses } from '@/hooks/useInventory';
import { useProducts } from '@/hooks/useProducts';
import { Warehouse, InventoryBaseUnit } from '@odin6/types';

interface TransferModalProps {
  warehouse: Warehouse;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function TransferModal({
  warehouse,
  onClose,
  onSuccess,
}: TransferModalProps) {
  const { data: warehouses = [] } = useWarehouses();
  const { data: products = [] } = useProducts();
  const transfer = useTransfer();

  const [fromWarehouseId, setFromWarehouseId] = useState(warehouse.id);
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<InventoryBaseUnit>('GR');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const quantityNum = parseFloat(quantity);
  const validQuantity = Number.isFinite(quantityNum) && quantityNum > 0;
  const selectedProduct = products.find((p) => p.id === productId);
  const canSubmit =
    fromWarehouseId &&
    toWarehouseId &&
    fromWarehouseId !== toWarehouseId &&
    productId &&
    validQuantity &&
    !transfer.isPending;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setError(null);
    try {
      await transfer.mutateAsync({
        fromWarehouseId,
        toWarehouseId,
        productId,
        quantity: quantityNum,
        unit,
        notes: notes.trim() || undefined,
      });

      onSuccess?.();
      onClose();
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : 'Error al registrar traslado';
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
        <h2 className="font-semibold text-content">Registrar Traslado</h2>
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

        {/* From warehouse */}
        <div>
          <label className="text-xs font-semibold text-content block mb-2">
            Desde (Almacén) *
          </label>
          <select
            value={fromWarehouseId}
            onChange={(e) => setFromWarehouseId(e.target.value)}
            className="input-field w-full"
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>

        {/* To warehouse */}
        <div>
          <label className="text-xs font-semibold text-content block mb-2">
            Hacia (Almacén) *
          </label>
          <select
            value={toWarehouseId}
            onChange={(e) => setToWarehouseId(e.target.value)}
            className="input-field w-full"
          >
            <option value="">Selecciona destino</option>
            {warehouses
              .filter((w) => w.id !== fromWarehouseId)
              .map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
          </select>
        </div>

        {/* Product */}
        <div>
          <label className="text-xs font-semibold text-content block mb-2">
            Insumo *
          </label>
          <select
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value);
              const prod = products.find((p) => p.id === e.target.value);
              if (prod?.presentation === 'KG') setUnit('GR');
              else if (prod?.presentation === 'L') setUnit('ML');
              else setUnit('UND');
            }}
            className="input-field w-full"
          >
            <option value="">Selecciona un insumo</option>
            {products
              .filter((p) => p.isForInventory || p.type === 'BASE')
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </div>

        {/* Quantity */}
        {selectedProduct && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-content block">
              Cantidad *
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Cantidad"
                className="input-field flex-1"
              />
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as InventoryBaseUnit)}
                className="input-field w-24"
              >
                <option value="GR">gr</option>
                <option value="ML">ml</option>
                <option value="UND">und</option>
              </select>
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="text-xs font-semibold text-content block mb-2">
            Notas (Opcional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas del traslado..."
            rows={2}
            className="input-field w-full resize-none"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-line p-5 flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2.5 rounded-xl bg-elevated text-content font-medium hover:bg-elevated/80 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="flex-1 px-4 py-2.5 rounded-xl bg-accent text-on-brand font-medium hover:bg-accent/90 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {transfer.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Registrar'
          )}
        </button>
      </div>
    </Modal>
  );
}
