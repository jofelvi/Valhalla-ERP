'use client';
import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiDownload, FiRefreshCw, FiShoppingCart } from 'react-icons/fi';
import { useAccountsReceivable } from '@/hooks/useAccountsReceivable';
import { useWaiters } from '@/hooks/useUsers';
import { useCustomers } from '@/hooks/useCustomers';
import { useOrders, useUpdateOrder } from '@/hooks/useOrders';
import { useTables } from '@/hooks/useTables';
import { Order } from '@/modelTypes/order';
import { OrderStatusEnum, DateFilterEnum } from '@/shared';
import { Button } from '@/components/shared/button/Button';
import { PRIVATE_ROUTES } from '@/shared/constantsRoutes/routes';
import { CabeceraDePantalla } from '@/components/shared/cabecera/CabeceraDePantalla';
import {
  useOrdersFiltering,
  useOrdersSummary,
  useOrderPayments,
  useOrderActions,
} from './hooks';
import {
  OrdersFiltersPanel,
  OrdersStatsCards,
  OrdersTableView,
  OrdersMobileView,
  OrdersPagination,
  OrderTooltip,
  OrderModalSummary,
} from './components';
import { rangoParaElServidor } from '@/shared/utils/dateHelpers';

/** ~25 caracteres por id: 150 ids son ~4 KB, lejos del tope de 8 KB de nginx. */
const MAX_CLIENTES_EN_URL = 150;

