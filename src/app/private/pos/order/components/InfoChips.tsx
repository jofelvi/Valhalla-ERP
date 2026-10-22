'use client';

import { MapPin, Merge } from 'lucide-react';
import { Order } from '@/modelTypes/order';
import { SECTOR_LABELS } from '../utils/constants';
import { getCreatedAtMs } from '../utils/helpers';

interface InfoChipsProps {
  tableId: string | null;
  tableName: string | null;
  sectorParam: string | null;
  existingOrder: Order | null;
  onMergeClick?: () => void;
}

export function InfoChips({
  tableId,
  tableName,
  sectorParam,
  existingOrder,
  onMergeClick,
}: InfoChipsProps) {
  return (
    <>
      {tableId && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-elevated text-dim rounded-lg text-xs font-medium border border-line">
          <span className="w-2 h-2 bg-brand rounded-full"></span>
          <span>{tableName ?? `Mesa ${tableId.slice(-4).toUpperCase()}`}</span>
        </div>
      )}

      {sectorParam && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-brand/10 text-brand rounded-lg text-xs font-medium border border-brand/20">
          <MapPin className="w-3 h-3" />
          <span>{SECTOR_LABELS[sectorParam] || sectorParam}</span>
        </div>
      )}

      {existingOrder?.id && (
        <button
          type="button"
          onClick={onMergeClick}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-line bg-surface text-dim hover:text-brand hover:border-brand/40 transition-colors"
          title="Traer otra orden a esta cuenta"
        >
          <Merge className="w-3 h-3" />
          <span>Fusionar</span>
        </button>
      )}

      {existingOrder && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-accent/15 text-accent rounded-lg text-xs font-medium border border-accent/20">
          <span className="w-2 h-2 bg-accent rounded-full"></span>
          <span>#{existingOrder.id.slice(-6).toUpperCase()}</span>
          {existingOrder.createdAt && (
            <span className="text-accent ml-1">
              ·{' '}
              {new Date(
                getCreatedAtMs(existingOrder.createdAt),
              ).toLocaleDateString('es-VE', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>
      )}
    </>
  );
}
