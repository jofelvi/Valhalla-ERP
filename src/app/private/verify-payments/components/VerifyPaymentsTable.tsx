import { ImageOff, ExternalLink } from 'lucide-react';
import { Order, PendingPaymentEntry, PendingPaymentOcr } from '@odin6/types';
import { VerifyPaymentsBankBotBadge } from './VerifyPaymentsBankBotBadge';
import { VerifyPaymentsOcrBadge } from './VerifyPaymentsOcrBadge';
import {
  getMethodLabel,
  shortOrderId,
  hasFraudSuspect,
  hasOcrMismatch,
} from '../utils/verifyPaymentsUtils';

interface VerifyPaymentsTableProps {
  isLoading: boolean;
  filteredOrders: Order[];
  pendingOrders: Order[];
  allUsers: Array<{ id: string; name: string }>;
  selectedIds: Set<string>;
  onToggleSelectAll: () => void;
  onToggleOne: (id: string) => void;
  isAllFilteredSelected: boolean;
  onOpenImageModal: (url: string) => void;
  onSetOcrDetailOpen: (ocr: PendingPaymentOcr | null) => void;
  onGoToDetail: (orderId: string) => void;
}

export const VerifyPaymentsTable = ({
  isLoading,
  filteredOrders,
  pendingOrders,
  allUsers,
  selectedIds,
  onToggleSelectAll,
  onToggleOne,
  isAllFilteredSelected,
  onOpenImageModal,
  onSetOcrDetailOpen,
  onGoToDetail,
}: VerifyPaymentsTableProps) => {
  if (isLoading) {
    return <div className="p-8 text-center text-dim">Cargando...</div>;
  }

  if (filteredOrders.length === 0) {
    return (
      <div className="p-12 text-center text-dim bg-surface/40 border border-line rounded-lg">
        {pendingOrders.length === 0
          ? 'No hay pagos por verificar.'
          : 'Ningun pago coincide con los filtros.'}
      </div>
    );
  }

  return (
    <div className="bg-surface border border-line rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-elevated border-b border-line text-dim text-xs uppercase tracking-wide">
            <tr>
              <th className="p-3 text-left w-10">
                <input
                  type="checkbox"
                  checked={isAllFilteredSelected}
                  onChange={onToggleSelectAll}
                  className="w-4 h-4 cursor-pointer accent-accent"
                />
              </th>
              <th className="p-3 text-left">Orden / Mesa</th>
              <th className="p-3 text-left">Mesonero</th>
              <th className="p-3 text-left">Pagos</th>
              <th className="p-3 text-left">Comprobantes</th>
              <th className="p-3 text-right">Total</th>
              <th className="p-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((order) => (
              <VerifyPaymentsTableRow
                key={order.id}
                order={order}
                allUsers={allUsers}
                isSelected={selectedIds.has(order.id)}
                onToggle={() => onToggleOne(order.id)}
                onOpenImageModal={onOpenImageModal}
                onSetOcrDetailOpen={onSetOcrDetailOpen}
                onGoToDetail={onGoToDetail}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

interface VerifyPaymentsTableRowProps {
  order: Order;
  allUsers: Array<{ id: string; name: string }>;
  isSelected: boolean;
  onToggle: () => void;
  onOpenImageModal: (url: string) => void;
  onSetOcrDetailOpen: (ocr: PendingPaymentOcr | null) => void;
  onGoToDetail: (orderId: string) => void;
}

const VerifyPaymentsTableRow = ({
  order,
  allUsers,
  isSelected,
  onToggle,
  onOpenImageModal,
  onSetOcrDetailOpen,
  onGoToDetail,
}: VerifyPaymentsTableRowProps) => {
  const waiter = allUsers.find((w) => w.id === order.waiterId);
  const payments: PendingPaymentEntry[] =
    order.pendingPayments && order.pendingPayments.length > 0
      ? order.pendingPayments
      : order.paymentMethod
        ? [
            {
              method: order.paymentMethod,
              amount: order.total,
              amountBs: (order.paymentAmountBs ?? 0) || 0,
              reference: order.paymentReference,
              pagoMovilPhone: order.pagoMovilPhone,
              pagoMovilCedula: order.pagoMovilCedula,
              pagoMovilBanco: order.pagoMovilBanco,
              proofUrls: order.paymentProofUrls,
            },
          ]
        : [];

  const allProofs = Array.from(
    new Set(
      [
        ...(order.paymentProofUrls ?? []),
        ...(order.pendingPayments?.flatMap((p) => p.proofUrls ?? []) ?? []),
      ].filter(Boolean),
    ),
  ) as string[];

  const fraud = hasFraudSuspect(order);
  const mismatch = !fraud && hasOcrMismatch(order);

  return (
    <tr
      className={`border-b border-line transition-colors ${
        fraud
          ? 'bg-danger/10 border-danger/30 hover:bg-danger/15'
          : mismatch
            ? 'bg-warn/5 hover:bg-warn/10'
            : isSelected
              ? 'bg-accent/5'
              : 'hover:bg-elevated/40'
      }`}
    >
      <td className="p-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggle}
          className="w-4 h-4 cursor-pointer accent-accent"
        />
      </td>
      <td className="p-3 align-top">
        <div className="font-mono font-bold text-content">
          {shortOrderId(order)}
        </div>
        {order.tableName && (
          <div className="text-xs text-dim">{order.tableName}</div>
        )}
        {order.customerAlias && (
          <div className="text-xs text-dim italic">{order.customerAlias}</div>
        )}
        {order.sector && (
          <div className="text-[10px] text-dim mt-0.5 capitalize">
            {order.sector.replace(/_/g, ' ')}
          </div>
        )}
      </td>
      <td className="p-3 align-top">
        <div className="text-content">{waiter?.name ?? '—'}</div>
      </td>
      <td className="p-3 align-top">
        <div className="space-y-1">
          {payments.map((p, i) => (
            <div key={i} className="text-xs">
              <span className="inline-flex px-2 py-0.5 bg-elevated text-content rounded font-medium">
                {getMethodLabel(p.method)}
              </span>
              {p.amountBs ? (
                <span className="ml-1.5 text-dim">
                  Bs. {p.amountBs.toFixed(2)}
                </span>
              ) : null}
              {p.reference && (
                <div className="text-[10px] text-dim mt-0.5">
                  Ref: {p.reference}
                </div>
              )}
              {p.pagoMovilPhone && (
                <div className="text-[10px] text-dim">
                  Tel: {p.pagoMovilPhone} · CI: {p.pagoMovilCedula}
                  {p.pagoMovilBanco && ` · ${p.pagoMovilBanco}`}
                </div>
              )}
              <VerifyPaymentsOcrBadge
                payment={p}
                onShowDetail={onSetOcrDetailOpen}
              />
            </div>
          ))}
          {payments.some((p) => p.method === 'PAGO_MOVIL') && (
            <VerifyPaymentsBankBotBadge orderId={order.id} />
          )}
        </div>
      </td>
      <td className="p-3 align-top">
        {allProofs.length === 0 ? (
          <ImageOff className="w-5 h-5 text-dim" />
        ) : (
          <div className="flex flex-wrap gap-1">
            {allProofs.slice(0, 3).map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={url}
                alt={`Comprobante ${i + 1}`}
                onClick={() => onOpenImageModal(url)}
                className="w-12 h-12 object-cover rounded border border-line cursor-pointer hover:border-accent transition"
              />
            ))}
            {allProofs.length > 3 && (
              <span className="px-1.5 py-0.5 text-[10px] text-dim">
                +{allProofs.length - 3}
              </span>
            )}
          </div>
        )}
      </td>
      <td className="p-3 align-top text-right">
        <div className="font-bold text-accent">${order.total.toFixed(2)}</div>
        {(order.tipAmount ?? 0) > 0 && (
          <div className="text-[10px] text-ok">
            +${(order.tipAmount ?? 0).toFixed(2)} prop
          </div>
        )}
        {order.bcvRate && (
          <div className="text-[10px] text-dim">
            {order.bcvRate.toFixed(2)} Bs/$
          </div>
        )}
      </td>
      <td className="p-3 align-top">
        <button
          type="button"
          onClick={() => onGoToDetail(order.id)}
          className="px-2 py-1 text-xs text-dim hover:text-content border border-line rounded inline-flex items-center gap-1"
          title="Abrir detalle (flujo manual con override)"
        >
          <ExternalLink className="w-3 h-3" />
          Detalle
        </button>
      </td>
    </tr>
  );
};
