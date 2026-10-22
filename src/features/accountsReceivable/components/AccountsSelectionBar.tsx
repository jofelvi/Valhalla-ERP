'use client';

import { Button } from '@/components/shared/button/Button';
import { Merge, X } from 'lucide-react';

interface AccountsSelectionBarProps {
  selectedCount: number;
  canMerge: boolean;
  isMerging: boolean;
  onMerge: () => void;
  onClear: () => void;
}

export const AccountsSelectionBar = ({
  selectedCount,
  canMerge,
  isMerging,
  onMerge,
  onClear,
}: AccountsSelectionBarProps) => {
  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-auto">
      <div className="bg-surface/95 backdrop-blur-md rounded-2xl shadow-2xl border border-brand/30 p-3 sm:px-5 sm:py-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-sm shrink-0">
            {selectedCount}
          </div>
          <span className="text-sm font-medium text-content flex-1 sm:flex-none">
            {selectedCount === 1
              ? 'cuenta seleccionada'
              : 'cuentas seleccionadas'}
          </span>
          <Button
            size="sm"
            onClick={onMerge}
            disabled={!canMerge || isMerging}
            className="bg-gradient-to-r from-brand to-brand-light hover:from-brand-light hover:to-brand text-on-brand disabled:opacity-40 shadow-lg shrink-0"
          >
            <Merge className="w-4 h-4 mr-1.5" />
            Unificar
          </Button>
          <button
            type="button"
            onClick={onClear}
            className="p-1.5 rounded-lg text-dim hover:text-danger hover:bg-danger/10 transition-colors shrink-0"
            title="Limpiar selección"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