export default function OrdersPage() {
  const router = useRouter();
  const { data: tables = [] } = useTables();

  const [statusFilter, setStatusFilter] = useState<OrderStatusEnum | 'ALL'>(
    'ALL',
  );
  const [dateFilter, setDateFilter] = useState<DateFilterEnum>(
    DateFilterEnum.TODAY,
  );
  const [customDate, setCustomDate] = useState<string>(
    new Date().toISOString().split('T')[0],
  );

  // El rango se le pide al SERVIDOR. Antes esta pantalla se bajaba TODAS las
  // ordenes y recortaba por fecha en el navegador; con el tope del endpoint eso
  // dejaria fuera lo viejo sin avisar. Ver `rangoParaElServidor`.
  const rangoDeLaConsulta = useMemo(
    () => rangoParaElServidor(dateFilter, customDate),
    [dateFilter, customDate],
  );
  const {
    data: allOrders = [],
    isLoading: loading,
    refetch: refetchOrders,
  } = useOrders({ ...rangoDeLaConsulta, limit: '2000' });
  // Esta pantalla solo arma un mapa id -> nombre para mostrar de quien es cada
  // orden. `vista: 'lista'` deja fuera todo lo demas.
  const { data: customersData = [] } = useCustomers({ vista: 'lista' });
  useUpdateOrder();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [hoveredOrder, setHoveredOrder] = useState<Order | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const [showOrderModal, setShowOrderModal] = useState(false);

  const PAGE_SIZE = 20;

  // Solo se piden las cuentas por cobrar de los clientes que aparecen en las
  // ordenes del rango: con "Hoy" (el filtro por defecto) son unas decenas en
  // vez de las ~860 KB de toda la cartera. El resumen las cruza por orderId,
  // asi que filtrar por cliente no cambia ningun total.
  // Con rangos largos NO se filtra: dos meses en PRE son 767 clientes, ~18 KB
  // de URL, y nginx corta la linea de peticion en 8 KB.
  const filtroDeCartera = useMemo(():
    | { pedir: false }
    | { pedir: true; customerIds?: string } => {
    const ids = new Set<string>();
    for (const order of allOrders) {
      if (order.customerId) ids.add(order.customerId);
    }
    // Sin clientes en el rango no hay cuenta que cruzar: no se pide nada.
    if (ids.size === 0) return { pedir: false };
    if (ids.size > MAX_CLIENTES_EN_URL) return { pedir: true };
    return { pedir: true, customerIds: Array.from(ids).sort().join(',') };
  }, [allOrders]);

  // Se espera a las ordenes: pedir antes bajaba toda la cartera de entrada
  // (allOrders arranca vacio) y despues otra vez la filtrada.
  const { data: receivablesData = [] } = useAccountsReceivable(
    filtroDeCartera.pedir && filtroDeCartera.customerIds
      ? { customerIds: filtroDeCartera.customerIds }
      : undefined,
    { enabled: !loading && filtroDeCartera.pedir },
  );
  const { data: waitersData = [] } = useWaiters();

  // Build customer map
  const customerById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of customersData) {
      map.set(c.id, c.name);
    }
    return map;
  }, [customersData]);

  // Filter orders with date range and status
  const { filteredOrders } = useOrdersFiltering(
    allOrders,
    statusFilter,
    dateFilter,
    customDate,
    searchTerm,
    (tableId: string) => {
      const table = tables.find((t) => t.id === tableId);
      return table ? `Mesa ${table.number}` : tableId;
    },
    customerById,
  );

  // Calculate summary stats
  const summary = useOrdersSummary(filteredOrders, receivablesData);

  // Handle payments modal
  const {
    selectedOrder,
    setSelectedOrder,
    selectedOrderPayments,
    loadingPayments,
    setLoadingPayments,
  } = useOrderPayments();

  // Handle waiter assignment
  const { savingWaiterId, handleAssignWaiter } = useOrderActions(waitersData);

  // Build receivable map for lookup
  const receivableByOrderId = useMemo(() => {
    const map = new Map<string, { amount: number; paidAmount: number }>();
    for (const ar of receivablesData) {
      if (ar.orderId) {
        map.set(ar.orderId, { amount: ar.amount, paidAmount: ar.paidAmount });
      }
    }
    return map;
  }, [receivablesData]);

  const fetchOrders = () => {
    refetchOrders();
    setCurrentPage(0);
  };

  const handleOrderClick = (order: Order) => {
    if (order.status === OrderStatusEnum.PAID) {
      setSelectedOrder(order);
      setShowOrderModal(true);
      setLoadingPayments(true);
      return;
    }

    if (order.tableId) {
      router.push(
        `${PRIVATE_ROUTES.POS_ORDER}?tableId=${order.tableId}&orderId=${order.id}`,
      );
    } else {
      router.push(`${PRIVATE_ROUTES.POS_ORDER}?orderId=${order.id}`);
    }
  };

  const handleRowMouseEnter = (
    e: React.MouseEvent<HTMLTableRowElement>,
    order: Order,
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const tooltipWidth = 288;
    const tooltipHeight = Math.min(380, 140 + order.items.length * 36);
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 12;

    const sidebar = document.querySelector('aside, nav, [data-sidebar]');
    const sidebarRight = sidebar ? sidebar.getBoundingClientRect().right : 0;
    const safeLeft = Math.max(margin, sidebarRight + margin);

    let left = rect.right + 10;

    if (left + tooltipWidth > viewportWidth - margin) {
      left = rect.left - tooltipWidth - 10;
    }

    if (left < safeLeft) {
      left = safeLeft;
    }

    let top = rect.top + rect.height / 2 - tooltipHeight / 2;

    if (top + tooltipHeight > viewportHeight - margin) {
      top = viewportHeight - tooltipHeight - margin;
    }
    if (top < margin) top = margin;

    setTooltipPos({ top, left });
    setHoveredOrder(order);
  };

  const handleRowMouseLeave = () => {
    setHoveredOrder(null);
  };

  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / PAGE_SIZE);
  const paginatedOrders = filteredOrders.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE,
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-elevated flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto"></div>
          <p className="mt-4 text-dim">Cargando órdenes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated">
      <div className="w-full px-3 sm:px-4 lg:px-6 xl:px-8 py-4">
        {/* Header */}
        <CabeceraDePantalla
          classNameFila="flex-wrap"
          icono={<FiShoppingCart className="text-brand w-4 h-4" />}
          titulo="Ordenes"
          subtitulo={
            <>
              {filteredOrders.length} ordenes · {summary.pendingCount}{' '}
              pendientes
            </>
          }
          acciones={
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void fetchOrders()}
                disabled={loading}
                className="h-8"
              >
                <FiRefreshCw
                  className={`w-3.5 h-3.5 sm:mr-1.5 ${loading ? 'animate-spin' : ''}`}
                />
                <span className="hidden sm:inline">Actualizar</span>
              </Button>
              <Button variant="outline" size="sm" className="h-8">
                <FiDownload className="w-3.5 h-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Exportar</span>
              </Button>
            </div>
          }
        />

        {/* Filters */}
        <OrdersFiltersPanel
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          dateFilter={dateFilter}
          onDateFilterChange={setDateFilter}
          customDate={customDate}
          onCustomDateChange={setCustomDate}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
        />

        {/* Stats */}
        <OrdersStatsCards
          filteredCount={filteredOrders.length}
          pendingCount={summary.pendingCount}
          inProgressCount={summary.inProgressCount}
          totalVentas={summary.totalVentas}
          totalCobrado={summary.totalCobrado}
          totalCreditos={summary.totalCreditos}
          cancelledCount={summary.cancelledCount}
          cancelledTotal={summary.cancelledTotal}
        />

        {/* Empty state */}
        {filteredOrders.length === 0 ? (
          <div className="bg-surface rounded-xl shadow-sm border border-line text-center py-12">
            <FiShoppingCart className="mx-auto h-12 w-12 text-dim" />
            <h3 className="mt-2 text-sm font-medium text-content">
              No hay ordenes
            </h3>
            <p className="mt-1 text-sm text-dim">
              {statusFilter === 'ALL'
                ? 'No se encontraron ordenes en el sistema'
                : 'No se encontraron ordenes con ese filtro'}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile view */}
            <OrdersMobileView
              data={paginatedOrders}
              tables={tables}
              receivableByOrderId={receivableByOrderId}
              waiters={waitersData}
              onOrderClick={handleOrderClick}
            />

            {/* Desktop view */}
            <OrdersTableView
              data={paginatedOrders}
              pageSize={PAGE_SIZE}
              tables={tables}
              receivableByOrderId={receivableByOrderId}
              waiters={waitersData}
              savingWaiterId={savingWaiterId}
              onAssignWaiter={handleAssignWaiter}
              onOrderClick={handleOrderClick}
              onRowMouseEnter={handleRowMouseEnter}
              onRowMouseLeave={handleRowMouseLeave}
            />

            {/* Pagination */}
            <OrdersPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredOrders.length}
              pageSize={PAGE_SIZE}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>

      {/* Tooltip */}
      <OrderTooltip
        order={hoveredOrder}
        position={tooltipPos}
        tables={tables}
      />

      {/* Modal */}
      <OrderModalSummary
        isOpen={showOrderModal}
        order={selectedOrder}
        payments={selectedOrderPayments}
        loadingPayments={loadingPayments}
        tables={tables}
        onClose={() => {
          setShowOrderModal(false);
          setSelectedOrder(null);
        }}
      />
    </div>
  );
}
