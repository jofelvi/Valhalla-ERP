'use client';
import { useMemo, useState } from 'react';
import Link from '@/shared/ui/AppLink/AppLink';
import { useBusqueda } from '@/shared/hooks/useBusqueda';
import { usePurchaseOrders } from '@/hooks/usePurchaseOrders';
import { useSuppliers } from '@/hooks/useSuppliers';
import { PurchaseOrder } from '@odin6/types';
import { PRIVATE_ROUTES, PurchaseOrderStatusEnum } from '@/shared';
import { Button } from '@/components/shared/button/Button';
import { Badge } from '@/components/shared/badge/badge';
import Loader from '@/components/shared/Loader/Loader';
import Table from '@/components/shared/Table';
import { ColumnDef } from '@tanstack/react-table';
import { formatDate } from '@/shared/utils/dateHelpers';
import { ClipboardList, Eye, Package, Plus, Truck } from 'lucide-react';
import { Panel } from '@/components/shared/panel/Panel';
import { CampoDeBusqueda } from '@/components/shared/busqueda/CampoDeBusqueda';
import { CabeceraDePantalla } from '@/components/shared/cabecera/CabeceraDePantalla';

const statusConfig: Record<
  string,
  {
    label: string;
    variant: 'success' | 'destructive' | 'warning' | 'info' | 'secondary';
  }
> = {
  [PurchaseOrderStatusEnum.PENDING]: { label: 'Pendiente', variant: 'warning' },
  [PurchaseOrderStatusEnum.APPROVED]: { label: 'Aprobada', variant: 'info' },
  [PurchaseOrderStatusEnum.RECEIVED]: { label: 'Recibida', variant: 'success' },
  [PurchaseOrderStatusEnum.PARTIALLY_RECEIVED]: {
    label: 'Parcial',
    variant: 'secondary',
  },
  [PurchaseOrderStatusEnum.CANCELED]: {
    label: 'Cancelada',
    variant: 'destructive',
  },
};

