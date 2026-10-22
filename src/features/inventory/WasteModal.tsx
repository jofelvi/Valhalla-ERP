'use client';
import Modal from '@/components/shared/modal';
import { useState } from 'react';
import { XIcon, Loader2, Upload, AlertCircle } from 'lucide-react';
import { useDeclareWaste } from '@/hooks/useInventory';
import { useProducts } from '@/hooks/useProducts';
import { Warehouse, InventoryBaseUnit } from '@odin6/types';

interface WasteModalProps {
  warehouse: Warehouse;
  onClose: () => void;
  onSuccess?: () => void;
}

const WASTE_REASONS = [
  'Se dañó',
  'Vencido',
  'Se cayó',
  'Error de cocina',
  'Otro',
];

export default function WasteModal({
  warehouse,
  onClose,
  onSuccess,
}: WasteModalProps) {
  const { data: products = [] } = useProducts();
  const declareWaste = useDeclareWaste();

  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<InventoryBaseUnit>('GR');
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const quantityNum = parseFloat(quantity);
  const validQuantity = Number.isFinite(quantityNum) && quantityNum > 0;
  const selectedProduct = products.find((p) => p.id === productId);
  const effectiveReason = reason === 'Otro' ? customReason.trim() : reason;
  const canSubmit =
    productId &&
    validQuantity &&
    reason &&
    effectiveReason &&
    photoFile &&
    !declareWaste.isPending;

  const handlePhotoSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Por favor selecciona una imagen válida');
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setError('La imagen no debe superar 5MB');
      return;
    }

    setPhotoFile(file);
    setError(null);

    // Preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPhotoPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add('bg-accent/10', 'border-accent');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('bg-accent/10', 'border-accent');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-accent/10', 'border-accent');
    const files = e.dataTransfer.files;
    if (files[0]) {
      handlePhotoSelect(files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit || !photoFile) return;

    setError(null);
    try {
      // Convert photo to base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        const imageBase64 = base64.split(',')[1]; // Remove data:image/jpeg;base64, prefix
        const extension = photoFile.type.split('/')[1] || 'jpeg';

        try {
          // Upload image
          const uploadRes = await fetch('/api/uploads/image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              category: 'waste-photos',
              subPath: warehouse.id,
              imageBase64,
              extension,
            }),
          });

          if (!uploadRes.ok) {
            const err = await uploadRes.json();
            throw new Error(err.message || 'Error al subir la foto');
          }

          const { url } = await uploadRes.json();

          // Declare waste - send raw quantity and unit, backend converts
          await declareWaste.mutateAsync({
            warehouseId: warehouse.id,
            productId,
            quantity: quantityNum,
            unit,
            reason: effectiveReason,
            photoUrl: url,
            notes: notes.trim() || undefined,
          });

          onSuccess?.();
          onClose();
        } catch (err) {
          const errorMsg =
            err instanceof Error ? err.message : 'Error desconocido';
          setError(errorMsg);
        }
      };
      reader.readAsDataURL(photoFile);
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : 'Error al registrar merma';
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
        <h2 className="font-semibold text-content">Declarar Merma</h2>
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

        {/* Product selector */}
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

        {/* Reason */}
        <div>
          <label className="text-xs font-semibold text-content block mb-2">
            Motivo *
          </label>
          <div className="space-y-2">
            {WASTE_REASONS.map((r) => (
              <label key={r} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="reason"
                  value={r}
                  checked={reason === r}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-4 h-4"
                />
                <span className="text-sm text-content">{r}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Custom reason if "Otro" selected */}
        {reason === 'Otro' && (
          <input
            type="text"
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            placeholder="Describe el motivo..."
            className="input-field w-full"
          />
        )}

        {/* Photo upload */}
        <div>
          <label className="text-xs font-semibold text-content block mb-2">
            Foto (Obligatoria) *
          </label>
          {!photoFile ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className="border-2 border-dashed border-line rounded-xl p-6 text-center cursor-pointer hover:bg-elevated/50 transition-colors"
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-dim" />
              <p className="text-sm text-dim">
                Arrastra una foto aquí o haz clic
              </p>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handlePhotoSelect(e.target.files[0]);
                  }
                }}
                className="hidden"
                id="waste-photo-input"
              />
              <label htmlFor="waste-photo-input" className="inline-block mt-3">
                <span className="text-xs text-accent hover:underline">
                  Selecciona archivo
                </span>
              </label>
            </div>
          ) : (
            <div className="space-y-2">
              <img
                src={photoPreview}
                alt="Preview"
                className="w-full h-40 object-cover rounded-xl border border-line"
              />
              <button
                type="button"
                onClick={() => {
                  setPhotoFile(null);
                  setPhotoPreview('');
                }}
                className="w-full text-sm text-danger hover:bg-danger/10 rounded-lg py-2 transition-colors"
              >
                Cambiar foto
              </button>
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs font-semibold text-content block mb-2">
            Notas (Opcional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas adicionales..."
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
          {declareWaste.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Registrar'
          )}
        </button>
      </div>
    </Modal>
  );
}
