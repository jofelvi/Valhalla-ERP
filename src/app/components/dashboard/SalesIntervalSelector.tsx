'use client';

import { SalesIntervalEnum } from '@/shared';

const intervals = [
  { value: SalesIntervalEnum.TODAY, label: 'Hoy' },
  // Ayer: el rango ya existia en intervalUtils, solo faltaba el boton. Es el
  // que hace falta para cuadrar los cobros del dia contra el extracto banc.
  { value: SalesIntervalEnum.YESTERDAY, label: 'Ayer' },
  { value: SalesIntervalEnum.CURRENT_WEEK, label: 'Esta Semana' },
  { value: SalesIntervalEnum.PREVIOUS_WEEK, label: 'Semana Pasada' },
  { value: SalesIntervalEnum.CURRENT_MONTH, label: 'Mes Actual' },
  { value: SalesIntervalEnum.PREVIOUS_MONTH, label: 'Mes Anterior' },
];

interface SalesIntervalSelectorProps {
  selected: SalesIntervalEnum;
  onChange: (interval: SalesIntervalEnum) => void;
}

export default function SalesIntervalSelector({
  selected,
  onChange,
}: SalesIntervalSelectorProps) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {intervals.map((interval) => (
        <button
          key={interval.value}
          onClick={() => onChange(interval.value)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            selected === interval.value
              ? 'bg-gradient-to-r from-brand to-brand-light text-on-brand shadow-md shadow-brand/25'
              : 'bg-surface/70 text-brand hover:bg-surface border border-line/50'
          }`}
        >
          {interval.label}
        </button>
      ))}
    </div>
  );
}
