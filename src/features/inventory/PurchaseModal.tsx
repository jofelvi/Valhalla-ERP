'use client';
import Modal from '@/components/shared/modal';
import { useEffect, useState, useCallback } from 'react';
import {
  XIcon,
  Loader2,
  Upload,
  AlertCircle,
  Plus,
  Trash2,
} from 'lucide-react';
import { useCreatePurchase, useWarehouses } from '@/hooks/useInventory';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useProducts } from '@/hooks/useProducts';
import { formatearUsd } from '@/shared/utils/dinero';
import {
  CreatePurchaseDTO,
  PurchaseItemInput,
  CurrencyType,
  Warehouse,
} from '@odin6/types';

interface PurchaseModalProps {
  warehouse?: Warehouse;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function PurchaseModal({
  warehouse,
  onClose,
  onSuccess,
}: PurchaseModalProps) {
  const { data: products = [] } = useProducts();
  const { data: suppliers = [] } = useSuppliers();
  const { data: warehouses = [] } = useWarehouses();
  const createPurchase = useCreatePurchase();

  const [placeId, setPlaceId] = useState('');
  const [currency, setCurrency] = useState<CurrencyType>('USD');
  const [bcvRate, setBcvRate] = useState<string>('');
  const [items, setItems] = useState<PurchaseItemInput[]>([]);
  const [invoiceFiles, setInvoiceFiles] = useState<File[]>([]);
  const [invoicePreviews, setInvoicePreviews] = useState<string[]>([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [warehouseId, setWarehouseId] = useState(warehouse?.id || '');
  const [bcvRate_actual, setBcvRate_actual] = useState(0);

  const selectedWarehouse = warehouses.find((w) => w.id === warehouseId);

  // Cerrar modal con Escape
  const handleEscapeKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading && !isUploading) {
        onClose();
      }
    },
    [onClose, loading, isUploading],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [handleEscapeKey]);

  // Cargar tasa BCV cuando sea necesario
  useEffect(() => {
    if (currency === 'BS') {
      const loadBcv = async () => {
        try {
          const res = await fetch('/api/bcv-rate');
          if (res.ok) {
            const data = await res.json();
            const rate = data.rate;
            // Si la fuente es 'default' (fallback), no pre-rellenar
            if (data.source === 'default') {
              setBcvRate('');
              setBcvRate_actual(0);
              setError(
                'No se pudo obtener la tasa BCV — ingrésala manualmente (fuente fallback)',
              );
            } else {
              setBcvRate_actual(rate || 0);
              setBcvRate(String(rate || 0));
              setError(null);
            }
          } else {
            setBcvRate('');
            setBcvRate_actual(0);
            setError('Error al obtener tasa BCV — ingrésala manualmente');
          }
        } catch {
          setBcvRate('');
          setBcvRate_actual(0);
          setError(
            'No hay conexión para obtener tasa BCV — ingrésala manualmente',
          );
        }
      };
      void loadBcv();
    }
  }, [currency]);

