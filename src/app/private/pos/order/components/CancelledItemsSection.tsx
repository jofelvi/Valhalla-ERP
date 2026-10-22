'use client';

import { ChevronLeft } from 'lucide-react';
import { Order } from '@/modelTypes/order';

interface CancelledItemsSectionProps {
  existingOrder: Order | null;
}

export function CancelledItemsSection({
  existingOrder,
}: CancelledItemsSectionProps) {
  if (
    !existingOrder?.cancelledItems ||
    existingOrder.cancelledItems.length === 0
  ) {
    return null;
  }

  return (
    <details className="border-t border-line group">
      <summary className="px-3 py-2 flex items-center justify-between cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
        <span className="text-[11px] font-semibold text-danger">
          Productos cancelados ({existingOrder.cancelledItems.length})
        </span>
        <ChevronLeft className="w-3.5 h-3.5 text-dim -rotate-90 group-open:rotate-90 transition-transform" />
      </summary>
      <ul className="px-3 pb-2 space-y-1">
        {existingOrder.cancelledItems.map((ci, i) => (
          <li key={i} className="text-[11px] leading-snug text-dim">
            <span className="line-through">
              {ci.qty}× {ci.name}
            </span>{' '}
            <span className="text-danger">
              — {ci.reason ?? 'sin motivo'}
              {ci.authorizedByName ? ` · autorizó ${ci.authorizedByName}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
