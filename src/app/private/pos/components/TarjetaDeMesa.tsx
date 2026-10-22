import { UserRoleEnum } from '@/shared';
import { Table } from '@/modelTypes/table';
import {
  Users,
  Coffee,
  Utensils,
  ChefHat,
  UserCheck,
  Pencil,
  Clock,
  Package,
  ShieldCheck,
  ArrowRightLeft,
  Eraser,
  AlertCircle,
} from 'lucide-react';
import { Card } from '@/components/shared/card/card';
import { Order } from '@/modelTypes/order';
import { User } from '@/modelTypes/user';
import {
  getTableStatus,
  getOrderStatusColor,
  getOrderStatusText,
} from '../utils';
import { formatSmartTime } from '@/shared/utils/dateHelpers';
import { getDisplayOrderNumber } from '@/shared/utils/orderNumber';
import { lineTotal, packCountLabel } from '@/shared/utils/packs';
import { useRouter } from 'next/navigation';
import { formatearUsd } from '@/shared/utils/dinero';

interface TarjetaDeMesaProps {
  table: Table & { currentOrder?: Order | null };
  allUsers: User[];
  onTransfer: () => void;
  onReset?: () => void;
  onAliasEdit: (order: Order) => void;
  currentUserRole?: string;
  /**
   * Click sobre la tarjeta. Lo decide el padre a proposito: si la mesa esta
   * libre hay que RECLAMARLA primero (`claimTable`, que es race-safe contra
   * dos mesoneros a la vez) y eso vive en `pos/page.tsx`, no aca.
   */
  onClick: () => void;
}

const getTableIcon = (capacity: number) => {
  if (capacity <= 2) return Users;
  if (capacity <= 4) return Coffee;
  if (capacity <= 6) return Utensils;
  return ChefHat;
};

