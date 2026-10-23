import Modal from '@/components/shared/modal';
import { Order } from '@/modelTypes/order';
import { ZONAS_VISIBLES, ZoneSectorEnum } from '@/shared';
import { Table } from '@/modelTypes/table';
import {
  ArrowRightLeft,
  Utensils,
  Package,
  MapPin,
  UserCheck,
  X,
} from 'lucide-react';
import { SECTOR_LABELS } from '../utils';
import { getTableStatus } from '../utils';

interface ModalDeTraspaloProps {
  isOpen: boolean;
  origen: 'mesa' | 'zona';
  transferOrder: Order | null;
  transferSourceTable: (Table & { currentOrder?: Order | null }) | null;
  transferZoneOrder: Order | null;
  tables: Array<Table & { currentOrder?: Order | null }>;
  zoneOrders: Order[];
  waiters: Array<{ id: string; name?: string }>;
  allUsers: Array<{ id: string; name?: string }>;
  isTransferring: boolean;
  onClose: () => void;
  onTransferToTable: (
    table: Table & { currentOrder?: Order | null },
  ) => Promise<void>;
  onTransferToSector: (sector: ZoneSectorEnum) => Promise<void>;
  onMergeWithTableOrder: (
    table: Table & { currentOrder?: Order | null },
  ) => void;
  onMergeWithZoneOrder: (order: Order) => void;
  onZoneTransferWaiter?: (waiterId: string) => Promise<void>;
}

