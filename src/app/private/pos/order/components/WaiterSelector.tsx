'use client';

import { ChevronDown, UserCheck, UserPlus, X } from 'lucide-react';
import { useWaiterDropdown } from '../hooks/useWaiterDropdown';

interface WaiterSelectorProps {
  isWaiter: boolean;
  waiters: Array<{ id: string; name: string }>;
  selectedWaiterId: string | null;
  waiterName: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectWaiter: (waiterId: string) => void;
  onRemoveWaiter: () => void;
}

export function WaiterSelector({
  isWaiter,
  waiters,
  selectedWaiterId,
  waiterName,
  isOpen,
  onOpenChange,
  onSelectWaiter,
  onRemoveWaiter,
}: WaiterSelectorProps) {
  const dropdownRef = useWaiterDropdown(isOpen, () => onOpenChange(false));

  if (isWaiter) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => onOpenChange(!isOpen)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
          selectedWaiterId
            ? 'bg-ok/15 text-ok border-ok/20 hover:bg-ok/25'
            : 'bg-surface text-dim border-line hover:border-line hover:text-brand'
        }`}
      >
        {selectedWaiterId ? (
          <>
            <UserCheck className="w-3 h-3" />
            <span>{waiterName ?? '...'}</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </>
        ) : (
          <>
            <UserPlus className="w-3 h-3" />
            <span>Asignar mesonero</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-surface border border-line rounded-lg shadow-lg min-w-[180px] py-1">
          {waiters.length === 0 ? (
            <p className="px-3 py-2 text-xs text-dim">Sin mesoneros activos</p>
          ) : (
            waiters.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => {
                  onSelectWaiter(w.id);
                  onOpenChange(false);
                }}
                className={`w-full text-left flex items-center gap-2 px-3 py-2 text-xs hover:bg-elevated transition-colors ${
                  selectedWaiterId === w.id
                    ? 'text-ok font-semibold bg-ok/15'
                    : 'text-dim'
                }`}
              >
                <UserCheck className="w-3 h-3 flex-shrink-0" />
                {w.name}
              </button>
            ))
          )}
          {selectedWaiterId && (
            <>
              <div className="border-t border-line my-1" />
              <button
                type="button"
                onClick={() => {
                  onRemoveWaiter();
                  onOpenChange(false);
                }}
                className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs text-danger hover:bg-danger/10 transition-colors"
              >
                <X className="w-3 h-3 flex-shrink-0" />
                Quitar mesonero
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
