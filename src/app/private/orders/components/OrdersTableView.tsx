'use client';
import React from 'react';
import { FiEye, FiMapPin, FiShield } from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { Order } from '@/modelTypes/order';
import { Table as TableModel } from '@/modelTypes/table';
import { PaymentStatusEnum, OrderStatusEnum } from '@/shared';
import Table from '@/components/shared/Table';
import { Button } from '@/components/shared/button/Button';
import { Badge } from '@/components/shared/badge/badge';
import { formatCurrency } from '@/shared/utils/currencyHelpers';
import { getDisplayOrderNumber } from '@/shared/utils/orderNumber';
import { formatDate } from '@/shared/utils/dateHelpers';
import {
  getStatusColor,
  getStatusLabel,
  getPaymentStatusColor,
  getPaymentStatusLabel,
  getPaymentMethodLabel,
} from './OrderStatusHelpers';

interface OrdersTableViewProps {
  data: Order[];
  pageSize: number;
  tables: TableModel[];
  receivableByOrderId: Map<string, { amount: number; paidAmount: number }>;
  waiters: Array<{ id: string; name: string }>;
  savingWaiterId: string | null;
  onAssignWaiter: (orderId: string, waiterId: string | null) => void;
  onOrderClick: (order: Order) => void;
  onRowMouseEnter: (
    e: React.MouseEvent<HTMLTableRowElement>,
    order: Order,
  ) => void;
  onRowMouseLeave: () => void;
}

export const OrdersTableView: React.FC<OrdersTableViewProps> = ({
  data,
  pageSize,
  tables,
  receivableByOrderId,
  waiters,
  savingWaiterId,
  onAssignWaiter,
  onOrderClick,
  onRowMouseEnter,
  onRowMouseLeave,
}) => {
  const router = useRouter();

  const getTableName = (tableId: string): string => {
    const table = tables.find((t) => t.id === tableId);
    return table ? `Mesa ${table.number}` : tableId;
  };

  const columns: ColumnDef<Order>[] = [
    {
      accessorKey: 'id',
      header: 'Orden',
      cell: ({ row }) => {
        const o = row.original;
        const location = o.tableId
          ? getTableName(o.tableId)
          : o.orderType === 'takeaway'
            ? 'Para Llevar'
            : 'Delivery';
        return (
          <div>
            <div className="font-mono font-semibold text-content text-sm">
              {getDisplayOrderNumber(o)}
            </div>
            <div className="text-xs text-dim flex items-center gap-1">
              {o.tableId && <FiMapPin className="w-3 h-3" />}
              {location} · {o.items.length}{' '}
              {o.items.length === 1 ? 'item' : 'items'}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Estado',
      cell: ({ row }) => {
        const o = row.original;
        const payStatus = o.paymentStatus || PaymentStatusEnum.PENDING;
        return (
          <div className="flex flex-col gap-1">
            <Badge className={getStatusColor(o.status)}>
              {getStatusLabel(o.status)}
            </Badge>
            {o.status !== OrderStatusEnum.CANCELLED &&
              payStatus !== PaymentStatusEnum.PAID && (
                <Badge className={getPaymentStatusColor(payStatus)}>
                  {getPaymentStatusLabel(payStatus)}
                </Badge>
              )}
          </div>
        );
      },
    },
    {
      accessorKey: 'paymentMethod',
      header: 'Metodo',
      cell: ({ row }) => (
        <span className="text-xs">
          {getPaymentMethodLabel(row.original.paymentMethod)}
        </span>
      ),
    },
    {
      accessorKey: 'total',
      header: 'Monto',
      cell: ({ row }) => {
        const ar = receivableByOrderId.get(row.original.id);
        const pendiente = ar ? ar.amount - ar.paidAmount : 0;
        const cobrado = ar
          ? row.original.total - pendiente
          : row.original.total;
        return (
          <div>
            <span className="font-medium text-ok">
              {formatCurrency(Math.max(cobrado, 0))}
            </span>
            {pendiente > 0.01 && (
              <div className="text-[11px] text-accent">
                Credito: {formatCurrency(pendiente)}
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: 'waiter',
      header: 'Mesonero',
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <select
            value={row.original.waiterId ?? ''}
            onChange={(e) => {
              onAssignWaiter(row.original.id, e.target.value || null);
            }}
            disabled={savingWaiterId === row.original.id}
            className="text-xs border border-line rounded px-1.5 py-1 bg-surface text-dim focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-50 w-full max-w-[140px]"
          >
            <option value="">— Sin asignar —</option>
            {waiters.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Fecha',
      cell: ({ row }) => (
        <div>
          <div className="text-content">
            {formatDate(row.original.createdAt, {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })}
          </div>
          <div className="text-xs text-dim">
            {new Date(row.original.createdAt).toLocaleTimeString('es-ES', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOrderClick(row.original)}
            className="flex items-center gap-1"
          >
            <FiEye className="w-3 h-3" /> Ver
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/private/orders/${row.original.id}/details`);
            }}
            className="flex items-center gap-1 border-line text-dim hover:bg-elevated"
            title="Ver auditoría de impresión"
          >
            <FiShield className="w-3 h-3" /> Audit
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="hidden lg:block bg-surface rounded-xl shadow-sm border border-line overflow-hidden">
      <Table<Order>
        data={data}
        columns={columns}
        pageSize={pageSize}
        headerStyles="bg-elevated"
        rowStyles="px-4 py-3 text-sm text-dim whitespace-nowrap"
        onRowMouseEnter={onRowMouseEnter}
        onRowMouseLeave={onRowMouseLeave}
      />
    </div>
  );
};