export default function PurchaseOrdersPage() {
  const { data: purchaseOrders = [], isLoading } = usePurchaseOrders();
  const { data: suppliers = [] } = useSuppliers();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const supplierMap = useMemo(() => {
    const map = new Map<string, string>();
    suppliers.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [suppliers]);

  const sortedPurchaseOrders = useMemo(() => {
    return [...purchaseOrders].sort(
      // createdAt es Date | null en el modelo; new Date(null) equivale a
      // new Date(0) en runtime, pero el overload de Date no acepta null.
      (a, b) =>
        new Date(b.createdAt ?? 0).getTime() -
        new Date(a.createdAt ?? 0).getTime(),
    );
  }, [purchaseOrders]);

  const searched = useBusqueda(sortedPurchaseOrders, searchQuery, [
    'id',
    (po) => supplierMap.get(po.supplierId),
  ]);

  const filtered = useMemo(() => {
    if (statusFilter !== 'ALL') {
      return searched.filter((po) => po.status === statusFilter);
    }
    return searched;
  }, [searched, statusFilter]);

  const pendingCount = purchaseOrders.filter(
    (po) => po.status === PurchaseOrderStatusEnum.PENDING,
  ).length;
  const totalAmount = filtered.reduce((s, po) => s + (po.totalAmount || 0), 0);

  const columns: ColumnDef<PurchaseOrder>[] = [
    {
      accessorKey: 'id',
      header: 'Orden',
      cell: ({ row }) => (
        <span className="font-mono font-semibold text-content text-sm">
          #{row.original.id.slice(-6).toUpperCase()}
        </span>
      ),
    },
    {
      accessorKey: 'supplierId',
      header: 'Proveedor',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Truck className="w-3.5 h-3.5 text-dim" />
          <span className="text-sm text-content">
            {supplierMap.get(row.original.supplierId) || '—'}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'totalAmount',
      header: 'Total',
      cell: ({ row }) => (
        <span className="font-semibold text-ok">
          ${(row.original.totalAmount || 0).toFixed(2)}
        </span>
      ),
    },
    {
      accessorKey: 'items',
      header: 'Items',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5 text-dim" />
          <span className="text-sm text-content">
            {row.original.items?.length || 0}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Estado',
      cell: ({ row }) => {
        const config = statusConfig[row.original.status] || {
          label: row.original.status,
          variant: 'secondary' as const,
        };
        return (
          <Badge variant={config.variant} className="text-[10px]">
            {config.label}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Fecha',
      cell: ({ row }) => (
        <span className="text-sm text-dim">
          {row.original.createdAt ? formatDate(row.original.createdAt) : '—'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Link href={PRIVATE_ROUTES.PURCHASE_ORDERS_DETAILS(row.original.id)}>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-dim hover:text-brand"
            >
              <Eye className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      ),
    },
  ];

  if (isLoading)
    return <Loader fullScreen text="Cargando ordenes de compra..." />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated">
      <div className="w-full px-3 sm:px-4 lg:px-6 xl:px-8 py-4">
        {/* Header */}
        <CabeceraDePantalla
          icono={<ClipboardList className="h-4 w-4 text-brand" />}
          titulo="Ordenes de Compra"
          subtitulo={
            <>
              {purchaseOrders.length} ordenes · {pendingCount} pendientes
            </>
          }
          acciones={
            <Link href={PRIVATE_ROUTES.PURCHASE_ORDERS_NEW}>
              <Button size="sm" className="h-8">
                <Plus className="w-3.5 h-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Nueva Orden</span>
              </Button>
            </Link>
          }
        />

        {/* Filtros */}
        <Panel className="p-3 mb-3">
          <div className="space-y-2.5">
            <CampoDeBusqueda
              valor={searchQuery}
              onCambio={setSearchQuery}
              placeholder="Buscar por ID o proveedor..."
            />

            <div className="flex gap-1 items-center overflow-x-auto pb-0.5 scrollbar-none">
              {[
                { value: 'ALL', label: 'Todas' },
                ...Object.entries(statusConfig).map(([k, v]) => ({
                  value: k,
                  label: v.label,
                })),
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setStatusFilter(value)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    statusFilter === value
                      ? 'bg-brand text-on-brand shadow-sm'
                      : 'bg-page text-dim hover:bg-elevated border border-line'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </Panel>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-3">
          <div className="bg-surface/90 backdrop-blur-sm rounded-xl p-3.5 shadow-sm border border-line/50">
            <p className="text-xs text-dim">Total ordenes</p>
            <p className="text-xl font-bold text-content">{filtered.length}</p>
          </div>
          <div className="bg-surface/90 backdrop-blur-sm rounded-xl p-3.5 shadow-sm border border-accent/30">
            <p className="text-xs text-accent">Pendientes</p>
            <p className="text-xl font-bold text-accent">{pendingCount}</p>
          </div>
          <div className="bg-surface/90 backdrop-blur-sm rounded-xl p-3.5 shadow-sm border border-ok/30">
            <p className="text-xs text-ok">Recibidas</p>
            <p className="text-xl font-bold text-ok">
              {
                purchaseOrders.filter(
                  (po) => po.status === PurchaseOrderStatusEnum.RECEIVED,
                ).length
              }
            </p>
          </div>
          <div className="bg-surface/90 backdrop-blur-sm rounded-xl p-3.5 shadow-sm border border-brand/30">
            <p className="text-xs text-brand">Monto total</p>
            <p className="text-xl font-bold text-content">
              ${totalAmount.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Content */}
        {filtered.length === 0 ? (
          <Panel className="text-center py-16">
            <ClipboardList className="h-10 w-10 text-dim mx-auto mb-3" />
            <p className="text-content font-semibold mb-1">
              {searchQuery || statusFilter !== 'ALL'
                ? 'Sin resultados'
                : 'No hay ordenes'}
            </p>
            <p className="text-dim text-sm mb-4">
              {searchQuery
                ? `No se encontro "${searchQuery}"`
                : 'Crea tu primera orden de compra'}
            </p>
            {!searchQuery && statusFilter === 'ALL' && (
              <Link href={PRIVATE_ROUTES.PURCHASE_ORDERS_NEW}>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Nueva Orden
                </Button>
              </Link>
            )}
          </Panel>
        ) : (
          <>
            {/* Desktop: Table */}
            <div className="hidden md:block">
              <Table data={filtered} columns={columns} />
            </div>

            {/* Mobile: Cards */}
            <div className="space-y-2 md:hidden">
              {filtered.map((po) => {
                const config = statusConfig[po.status] || {
                  label: po.status,
                  variant: 'secondary' as const,
                };
                return (
                  <Link
                    key={po.id}
                    href={PRIVATE_ROUTES.PURCHASE_ORDERS_DETAILS(po.id)}
                  >
                    <Panel className="p-3.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-mono font-bold text-content text-sm">
                          #{po.id.slice(-6).toUpperCase()}
                        </span>
                        <Badge variant={config.variant} className="text-[10px]">
                          {config.label}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-dim flex items-center gap-1">
                          <Truck className="w-3 h-3" />
                          {supplierMap.get(po.supplierId) || '—'}
                        </span>
                        <span className="font-semibold text-ok text-sm">
                          ${(po.totalAmount || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-dim">
                        <span>{po.items?.length || 0} items</span>
                        <span>
                          {po.createdAt ? formatDate(po.createdAt) : '—'}
                        </span>
                      </div>
                    </Panel>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
