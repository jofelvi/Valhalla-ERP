'use client';
import { AlertCircle, Plus } from 'lucide-react';
import { formatUSD } from '../utils/formatters';

interface AdjustmentsSectionProps {
  adjType: 'ADDITION' | 'DEDUCTION';
  onAdjTypeChange: (type: 'ADDITION' | 'DEDUCTION') => void;
  adjConcept: string;
  onAdjConceptChange: (concept: string) => void;
  adjAmount: string;
  onAdjAmountChange: (amount: string) => void;
  adjCurrency: 'USD' | 'BS';
  onAdjCurrencyChange: (currency: 'USD' | 'BS') => void;
  draftUsd: number;
  draftMissingConcept: boolean;
  bcvRate: number;
  onAddAdjustment: () => void;
  isAddDisabled: boolean;
}

export function AdjustmentsSection({
  adjType,
  onAdjTypeChange,
  adjConcept,
  onAdjConceptChange,
  adjAmount,
  onAdjAmountChange,
  adjCurrency,
  onAdjCurrencyChange,
  draftMissingConcept,
  bcvRate,
  onAddAdjustment,
  isAddDisabled,
}: AdjustmentsSectionProps) {
  const hasAmount = parseFloat(adjAmount) > 0;

  return (
    <div className="bg-elevated/30 rounded-xl p-3 space-y-2">
      <p className="text-xs font-semibold text-content">
        Agregar ajuste (préstamo, propina por fuera, etc.)
      </p>
      <div className="flex gap-2">
        <select
          value={adjType}
          onChange={(e) =>
            onAdjTypeChange(e.target.value as 'ADDITION' | 'DEDUCTION')
          }
          className="input-field !py-1.5 !px-2 text-xs flex-shrink-0"
        >
          <option value="DEDUCTION">− Deducción</option>
          <option value="ADDITION">+ Adición</option>
        </select>
        <input
          type="text"
          value={adjConcept}
          onChange={(e) => onAdjConceptChange(e.target.value)}
          placeholder="Concepto (ej: préstamo)"
          className="input-field !py-1.5 !px-2 text-xs flex-1 min-w-0"
        />
      </div>
      <div className="flex gap-2">
        <input
          type="number"
          min="0"
          step="0.01"
          value={adjAmount}
          onChange={(e) => onAdjAmountChange(e.target.value)}
          placeholder="Monto"
          className="input-field !py-1.5 !px-2 text-xs flex-1 min-w-0"
        />
        <select
          value={adjCurrency}
          onChange={(e) => onAdjCurrencyChange(e.target.value as 'USD' | 'BS')}
          className="input-field !py-1.5 !px-2 text-xs flex-shrink-0"
        >
          <option value="USD">USD</option>
          <option value="BS">Bs</option>
        </select>
        <button
          onClick={onAddAdjustment}
          disabled={isAddDisabled}
          className="px-3 py-1.5 rounded-lg bg-accent/20 text-accent text-xs font-medium hover:bg-accent/30 transition-colors disabled:opacity-40 flex items-center gap-1 flex-shrink-0"
        >
          <Plus className="h-3 w-3" />
          Agregar
        </button>
      </div>
      {adjCurrency === 'BS' && hasAmount && bcvRate > 0 && (
        <p className="text-[10px] text-dim">
          Equivale a {formatUSD(parseFloat(adjAmount) / bcvRate)} (tasa{' '}
          {bcvRate.toFixed(2)})
        </p>
      )}
      {draftMissingConcept && (
        <p className="text-[10px] text-danger flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          El monto ya está descontado del neto — escribe el concepto para abonar
          (o borra el monto).
        </p>
      )}
    </div>
  );
}
