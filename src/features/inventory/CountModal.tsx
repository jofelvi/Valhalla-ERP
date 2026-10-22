'use client';
import Modal from '@/components/shared/modal';
import { useState } from 'react';
import { XIcon, Loader2, AlertCircle, Trash2, Plus } from 'lucide-react';
import { useCreateCount, useWarehouseStock } from '@/hooks/useInventory';
import { useProducts } from '@/hooks/useProducts';
import { Warehouse, InventoryBaseUnit, CountType } from '@odin6/types';
import { formatQuantity } from '@/shared/utils/inventoryFormatters';

interface CountItem {
  productId: string;
  quantity: number;
  unit: InventoryBaseUnit;
}

interface CountModalProps {
  warehouse: Warehouse;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CountModal({
  warehouse,
  onClose,
  onSuccess,
}: CountModalProps) {
  const { data: products = [] } = useProducts();
  const { data: _stock = [] } = useWarehouseStock(warehouse.id);
  const createCount = useCreateCount();

  const [countType, setCountType] = useState<CountType>('DIARIO');
  const [items, setItems] = useState<CountItem[]>([]);
  const [tempProductId, setTempProductId] = useState('');
  const [tempQuantity, setTempQuantity] = useState('');
  const [tempUnit, setTempUnit] = useState<InventoryBaseUnit>('GR');
  const [error, setError] = useState<string | null>(null);
  const [confirmLargeDiffsError, setConfirmLargeDiffsError] = useState<
    string | null
  >(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const selectedProduct = products.find((p) => p.id === tempProductId);
  const tempQuantityNum = parseFloat(tempQuantity);
  const validTempQuantity =
    Number.isFinite(tempQuantityNum) && tempQuantityNum > 0;
  const canAddItem = tempProductId && validTempQuantity;

  const handleAddItem = () => {
    if (!canAddItem || !selectedProduct) return;

    // Check if already in items
    if (items.some((i) => i.productId === tempProductId)) {
      setError('Este insumo ya está en el conteo');
      return;
    }

    setItems([
      ...items,
      {
        productId: tempProductId,
        quantity: tempQuantityNum,
        unit: tempUnit,
      },
    ]);

    setTempProductId('');
    setTempQuantity('');
    setTempUnit('GR');
    setError(null);
  };

  const handleRemoveItem = (productId: string) => {
    setItems(items.filter((i) => i.productId !== productId));
  };

  const handleSubmit = async (confirmLargeDiffs = false) => {
    if (items.length === 0) {
      setError('Agrega al menos un insumo al conteo');
      return;
    }

    setError(null);
    setConfirmLargeDiffsError(null);

    try {
      await createCount.mutateAsync({
        warehouseId: warehouse.id,
        type: countType,
        items,
        confirmLargeDiffs,
      });

      onSuccess?.();
      onClose();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';

      // Check if it's the 50% error
      if (errorMsg.includes('50%')) {
        setConfirmLargeDiffsError(errorMsg);
        setShowConfirmDialog(true);
      } else {
        setError(errorMsg);
      }
    }
  };

  if (typeof document === 'undefined') return null;

  return (
    <>
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
          <h2 className="font-semibold text-content">Conteo Físico</h2>
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

          {/* Count type */}
          <div>
            <label className="text-xs font-semibold text-content block mb-2">
              Tipo de Conteo *
            </label>
            <div className="space-y-2">
              {(['INICIAL', 'DIARIO', 'SEMANAL'] as CountType[]).map((type) => (
                <label
                  key={type}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="countType"
                    value={type}
                    checked={countType === type}
                    onChange={(e) => setCountType(e.target.value as CountType)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-content">
                    {type === 'INICIAL'
                      ? 'Inicial'
                      : type === 'DIARIO'
                        ? 'Diario'
                        : 'Semanal'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Add item section */}
          <div className="bg-elevated/40 rounded-xl p-3.5 space-y-2">
            <p className="text-xs font-semibold text-content">Agregar Insumo</p>

            <select
              value={tempProductId}
              onChange={(e) => {
                setTempProductId(e.target.value);
                const prod = products.find((p) => p.id === e.target.value);
                if (prod?.presentation === 'KG') setTempUnit('GR');
                else if (prod?.presentation === 'L') setTempUnit('ML');
                else setTempUnit('UND');
              }}
              className="input-field !py-2 !px-2.5 text-sm w-full"
            >
              <option value="">Selecciona insumo...</option>
              {products
                .filter((p) => p.isForInventory || p.type === 'BASE')
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>

            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                step="0.01"
                value={tempQuantity}
                onChange={(e) => setTempQuantity(e.target.value)}
                placeholder="Cantidad"
                className="input-field !py-2 !px-2.5 text-sm flex-1"
              />
              <select
                value={tempUnit}
                onChange={(e) =>
                  setTempUnit(e.target.value as InventoryBaseUnit)
                }
                className="input-field !py-2 !px-2.5 text-sm w-20"
              >
                <option value="GR">gr</option>
                <option value="ML">ml</option>
                <option value="UND">und</option>
              </select>
              <button
                onClick={handleAddItem}
                disabled={!canAddItem}
                className="px-3 py-2 rounded-lg bg-accent text-on-brand text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-40 flex items-center gap-1 flex-shrink-0"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Items list */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-content">
              Insumos ({items.length})
            </p>
            {items.length === 0 ? (
              <p className="text-xs text-dim italic">
                Agrega insumos para contar...
              </p>
            ) : (
              <div className="space-y-1.5">
                {items.map((item) => {
                  const prod = products.find((p) => p.id === item.productId);
                  return (
                    <div
                      key={item.productId}
                      className="bg-elevated/50 rounded-lg p-2 flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-content">
                          {prod?.name}
                        </p>
                        <p className="text-xs text-dim">
                          {formatQuantity(item.quantity, item.unit)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveItem(item.productId)}
                        className="text-danger hover:bg-danger/10 rounded-lg p-1.5 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
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
            onClick={() => void handleSubmit(false)}
            disabled={items.length === 0 || createCount.isPending}
            className="flex-1 px-4 py-2.5 rounded-xl bg-accent text-on-brand font-medium hover:bg-accent/90 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {createCount.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Registrar'
            )}
          </button>
        </div>
      </Modal>

      {/* Las diferencias grandes se confirman aparte, y por eso van una
          capa por encima: si no, quedan debajo del conteo que las abrio. */}
      <Modal
        isOpen={showConfirmDialog}
        estiloPropio
        onClose={() => setShowConfirmDialog(false)}
        capa="encima"
        classNameFondo="bg-black/80"
        classNameWrap="p-4"
        className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm border border-line"
      >
        <div className="p-5 space-y-4">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-warn flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-content mb-1">
                Diferencias Grandes Detectadas
              </h3>
              <p className="text-sm text-dim">{confirmLargeDiffsError}</p>
            </div>
          </div>

          <div className="bg-warn/10 border border-warn/30 rounded-lg p-3">
            <p className="text-xs text-warn">
              ¿Deseas confirmar las diferencias detectadas y proceder con el
              conteo?
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowConfirmDialog(false)}
              className="flex-1 px-4 py-2.5 rounded-xl bg-elevated text-content font-medium hover:bg-elevated/80 transition-colors"
            >
              Corregir
            </button>
            <button
              onClick={() => {
                void handleSubmit(true);
                setShowConfirmDialog(false);
              }}
              className="flex-1 px-4 py-2.5 rounded-xl bg-warn text-on-brand font-medium hover:bg-warn/90 transition-colors"
            >
              Confirmar Diferencias
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