export default function TarjetaDeMesa({
  table,
  allUsers,
  onTransfer,
  onReset,
  onAliasEdit,
  currentUserRole,
  onClick,
}: TarjetaDeMesaProps) {
  const router = useRouter();
  const tableStatus = getTableStatus(
    table as Parameters<typeof getTableStatus>[0],
  );
  const isOccupied = tableStatus === 'occupied';
  const order = table.currentOrder;
  const staffId = order?.waiterId || order?.userId;
  const staff = staffId ? allUsers.find((u) => u.id === staffId) : null;
  const alias = order?.customerAlias;
  const itemCount =
    order?.items?.reduce((sum, i) => sum + (i.quantity || 0), 0) ?? 0;

  const TableIcon = getTableIcon(table.capacity);

  return (
    <div className="relative group">
      <Card
        className={`cursor-pointer transition-all duration-200 overflow-hidden border-2 ${
          isOccupied
            ? 'bg-surface border-danger/20 hover:border-danger/50 hover:shadow-xl hover:shadow-danger/10'
            : 'bg-surface border-brand/20 hover:border-brand/50 hover:shadow-xl hover:shadow-brand/10'
        } hover:-translate-y-0.5`}
        onClick={onClick}
      >
        {/* Header con gradiente */}
        <div
          className={`relative px-3 py-2.5 ${
            isOccupied
              ? 'bg-gradient-to-r from-danger/10 via-danger/10 to-danger/10'
              : 'bg-gradient-to-r from-brand/5 via-brand/5 to-brand/5'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${
                  isOccupied
                    ? 'bg-gradient-to-br from-danger to-danger'
                    : 'bg-gradient-to-br from-brand to-brand-light'
                }`}
              >
                <TableIcon className="w-5 h-5 text-on-brand" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-content leading-tight whitespace-nowrap truncate">
                  Mesa {table.number}
                </h3>
                <div className="flex items-center gap-1 mt-0.5">
                  <Users className="w-2.5 h-2.5 text-dim" />
                  <span className="text-[10px] text-dim font-medium">
                    Cap. {table.capacity}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-3 py-2 space-y-1.5">
          {!isOccupied ? (
            <div className="flex items-center justify-center py-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand/10 text-brand rounded-full text-[11px] font-semibold">
                <span className="w-1.5 h-1.5 bg-brand rounded-full animate-pulse"></span>
                Disponible
              </span>
            </div>
          ) : order ? (
            <>
              {/* Total + status */}
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-content">
                  {formatearUsd(order.total)}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wide ${getOrderStatusColor(order.status)}`}
                >
                  {getOrderStatusText(order.status)}
                </span>
              </div>

              {/* Mesonero */}
              {staff && (
                <div className="flex items-center gap-1 text-[11px] text-brand">
                  <UserCheck className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate font-semibold">{staff.name}</span>
                </div>
              )}

              {/* Alias */}
              <div className="flex items-center gap-1 text-[11px]">
                {alias ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAliasEdit(order);
                    }}
                    className="flex items-center gap-1 text-brand hover:text-brand transition-colors min-w-0"
                    title="Editar alias"
                  >
                    <Users className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate font-medium">{alias}</span>
                    <Pencil className="w-2.5 h-2.5 flex-shrink-0 opacity-60" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAliasEdit(order);
                    }}
                    className="flex items-center gap-1 text-dim hover:text-brand transition-colors"
                    title="Agregar alias"
                  >
                    <Users className="w-3 h-3 flex-shrink-0" />
                    <span className="italic">+ alias</span>
                  </button>
                )}
              </div>

              {/* Items + tiempo */}
              <div className="flex items-center justify-between pt-1 border-t border-danger/20">
                <span className="flex items-center gap-1 text-[10px] text-dim">
                  <Package className="w-2.5 h-2.5" />
                  <span className="font-medium">
                    {itemCount} {itemCount === 1 ? 'item' : 'items'}
                  </span>
                </span>
                <span className="flex items-center gap-0.5 text-[10px] text-dim">
                  <Clock className="w-2.5 h-2.5" />
                  {formatSmartTime(order.createdAt)}
                </span>
              </div>

              {/* Acciones: en el pie, no en la cabecera, para no tapar el nombre */}
              <div className="flex items-center justify-end gap-1 pt-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (order) {
                      router.push(`/private/orders/${order.id}/details`);
                    }
                  }}
                  className="w-7 h-7 bg-surface/80 backdrop-blur-sm group/btn hover:bg-brand border border-line rounded-full flex items-center justify-center transition-all shadow-sm"
                  title="Ver auditoría de impresión"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-brand group-hover/btn:text-on-brand" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTransfer();
                  }}
                  className="w-7 h-7 bg-surface/80 backdrop-blur-sm group/btn hover:bg-brand border border-brand/20 rounded-full flex items-center justify-center transition-all shadow-sm"
                  title="Traspasar orden"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 text-brand group-hover/btn:text-on-brand" />
                </button>
                {currentUserRole === UserRoleEnum.ADMIN && onReset && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onReset();
                    }}
                    className="w-7 h-7 bg-surface/80 backdrop-blur-sm group/btn hover:bg-danger border border-danger/20 rounded-full flex items-center justify-center transition-all shadow-sm"
                    title="Resetear mesa (borrar orden con PIN admin)"
                  >
                    <Eraser className="w-3.5 h-3.5 text-danger group-hover/btn:text-on-brand" />
                  </button>
                )}
              </div>

              {/* Indicador de pago rechazado */}
              {order.paymentRejected && (
                <div className="mt-1 px-2 py-1 bg-danger/10 border border-danger/30 rounded-md">
                  <div className="flex items-start gap-1">
                    <AlertCircle className="w-3 h-3 text-danger flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-danger leading-tight">
                        Pago rechazado
                      </p>
                      {order.paymentRejectionReason && (
                        <p className="text-[9px] text-danger/70 leading-tight truncate">
                          {order.paymentRejectionReason}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center py-2">
              <span className="text-[11px] font-semibold text-danger">
                Ocupada, sin orden
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* Hover preview con productos (solo desktop, mesa ocupada) */}
      {isOccupied && order && order.items && order.items.length > 0 && (
        <div className="hidden md:block absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none">
          <div className="bg-surface rounded-xl shadow-2xl border border-line overflow-hidden">
            <div className="px-3 py-2 bg-elevated border-b border-line">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono text-content">
                  Mesa {table.number} · {getDisplayOrderNumber(order)}
                </span>
                <span className="text-xs font-bold text-brand">
                  {formatearUsd(order.total)}
                </span>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {order.items.map((item, idx) => (
                <div
                  key={`${item.productId}-${idx}`}
                  className="flex items-start justify-between gap-2 px-3 py-2 border-b border-line last:border-b-0 text-xs"
                >
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <span className="font-bold text-brand flex-shrink-0">
                      {packCountLabel(
                        item.quantity,
                        item.productId,
                        item.presentationQty,
                      )}
                      ×
                    </span>
                    <span className="text-dim truncate">{item.name}</span>
                  </div>
                  <span className="text-dim font-medium flex-shrink-0">
                    {formatearUsd(
                      lineTotal(
                        item.unitPrice,
                        item.quantity,
                        item.productId,
                        item.presentationQty,
                      ),
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