export default function ModalDeTraspaso({
  isOpen,
  origen,
  transferOrder,
  transferSourceTable,
  transferZoneOrder,
  tables,
  zoneOrders,
  waiters,
  allUsers,
  isTransferring,
  onClose,
  onTransferToTable,
  onTransferToSector,
  onMergeWithTableOrder,
  onMergeWithZoneOrder,
  onZoneTransferWaiter,
}: ModalDeTraspaloProps) {
  if (!isOpen) return null;

  const sourceOrder = origen === 'mesa' ? transferOrder : transferZoneOrder;
  const sourceTable = origen === 'mesa' ? transferSourceTable : null;

  const availableTables =
    origen === 'mesa'
      ? tables.filter(
          (t) => t.id !== sourceTable?.id && getTableStatus(t) === 'free',
        )
      : tables.filter((t) => getTableStatus(t) === 'free');

  const occupiedTables =
    origen === 'mesa'
      ? tables.filter(
          (t) =>
            t.id !== sourceTable?.id &&
            getTableStatus(t) === 'occupied' &&
            t.currentOrder,
        )
      : tables.filter(
          (t) =>
            getTableStatus(t) === 'occupied' &&
            t.currentOrder &&
            t.currentOrder.id !== sourceOrder?.id,
        );

  const otherZoneOrders =
    origen === 'mesa'
      ? zoneOrders.filter((o) => o.id !== sourceOrder?.id)
      : zoneOrders.filter((o) => o.id !== sourceOrder?.id);

  return (
    <Modal
      isOpen
      estiloPropio
      onClose={onClose}
      classNameFondo="bg-black/50 backdrop-blur-sm"
      classNameWrap="p-4"
      className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-line">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="w-5 h-5 text-brand" />
          <div>
            <h2 className="text-base font-bold text-content">
              {origen === 'mesa'
                ? 'Traspasar Orden'
                : 'Traspasar Orden de Zona'}
            </h2>
            <p className="text-xs text-dim">
              {origen === 'mesa'
                ? `Mesa ${sourceTable?.number} → destino`
                : `${
                    SECTOR_LABELS[
                      (sourceOrder?.sector ?? '') as ZoneSectorEnum
                    ] ?? 'Zona'
                  } → destino`}
              <span className="ml-1 font-medium text-brand">
                #{sourceOrder?.id.slice(-6).toUpperCase()}
              </span>
              {sourceOrder?.customerAlias && (
                <span className="ml-1 text-dim">
                  • {sourceOrder.customerAlias}
                </span>
              )}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-dim hover:text-dim hover:bg-elevated transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Mesas disponibles */}
        <div>
          <h3 className="text-xs font-semibold text-dim uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Utensils className="w-3.5 h-3.5" />
            {origen === 'mesa' ? 'Mesas disponibles' : 'Mover a mesa'}
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {availableTables.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => void onTransferToTable(t)}
                disabled={isTransferring}
                className="flex flex-col items-center gap-1 p-3 bg-ok/10 hover:bg-ok/15 border border-ok/30 hover:border-ok/50 rounded-xl transition-all disabled:opacity-50"
              >
                <Utensils className="w-5 h-5 text-ok" />
                <span className="text-sm font-bold text-content">
                  Mesa {t.number}
                </span>
                <span className="text-[10px] text-ok">Cap. {t.capacity}</span>
              </button>
            ))}
            {availableTables.length === 0 && (
              <p className="col-span-3 text-sm text-dim text-center py-2">
                No hay mesas disponibles
              </p>
            )}
          </div>
        </div>

        {/* Fusionar con mesa ocupada */}
        {occupiedTables.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-dim uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" />
              {origen === 'mesa'
                ? 'Fusionar con mesa ocupada'
                : 'Fusionar con mesa ocupada'}
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {occupiedTables.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => void onMergeWithTableOrder(t)}
                  disabled={isTransferring}
                  className="flex flex-col items-center gap-1 p-3 bg-brand/10 hover:bg-brand/15 border border-brand/30 hover:border-brand/50 rounded-xl transition-all disabled:opacity-50"
                >
                  <Package className="w-5 h-5 text-brand" />
                  <span className="text-sm font-bold text-content">
                    Mesa {t.number}
                  </span>
                  <span className="text-[10px] text-brand">
                    ${(t.currentOrder?.total || 0).toFixed(2)}
                  </span>
                  {t.currentOrder?.customerName && (
                    <span className="text-[10px] text-content truncate max-w-full">
                      {t.currentOrder.customerName}
                    </span>
                  )}
                  {t.currentOrder?.waiterName && (
                    <span className="text-[10px] text-dim truncate max-w-full">
                      {t.currentOrder.waiterName}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Fusionar con orden de zona / otra orden */}
        {otherZoneOrders.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-dim uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" />
              {origen === 'mesa'
                ? 'Fusionar con orden de zona'
                : 'Fusionar con otra orden'}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {otherZoneOrders.slice(0, 10).map((o) => {
                const staffId = o.waiterId || o.userId;
                const waiter = allUsers.find((u) => u.id === staffId);
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => void onMergeWithZoneOrder(o)}
                    disabled={isTransferring}
                    className="flex items-center gap-2 p-3 bg-brand/10 hover:bg-brand/15 border border-brand/30 hover:border-brand/50 rounded-xl transition-all disabled:opacity-50 text-left"
                  >
                    <Package className="w-4 h-4 text-brand flex-shrink-0" />
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-content block truncate">
                        #{o.id.slice(-6).toUpperCase()}{' '}
                        {o.customerAlias && `• ${o.customerAlias}`}
                      </span>
                      {o.customerName && (
                        <span className="text-[10px] text-content block truncate">
                          {o.customerName}
                        </span>
                      )}
                      <span className="text-[10px] text-brand">
                        {waiter?.name || 'Sin mesonero'} • $
                        {(o.total || 0).toFixed(2)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Ambientes / Zonas */}
        <div>
          <h3 className="text-xs font-semibold text-dim uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            {origen === 'mesa' ? 'Traspasar a ambiente' : 'Mover a otra zona'}
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(SECTOR_LABELS)
              .filter(
                ([sector]) =>
                  ZONAS_VISIBLES.includes(sector as ZoneSectorEnum) &&
                  (origen === 'mesa' || sector !== sourceOrder?.sector),
              )
              .map(([sector, label]) => (
                <button
                  key={sector}
                  type="button"
                  onClick={() =>
                    void onTransferToSector(sector as ZoneSectorEnum)
                  }
                  disabled={isTransferring}
                  className="flex items-center gap-2 p-3 bg-brand/10 hover:bg-brand/15 border border-brand/30 hover:border-brand/50 rounded-xl transition-all disabled:opacity-50 text-left"
                >
                  <MapPin className="w-4 h-4 text-brand flex-shrink-0" />
                  <span className="text-sm font-medium text-content">
                    {label}
                  </span>
                </button>
              ))}
          </div>
        </div>

        {/* Cambiar mesonero (solo para zona) */}
        {origen === 'zona' && onZoneTransferWaiter && (
          <div>
            <h3 className="text-xs font-semibold text-dim uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5" />
              Cambiar mesonero
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {waiters
                .filter((w) => w.id !== sourceOrder?.waiterId)
                .map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => void onZoneTransferWaiter(w.id)}
                    disabled={isTransferring}
                    className="flex items-center gap-2 p-3 bg-accent/10 hover:bg-accent/15 border border-accent/30 hover:border-accent/50 rounded-xl transition-all disabled:opacity-50 text-left"
                  >
                    <UserCheck className="w-4 h-4 text-accent flex-shrink-0" />
                    <span className="text-sm font-medium text-content">
                      {w.name}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>

      {isTransferring && (
        <div className="p-3 border-t border-line flex items-center justify-center gap-2 text-sm text-dim">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-brand"></div>
          Traspasando...
        </div>
      )}
    </Modal>
  );
}
