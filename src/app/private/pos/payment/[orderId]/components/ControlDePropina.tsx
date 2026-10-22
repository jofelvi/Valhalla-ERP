'use client';

import { Input } from '@/components/shared/input/input';

const TIPS_RAPIDOS = [1, 2, 3, 5];

interface ControlDePropinaProps {
  selectedTip: number | null;
  onTipSelect: (amount: number) => void;
  showCustomTip: boolean;
  onToggleCustomTip: () => void;
  customTipBs: string;
  onCustomTipChange: (value: string) => void;
  tipAmount: number;
  bcvRate: number;
}

/** Selector de propina: montos rápidos en USD o monto personalizado en Bs. */
export function ControlDePropina({
  selectedTip,
  onTipSelect,
  showCustomTip,
  onToggleCustomTip,
  customTipBs,
  onCustomTipChange,
  tipAmount,
  bcvRate,
}: ControlDePropinaProps) {
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs font-medium text-dim">Propina:</span>
        <div className="flex items-center gap-1">
          {TIPS_RAPIDOS.map((tip) => (
            <button
              key={tip}
              onClick={() => onTipSelect(tip)}
              className={`w-9 h-7 rounded-lg text-xs font-semibold transition-all ${
                selectedTip === tip
                  ? 'bg-brand text-on-brand shadow-sm scale-105'
                  : 'bg-elevated text-dim hover:bg-elevated'
              }`}
            >
              ${tip}
            </button>
          ))}
          <button
            type="button"
            onClick={onToggleCustomTip}
            className={`h-7 px-2 rounded-lg text-xs font-semibold transition-all ${
              showCustomTip || customTipBs
                ? 'bg-brand text-on-brand shadow-sm scale-105'
                : 'bg-elevated text-dim hover:bg-elevated'
            }`}
          >
            Otro Bs
          </button>
        </div>
      </div>
      {showCustomTip && (
        <div className="mt-1.5 flex items-center gap-2">
          <Input
            type="text"
            inputMode="decimal"
            placeholder="Monto en Bs"
            value={customTipBs}
            onChange={(e) => onCustomTipChange(e.target.value)}
            className="h-7 text-xs flex-1"
            autoFocus
          />
          {customTipBs && bcvRate > 0 && (
            <span className="text-[10px] text-dim whitespace-nowrap">
              ≈ ${tipAmount.toFixed(2)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
