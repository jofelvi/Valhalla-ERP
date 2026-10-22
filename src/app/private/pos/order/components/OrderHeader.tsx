'use client';

import { ChevronLeft, Search } from 'lucide-react';
import { Input } from '@/components/shared/input/input';
import { InfoChips } from './InfoChips';
import { WaiterSelector } from './WaiterSelector';
import { Order } from '@/modelTypes/order';

interface OrderHeaderProps {
  isWaiter: boolean;
  sectorParam: string | null;
  tableId: string | null;
  tableName: string | null;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  waiters: Array<{ id: string; name: string }>;
  selectedWaiterId: string | null;
  waiterName: string | null;
  waiterDropdownOpen: boolean;
  onWaiterDropdownChange: (open: boolean) => void;
  onSelectWaiter: (waiterId: string) => void;
  onRemoveWaiter: () => void;
  existingOrder: Order | null;
  onMergeClick?: () => void;
}

export function OrderHeader({
  isWaiter,
  sectorParam,
  tableId,
  tableName,
  searchTerm,
  onSearchChange,
  waiters,
  selectedWaiterId,
  waiterName,
  waiterDropdownOpen,
  onWaiterDropdownChange,
  onSelectWaiter,
  onRemoveWaiter,
  existingOrder,
  onMergeClick,
}: OrderHeaderProps) {
  return (
    <div className="bg-surface shadow-sm border-b border-line">
      <div className="px-3 py-2 sm:px-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          {/* Lado izquierdo: Volver + Info */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* <a> nativo en vez de router.push para garantizar navegación
                aunque el soft-routing del App Router quede trabado. */}
            <a
              href={
                isWaiter
                  ? sectorParam
                    ? '/private/waiter/zonas'
                    : '/private/waiter'
                  : '/private/pos'
              }
              className="flex items-center gap-1.5 text-dim hover:text-content border border-line h-9 px-3 rounded-xl text-sm font-medium no-underline"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>{sectorParam ? 'Zonas' : 'Mesas'}</span>
            </a>

            <InfoChips
              tableId={tableId}
              tableName={tableName}
              sectorParam={sectorParam}
              existingOrder={existingOrder}
              onMergeClick={onMergeClick}
            />

            <WaiterSelector
              isWaiter={isWaiter}
              waiters={waiters}
              selectedWaiterId={selectedWaiterId}
              waiterName={waiterName}
              isOpen={waiterDropdownOpen}
              onOpenChange={onWaiterDropdownChange}
              onSelectWaiter={onSelectWaiter}
              onRemoveWaiter={onRemoveWaiter}
            />
          </div>

          {/* Centro: Buscador */}
          <div className="flex-1 flex sm:justify-center">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-dim w-4 h-4" />
              <Input
                type="text"
                placeholder="Buscar productos..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 pr-4 h-9 text-sm border-line focus:border-brand focus:ring-brand/20 bg-elevated focus:bg-surface rounded-lg w-full"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-dim hover:text-dim"
                >
                  <span className="text-xs">✕</span>
                </button>
              )}
            </div>
          </div>

          {/* Lado derecho: espacio para balance visual */}
          <div className="min-w-fit w-[40px]"></div>
        </div>
      </div>
    </div>
  );
}
