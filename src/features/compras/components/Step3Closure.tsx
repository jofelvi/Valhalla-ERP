'use client';

import React, { useMemo, useEffect, useState } from 'react';
import SearchableSelect, {
  SearchableSelectOption,
} from '@/components/shared/searchableSelect/SearchableSelect';
import { useSuppliers } from '@/hooks/useSuppliers';
import { CurrencyType } from '@odin6/types';
import { formatearUsd } from '@/shared/utils/dinero';

interface Step3ClosureProps {
  supplierId: string;
  onSupplierIdChange: (id: string) => void;
  purchaseDate: string;
  onPurchaseDateChange: (date: string) => void;
  currency: CurrencyType;
  onCurrencyChange: (currency: CurrencyType) => void;
  bcvRate?: number;
  onBcvRateChange: (rate: number) => void;
  total: number;
}

export function Step3Closure({
  supplierId,
  onSupplierIdChange,
  purchaseDate,
  onPurchaseDateChange,
  currency,
  onCurrencyChange,
  bcvRate,
  onBcvRateChange,
  total,
}: Step3ClosureProps) {
  const { data: suppliers = [] } = useSuppliers();
  const [bcvLoading, setBcvLoading] = useState(false);

  // Load BCV rate when currency is BS
  useEffect(() => {
    if (currency === 'BS') {
      setBcvLoading(true);
      fetch('/api/bcv-rate')
        .then((res) => res.json())
        .then((data) => {
          if (data.rate && data.source !== 'default') {
            onBcvRateChange(data.rate);
          }
        })
        .catch(() => {
          // Silently fail, user can enter manually
        })
        .finally(() => setBcvLoading(false));
    }
  }, [currency, onBcvRateChange]);

  const supplierOptions: SearchableSelectOption[] = useMemo(
    () =>
      suppliers.map((s) => ({
        value: s.id,
        label: s.name,
      })),
    [suppliers],
  );

  const selectedSupplier = suppliers.find((s) => s.id === supplierId);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-content">Paso 3: Cierre</h3>

      {/* Supplier */}
      <SearchableSelect
        id="supplier"
        label="Proveedor"
        options={supplierOptions}
        value={supplierId}
        onChange={onSupplierIdChange}
        placeholder="Selecciona un proveedor..."
        searchPlaceholder="Buscar proveedor..."
        required
      />

      {/* Purchase Date */}
      <div>
        <label className="block text-sm font-medium text-dim mb-2">
          Fecha de Compra
        </label>
        <input
          type="date"
          value={purchaseDate}
          onChange={(e) => onPurchaseDateChange(e.target.value)}
          className="w-full px-3 py-2 bg-elevated border border-line rounded-lg text-content text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </div>

      {/* Currency */}
      <div>
        <label className="block text-sm font-medium text-dim mb-2">
          Moneda
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onCurrencyChange('USD')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              currency === 'USD'
                ? 'bg-brand text-on-brand'
                : 'bg-elevated text-content hover:bg-elevated/80'
            }`}
          >
            USD
          </button>
          <button
            type="button"
            onClick={() => onCurrencyChange('BS')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              currency === 'BS'
                ? 'bg-brand text-on-brand'
                : 'bg-elevated text-content hover:bg-elevated/80'
            }`}
          >
            Bs
          </button>
        </div>
      </div>

      {/* BCV Rate if BS */}
      {currency === 'BS' && (
        <div>
          <label className="block text-sm font-medium text-dim mb-2">
            Tasa BCV
            {bcvLoading && (
              <span className="text-xs text-dim ml-2">(cargando...)</span>
            )}
          </label>
          <input
            type="number"
            value={bcvRate || ''}
            onChange={(e) => onBcvRateChange(parseFloat(e.target.value) || 0)}
            placeholder="Ingresa la tasa BCV"
            step="0.01"
            className="w-full px-3 py-2 bg-elevated border border-line rounded-lg text-content text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
      )}

      {/* Summary */}
      <div className="bg-elevated rounded-lg p-4 border border-line space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-content">Total:</span>
          <span className="text-xl font-bold text-brand">
            {formatearUsd(total)} {currency}
          </span>
        </div>
        {currency === 'BS' && bcvRate && (
          <div className="flex items-center justify-between text-sm text-dim">
            <span>Equivalente en USD:</span>
            <span>{formatearUsd(total / bcvRate)} USD</span>
          </div>
        )}
        {selectedSupplier && (
          <div className="text-sm text-dim">
            <span>Proveedor: </span>
            <span className="text-content font-medium">
              {selectedSupplier.name}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