  const calculateTotal = (): number => {
    return items.reduce(
      (sum, item) => sum + (item.unitCost * item.quantity || 0),
      0,
    );
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        productId: '',
        quantity: 0,
        unit: 'und',
        unitCost: 0,
        currency,
      },
    ]);
  };

  const handleBarcodeSearch = () => {
    if (!barcodeInput.trim()) {
      return;
    }

    const matchedProduct = products.find(
      (p) => p.barcode && p.barcode.trim() === barcodeInput.trim(),
    );

    if (!matchedProduct) {
      alert(`Código de barras no encontrado: ${barcodeInput}`);
      setBarcodeInput('');
      return;
    }

    // Agregar el producto como nuevo item con cantidad 0 (el usuario la ingresa)
    const newItem: PurchaseItemInput = {
      productId: matchedProduct.id,
      quantity: 0,
      unit: 'und',
      unitCost: 0,
      currency,
    };

    setItems([...items, newItem]);
    setBarcodeInput('');
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (
    index: number,
    field: keyof PurchaseItemInput,
    value: string | number,
  ) => {
    const newItems = [...items];
    if (field === 'quantity' || field === 'unitCost') {
      newItems[index][field] = parseFloat(String(value)) || 0;
    } else {
      // Setter genérico de campo de formulario: field ya está acotado a
      // 'productId' | 'unit' | 'currency' (los numéricos se manejan arriba).
      (newItems[index] as unknown as Record<string, unknown>)[field] = value;
    }
    setItems(newItems);
  };

  const handleInvoiceSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Por favor selecciona una imagen válida');
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('La imagen no debe superar 5MB');
      return;
    }

    setInvoiceFiles([...invoiceFiles, file]);
    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      setInvoicePreviews([...invoicePreviews, e.target?.result as string]);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveInvoice = (index: number) => {
    setInvoiceFiles(invoiceFiles.filter((_, i) => i !== index));
    setInvoicePreviews(invoicePreviews.filter((_, i) => i !== index));
  };

  const canSubmit =
    placeId &&
    items.length > 0 &&
    items.every(
      (item) => item.productId && item.quantity > 0 && item.unitCost >= 0,
    ) &&
    (currency === 'USD' || (currency === 'BS' && parseFloat(bcvRate) > 0)) &&
    !loading &&
    !isUploading;

  const handleSubmit = async () => {
    if (!canSubmit || !selectedWarehouse) return;

    setLoading(true);
    setIsUploading(true);
    setError(null);

    try {
      // Upload invoice images con Promise.all
      const uploadPromises = invoiceFiles.map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
              const base64 = e.target?.result as string;
              const imageBase64 = base64.split(',')[1];
              const extension = file.type.split('/')[1] || 'jpeg';

              try {
                const uploadRes = await fetch('/api/uploads/image', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    category: 'invoices',
                    subPath: new Date().toISOString().slice(0, 7),
                    imageBase64,
                    extension,
                  }),
                });

                if (uploadRes.ok) {
                  const { url } = await uploadRes.json();
                  resolve(url);
                } else {
                  reject(new Error(`Upload failed: ${uploadRes.statusText}`));
                }
              } catch (err) {
                reject(err);
              }
            };
            reader.onerror = () => {
              reject(new Error('FileReader error'));
            };
            reader.readAsDataURL(file);
          }),
      );

      const invoiceUrls: string[] =
        invoiceFiles.length > 0 ? await Promise.all(uploadPromises) : [];

      setIsUploading(false);

      const purchaseData: CreatePurchaseDTO = {
        placeId,
        placeName: suppliers.find((s) => s.id === placeId)?.name,
        items,
        currency,
        bcvRate: currency === 'BS' ? parseFloat(bcvRate) : undefined,
        invoiceUrls,
        warehouseId: selectedWarehouse.id,
      };

      const result = await createPurchase.mutateAsync(purchaseData);

      if (result.alerts && result.alerts.length > 0) {
        const alertMsg = result.alerts
          .map(
            (a) =>
              `${a.productName}: variación de ${a.variationPct > 0 ? '+' : ''}${a.variationPct.toFixed(1)}%`,
          )
          .join('\n');
        alert(`Alertas de variación de precio:\n\n${alertMsg}`);
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMsg);
    } finally {
      setLoading(false);
      setIsUploading(false);
    }
  };

  return (
    <Modal
      isOpen
      estiloPropio
      onClose={onClose}
      classNameFondo="bg-black/50"
      classNameWrap="p-4"
      className="bg-surface rounded-2xl border border-line shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
    >
      {/* Header */}
      <div className="sticky top-0 bg-surface border-b border-line p-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-content">Registrar Compra</h2>
        <button
          onClick={onClose}
          className="text-dim hover:text-content transition-colors"
        >
          <XIcon className="h-6 w-6" />
        </button>
      </div>

      {/* Body */}
      <div className="p-6 space-y-6">
        {error && (
          <div className="bg-danger/10 border border-danger rounded-lg p-4 flex gap-3">
            <AlertCircle className="h-5 w-5 text-danger flex-shrink-0 mt-0.5" />
            <p className="text-sm text-danger">{error}</p>
          </div>
        )}

        {/* Warehouse Selection */}
        {!warehouse && (
          <div>
            <label className="text-sm font-medium text-content mb-2 block">
              Almacén
            </label>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="w-full px-3 py-2 bg-elevated border border-line rounded-lg text-content text-sm"
            >
              <option value="">Selecciona un almacén</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Place/Supplier Selection */}
        <div>
          <label className="text-sm font-medium text-content mb-2 block">
            Lugar (Proveedor)
          </label>
          <select
            value={placeId}
            onChange={(e) => setPlaceId(e.target.value)}
            className="w-full px-3 py-2 bg-elevated border border-line rounded-lg text-content text-sm"
          >
            <option value="">Selecciona un lugar</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Currency Selection */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-content mb-2 block">
              Moneda
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrency('USD')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currency === 'USD'
                    ? 'bg-accent text-on-brand'
                    : 'bg-elevated text-content hover:bg-elevated/80'
                }`}
              >
                USD
              </button>
              <button
                onClick={() => setCurrency('BS')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currency === 'BS'
                    ? 'bg-accent text-on-brand'
                    : 'bg-elevated text-content hover:bg-elevated/80'
                }`}
              >
                Bs
              </button>
            </div>
          </div>

          {currency === 'BS' && (
            <div>
              <label className="text-sm font-medium text-content mb-2 block">
                Tasa BCV
              </label>
              <input
                type="number"
                value={bcvRate}
                onChange={(e) => setBcvRate(e.target.value)}
                className="w-full px-3 py-2 bg-elevated border border-line rounded-lg text-content text-sm"
                placeholder="Tasa de cambio"
              />
            </div>
          )}
        </div>

        {/* Barcode Scanner */}
        <div>
          <label className="text-sm font-medium text-content mb-2 block">
            Escanear Código de Barras
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleBarcodeSearch();
                }
              }}
              placeholder="Teclea o escanea código de barras..."
              className="flex-1 px-3 py-2 bg-elevated border border-line rounded-lg text-content text-sm"
            />
            <button
              onClick={handleBarcodeSearch}
              disabled={!barcodeInput.trim()}
              className="px-3 py-2 rounded-lg bg-accent text-on-brand hover:bg-accent/90 disabled:opacity-40 transition-colors text-sm font-medium"
            >
              Buscar
            </button>
          </div>
        </div>

        {/* Items */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-content">
              Items de Compra
            </label>
            <button
              onClick={handleAddItem}
              className="text-accent hover:text-accent/80 flex items-center gap-1 text-sm"
            >
              <Plus className="h-4 w-4" />
              Agregar
            </button>
          </div>

          <div className="space-y-3 max-h-48 overflow-y-auto">
            {items.map((item, idx) => (
              <div key={idx} className="flex gap-2 items-end">
                <select
                  value={item.productId}
                  onChange={(e) =>
                    handleItemChange(idx, 'productId', e.target.value)
                  }
                  className="flex-1 px-2 py-2 bg-elevated border border-line rounded text-content text-sm"
                >
                  <option value="">Producto</option>
                  {products
                    .filter((p) => p.isForInventory || p.type === 'BASE')
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
                <input
                  type="number"
                  value={item.quantity || ''}
                  onChange={(e) =>
                    handleItemChange(idx, 'quantity', e.target.value)
                  }
                  placeholder="Cant"
                  className="w-20 px-2 py-2 bg-elevated border border-line rounded text-content text-sm"
                />
                <select
                  value={item.unit}
                  onChange={(e) =>
                    handleItemChange(idx, 'unit', e.target.value)
                  }
                  className="w-24 px-2 py-2 bg-elevated border border-line rounded text-content text-sm"
                >
                  <option value="kg">kg</option>
                  <option value="gr">gr</option>
                  <option value="l">l</option>
                  <option value="ml">ml</option>
                  <option value="und">und</option>
                  <option value="unidad-compra">unidad-compra</option>
                </select>
                <input
                  type="number"
                  value={item.unitCost || ''}
                  onChange={(e) =>
                    handleItemChange(idx, 'unitCost', e.target.value)
                  }
                  placeholder="Costo"
                  className="w-24 px-2 py-2 bg-elevated border border-line rounded text-content text-sm"
                />
                <span className="text-sm text-dim w-16 text-right">
                  {formatearUsd(item.quantity * item.unitCost)}
                </span>
                <button
                  onClick={() => handleRemoveItem(idx)}
                  className="text-danger hover:bg-danger/10 rounded p-1"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Invoice Upload */}
        <div>
          <label className="text-sm font-medium text-content mb-2 block">
            Fotos de Factura
          </label>
          <div className="border-2 border-dashed border-line rounded-lg p-4 hover:border-accent/50 transition-colors">
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => {
                if (e.target.files) {
                  Array.from(e.target.files).forEach((file) =>
                    handleInvoiceSelect(file),
                  );
                }
              }}
              className="hidden"
              id="invoice-upload"
            />
            <label
              htmlFor="invoice-upload"
              className="cursor-pointer flex flex-col items-center"
            >
              <Upload className="h-6 w-6 text-accent mb-2" />
              <span className="text-sm text-content">Selecciona imágenes</span>
            </label>
          </div>

          {invoicePreviews.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {invoicePreviews.map((preview, idx) => (
                <div key={idx} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview}
                    alt="invoice"
                    className="w-full h-20 object-cover rounded border border-line"
                  />
                  <button
                    onClick={() => handleRemoveInvoice(idx)}
                    className="absolute top-1 right-1 bg-danger/90 text-on-brand rounded p-1"
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Summary */}
        {items.length > 0 && (
          <div className="bg-elevated rounded-lg p-4 border border-line">
            <div className="flex items-center justify-between">
              <span className="font-medium text-content">Total:</span>
              <div className="text-right">
                <p className="text-lg font-bold text-accent">
                  {formatearUsd(calculateTotal())} {currency}
                </p>
                {currency === 'BS' && bcvRate_actual > 0 && (
                  <p className="text-xs text-dim">
                    ≈ {formatearUsd(calculateTotal() / bcvRate_actual)} USD
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 bg-surface border-t border-line p-6 flex gap-3 justify-end">
        <button
          onClick={onClose}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-elevated text-content hover:bg-elevated/80 transition-colors disabled:opacity-40 text-sm font-medium"
        >
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="px-4 py-2 rounded-lg bg-accent text-on-brand hover:bg-accent/90 transition-colors disabled:opacity-40 flex items-center gap-2 text-sm font-medium"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Guardar Compra
        </button>
      </div>
    </Modal>
  );
}
