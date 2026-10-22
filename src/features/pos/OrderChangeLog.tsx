'use client';

import { useState } from 'react';
import { History, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { useOrderItemEvents } from '@/hooks/useOrders';
import {
  OrderItemEvent,
  OrderItemEventType,
} from '@/modelTypes/orderItemEvent';

const EVENT_LABELS: Record<OrderItemEventType, string> = {
  ITEM_ADDED: 'Agregado',
  ITEM_SENT_TO_STATION: 'Enviado a estación',
  ITEM_DELIVERED: 'Entregado',
  ITEM_CANCELLED: 'Eliminado',
  ITEM_NO_CHARGE: 'Cortesía (no cobrar)',
  ITEM_BILLED: 'Facturado',
  CASHIER_OVERRIDE_UNDELIVERED: 'Cobrado sin entregar',
};

const formatEventDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short' })} ${d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}`;
};

const actorLabel = (event: OrderItemEvent): string => {
  const name = event.actorName || event.actorId;
  return event.actorRole ? `${name} (${event.actorRole})` : name;
};

interface OrderChangeLogProps {
  orderId: string;
}

// Historial de auditoría de la orden (colección orderItemEvents, append-only,
// generado por el backend). Destaca eliminaciones/reducciones de productos.
export default function OrderChangeLog({ orderId }: OrderChangeLogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: events = [] } = useOrderItemEvents(orderId);

  if (events.length === 0) return null;

  const deletions = events.filter((e) => e.eventType === 'ITEM_CANCELLED');
  const sorted = [...events].sort(
    (a, b) =>
      new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );

  return (
    <div className="border-t border-line px-3 py-2">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-1.5"
      >
        <span className="flex items-center gap-1.5">
          <History className="w-3.5 h-3.5 text-dim" />
          <span className="text-[11px] font-semibold text-dim">
            Historial de cambios ({events.length})
          </span>
          {deletions.length > 0 && (
            <span className="flex items-center gap-0.5 text-[11px] font-semibold text-danger">
              <Trash2 className="w-3 h-3" />
              {deletions.length}
            </span>
          )}
        </span>
        {isOpen ? (
          <ChevronUp className="w-3.5 h-3.5 text-dim" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-dim" />
        )}
      </button>

      {isOpen && (
        <ul className="mt-2 max-h-40 overflow-y-auto space-y-1.5">
          {sorted.map((event) => {
            const isDeletion = event.eventType === 'ITEM_CANCELLED';
            return (
              <li
                key={event._id}
                className={`text-[11px] leading-snug rounded-md px-2 py-1.5 border ${
                  isDeletion
                    ? 'bg-danger/10 border-danger/30 text-danger'
                    : 'bg-surface border-line text-dim'
                }`}
              >
                <span className="font-semibold">
                  {EVENT_LABELS[event.eventType] ?? event.eventType}
                </span>{' '}
                — {event.qty}× {event.productName || event.productId}
                {event.reason && (
                  <span className="block opacity-80">{event.reason}</span>
                )}
                <span className="block opacity-70">
                  {formatEventDate(event.occurredAt)} · {actorLabel(event)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
