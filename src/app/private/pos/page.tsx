// app/pos/page.tsx
'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Order } from '@/modelTypes/order';
import { User } from '@/modelTypes/user';
import { usePOSData, usePendingVerificationOrders } from '@/hooks/useOrders';
import { useClaimTable } from '@/hooks/useTables';
import { isActivePosOrder } from '@/hooks/posOrderCache';
import { useUserStore } from '@/shared/store/useUserStore';
import { UserRoleEnum } from '@/shared';
import ZoneOrdersSection from '@/features/pos/ZoneOrdersSection';
import { Button } from '@/components/shared/button/Button';
import { PRIVATE_ROUTES } from '@/shared';
import { Plus, ShoppingBag, Utensils, MapPin } from 'lucide-react';
import Loader from '@/components/shared/Loader/Loader';
import { Table } from '@/modelTypes/table';
import { TableWithOrder } from './types';
import { CabeceraDePantalla } from '@/components/shared/cabecera/CabeceraDePantalla';
import { SolicitudesDeCredito } from '@/features/creditRequests';
import {
  MapaDeMesas,
  PagosPorVerificar,
  ModalDeTraspaso,
  ModalAlias,
  ModalRechazo,
  ModalReset,
  ModalFusion,
} from './components';
import { POSModeBar } from './components/POSModeBar';
import { MesaSidePanel } from './components/MesaSidePanel';
import { ZonesCompactPanel } from './components/ZonesCompactPanel';
import { useTraspaso, useModalForms } from './hooks';
import {
  getAvailableTablesCount,
  getOrderStatusColor,
  getOrderStatusText,
} from './utils';
import { Card } from '@/components/shared/card/card';

interface POSDataResponse {
  activeOrders?: Order[];
  tables?: (Table & { _id?: string })[];
  users?: User[];
}

export default function POSPage() {
  const router = useRouter();
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);

  const {
    data: posData,
    isLoading: isPOSLoading,
    refetch: refetchPOSData,
  } = usePOSData();
  const { data: pendingVerificationOrders = [] } =
    usePendingVerificationOrders();
  const claimTable = useClaimTable();
  const currentUser = useUserStore((s) => s.user);

  // Hooks customizados para traspasos y modales
  const traspasoState = useTraspaso(() => void refetchPOSData(), []);
  const modalState = useModalForms(
    () => void refetchPOSData(),
    currentUser ?? undefined,
  );

  const { tables, takeawayOrders, zoneOrders, allUsers, waiters } =
    useMemo(() => {
      if (!posData) {
        return {
          tables: [] as TableWithOrder[],
          takeawayOrders: [] as Order[],
          zoneOrders: [] as Order[],
          allUsers: [] as User[],
          waiters: [] as User[],
        };
      }
      const {
        activeOrders = [],
        tables: allTables = [],
        users: usersData = [],
      } = posData as POSDataResponse;
      const ordersMap = new Map<string, Order>();
      const takeaway: Order[] = [];
      const zones: Order[] = [];
      for (const order of activeOrders) {
        if (!isActivePosOrder(order)) continue;
        if (order.tableId) {
          if (order.paymentStatus !== 'paid')
            ordersMap.set(order.tableId, order);
        } else if (order.sector) {
          zones.push(order);
        } else {
          takeaway.push(order);
        }
      }
      const enriched: TableWithOrder[] = allTables
        .map((t) => {
          const tableId = t.id || t._id || '';
          return {
            ...t,
            id: tableId,
            currentOrder: ordersMap.get(tableId) || null,
          };
        })
        .sort((a, b) => a.number - b.number);
      return {
        tables: enriched,
        takeawayOrders: takeaway,
        zoneOrders: zones,
        allUsers: usersData,
        waiters: usersData.filter(
          (u) => u.role === UserRoleEnum.WAITER && u.isActive,
        ),
      };
    }, [posData]);

  const loading = isPOSLoading;

  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) void refetchPOSData();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibility);
  }, [refetchPOSData]);

  const tryClaimAndNavigate = async (tableId: string) => {
    if (!currentUser?.id) {
      router.push(`${PRIVATE_ROUTES.POS_ORDER}?tableId=${tableId}`);
      return;
    }
    try {
      await claimTable.mutateAsync({
        tableId,
        waiterId: currentUser.id,
        waiterName: currentUser.name ?? undefined,
      });
      router.push(`${PRIVATE_ROUTES.POS_ORDER}?tableId=${tableId}`);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'No se pudo tomar la mesa. Intenta con otra.';
      alert(msg);
      void refetchPOSData();
    }
  };

  const handleTableClick = async (table: TableWithOrder) => {
    setSelectedTableId(table.id);
  };

  const handleCreateNewOrder = async (tableId?: string) => {
    if (tableId) {
      await tryClaimAndNavigate(tableId);
    } else {
      router.push(PRIVATE_ROUTES.POS_ORDER);
    }
  };

  // Mesa con orden: se abre el pedido de ESA orden para sumarle productos. Tomar
  // la mesa (claim) solo vale para una mesa libre: sobre una ocupada la API
  // responde "La mesa ya tiene una orden activa" y el boton no hacia nada.
  const handleAddItemsToTable = async (tableId: string) => {
    const orderId = tables.find((t) => t.id === tableId)?.currentOrder?.id;
    if (orderId) {
      router.push(
        `${PRIVATE_ROUTES.POS_ORDER}?tableId=${tableId}&orderId=${orderId}`,
      );
      return;
    }
    await tryClaimAndNavigate(tableId);
  };

  const handleViewOrder = (orderId: string) => {
    router.push(`${PRIVATE_ROUTES.POS_ORDER}?orderId=${orderId}`);
  };

  const handleVerifyOrder = (orderId: string) => {
    router.push(PRIVATE_ROUTES.POS_PAYMENT(orderId));
  };

  const handleMergeIntoTableOrder = (destTable: TableWithOrder) => {
    if (!destTable.currentOrder) return;
    modalState.pedirPinParaFusionar(
      destTable.currentOrder.id,
      `Mesa ${destTable.number}`,
      traspasoState.transferOrder?.id ||
        traspasoState.transferZoneOrder?.id ||
        '',
    );
  };

  const handleMergeIntoZoneOrder = (destOrder: Order) => {
    modalState.pedirPinParaFusionar(
      destOrder.id,
      `#${destOrder.id.slice(-6).toUpperCase()}`,
      traspasoState.transferOrder?.id ||
        traspasoState.transferZoneOrder?.id ||
        '',
    );
  };

  const handleOpenResetTable = (table: TableWithOrder) => {
    if (!table.currentOrder) return;
    modalState.openResetTable(table.currentOrder, `Mesa ${table.number}`);
  };

  const handleOpenResetZoneOrder = (order: Order) => {
    const sectorLabel = order.sector
      ? order.sector.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      : 'Zona';
    modalState.openResetZoneOrder(order, sectorLabel);
  };

  const selectedTable = useMemo(
    () => tables.find((t) => t.id === selectedTableId) || null,
    [tables, selectedTableId],
  );

  const selectedOrder = useMemo(
    () => selectedTable?.currentOrder || null,
    [selectedTable],
  );

  if (loading) {
    return (
      <Loader fullScreen text="Cargando mesas..." size="lg" color="primary" />
    );
  }

  const totalTablesAmount = tables.reduce(
    (sum, t) => sum + (t.currentOrder?.total || 0),
    0,
  );
  const totalZonesAmount = zoneOrders.reduce(
    (sum, o) => sum + (o.total || 0),
    0,
  );
  const totalAmount = totalTablesAmount + totalZonesAmount;
  const availableTablesCount = getAvailableTablesCount(tables);
  const totalCapacity = tables.reduce((sum, table) => sum + table.capacity, 0);

  return (
    <div className="flex flex-col h-screen bg-page">
      {/* Barra de modos */}
      <POSModeBar
        totalTablesAmount={totalTablesAmount}
        totalZonesAmount={totalZonesAmount}
        takeawayOrdersCount={takeawayOrders.length}
      />

      {/* Contenido principal con panel lateral */}
      <div className="flex flex-1 overflow-hidden">
        {/* Panel lateral de mesa (izquierda) */}
        <MesaSidePanel
          isOpen={selectedTableId !== null}
          table={selectedTable}
          order={selectedOrder}
          allUsers={allUsers}
          onClose={() => setSelectedTableId(null)}
          onAddItems={(tableId) => handleAddItemsToTable(tableId)}
          onCharge={(orderId) => handleVerifyOrder(orderId)}
          onTransfer={(table) => traspasoState.openTransferFromTable(table)}
          onReset={
            currentUser?.role === UserRoleEnum.ADMIN
              ? handleOpenResetTable
              : undefined
          }
        />

        {/* Contenido central */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="w-full px-3 sm:px-4 lg:px-6 xl:px-8 py-4 overflow-y-auto">
            <CabeceraDePantalla
              classNameFila="flex-wrap"
              icono={<Utensils className="h-4 w-4 text-brand" />}
              titulo="Punto de Venta"
              classNameTexto="flex-initial"
              subtitulo={
                <>
                  {tables.length} mesas · {availableTablesCount} disponibles ·
                  Cap. {totalCapacity}
                </>
              }
              acciones={
                <div className="flex items-center gap-1.5 flex-wrap flex-1 justify-end">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand/10 text-brand rounded-full text-[11px] font-semibold">
                    <Utensils className="w-3 h-3" />$
                    {totalTablesAmount.toFixed(2)}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent/10 text-accent rounded-full text-[11px] font-semibold">
                    <MapPin className="w-3 h-3" />${totalZonesAmount.toFixed(2)}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-ok/10 text-ok rounded-full text-[11px] font-bold">
                    Total: ${totalAmount.toFixed(2)}
                  </span>
                  <Button
                    onClick={() => handleCreateNewOrder()}
                    size="sm"
                    className="h-8 ml-1"
                  >
                    <ShoppingBag className="w-3.5 h-3.5 sm:mr-1.5" />
                    <span className="hidden sm:inline">Para Llevar</span>
                    <Plus className="w-3 h-3 ml-1 sm:hidden" />
                  </Button>
                </div>
              }
            />

            <MapaDeMesas
              tables={tables}
              allUsers={allUsers}
              currentUserRole={currentUser?.role}
              onTransferTable={(table) =>
                traspasoState.openTransferFromTable(table)
              }
              onResetTable={
                currentUser?.role === UserRoleEnum.ADMIN
                  ? handleOpenResetTable
                  : undefined
              }
              onAliasEdit={(order) => modalState.openAliasModal(order)}
              onTableClick={handleTableClick}
            />

            <ZoneOrdersSection
              zoneOrders={zoneOrders}
              waiters={waiters}
              allUsers={allUsers}
              getOrderStatusColor={getOrderStatusColor}
              getOrderStatusText={getOrderStatusText}
              onTransferOrder={(order) =>
                traspasoState.openTransferFromZone(order)
              }
              onEditAlias={(order) => modalState.openAliasModal(order)}
              onResetOrder={
                currentUser?.role === UserRoleEnum.ADMIN
                  ? handleOpenResetZoneOrder
                  : undefined
              }
            />

            {takeawayOrders.length > 0 && (
              <div className="mt-6">
                <h2 className="text-lg font-bold text-content mb-3 flex items-center">
                  <ShoppingBag className="w-5 h-5 mr-1.5 text-brand" />
                  Para Llevar
                  <span className="ml-2 px-2 py-0.5 bg-accent/10 text-accent text-xs font-medium rounded-full">
                    {takeawayOrders.length}
                  </span>
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
                  {takeawayOrders.map((order) => (
                    <Card
                      key={order.id}
                      className="cursor-pointer hover:shadow-lg transition-all duration-200 bg-surface border border-accent/20 hover:border-accent/50 overflow-hidden"
                      onClick={() => handleViewOrder(order.id)}
                    >
                      <div className="p-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 bg-gradient-to-r from-accent to-accent rounded-lg flex items-center justify-center flex-shrink-0">
                            <ShoppingBag className="w-4.5 h-4.5 text-on-brand" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-mono font-semibold text-content truncate">
                              {order.id.slice(-8).toUpperCase()}
                            </h3>
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${getOrderStatusColor(order.status)}`}
                            >
                              {getOrderStatusText(order.status)}
                            </span>
                          </div>
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-[11px]">
                          <span className="font-bold text-accent text-sm">
                            ${order.total.toFixed(2)}
                          </span>
                          <span className="text-dim">
                            {order.items.length} items
                          </span>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Primero lo que espera una decision de credito, despues lo que
            espera validacion de pago: las dos cosas son "algo pendiente de
            que alguien autorice", y en verificar pagos van en el mismo orden. */}
            <SolicitudesDeCredito variante="resumen" />

            <PagosPorVerificar
              orders={pendingVerificationOrders}
              waiters={waiters}
              onRejectOrder={(order) => modalState.openRejectModal(order)}
              onVerifyOrder={handleVerifyOrder}
            />
          </div>
        </div>

        {/* Panel de zonas (derecha) */}
        <ZonesCompactPanel
          zoneOrders={zoneOrders}
          allUsers={allUsers}
          onCreateNewOrder={() => handleCreateNewOrder()}
          onViewOrder={handleViewOrder}
        />
      </div>

      {/* Modales */}
      <ModalFusion
        isOpen={!!modalState.pendingMerge}
        destLabel={modalState.pendingMerge?.etiqueta ?? null}
        pin={modalState.mergePin}
        error={modalState.mergeError}
        isTransferring={modalState.isTransferring}
        onClose={modalState.closeMergeModal}
        onPinChange={modalState.setMergePin}
        onConfirm={modalState.confirmarFusion}
      />

      <ModalDeTraspaso
        isOpen={!!traspasoState.transferOrder}
        origen="mesa"
        transferOrder={traspasoState.transferOrder}
        transferSourceTable={traspasoState.transferSourceTable}
        transferZoneOrder={null}
        tables={tables}
        zoneOrders={zoneOrders}
        waiters={waiters}
        allUsers={allUsers}
        isTransferring={traspasoState.isTransferring}
        onClose={traspasoState.closeTransfer}
        onTransferToTable={traspasoState.handleTransferToTable}
        onTransferToSector={traspasoState.handleTransferToSector}
        onMergeWithTableOrder={handleMergeIntoTableOrder}
        onMergeWithZoneOrder={handleMergeIntoZoneOrder}
      />

      <ModalDeTraspaso
        isOpen={!!traspasoState.transferZoneOrder}
        origen="zona"
        transferOrder={null}
        transferSourceTable={null}
        transferZoneOrder={traspasoState.transferZoneOrder}
        tables={tables}
        zoneOrders={zoneOrders}
        waiters={waiters}
        allUsers={allUsers}
        isTransferring={traspasoState.isTransferring}
        onClose={traspasoState.closeZoneTransfer}
        onTransferToTable={traspasoState.handleZoneTransferToTable}
        onTransferToSector={traspasoState.handleZoneTransferToSector}
        onMergeWithTableOrder={handleMergeIntoTableOrder}
        onMergeWithZoneOrder={handleMergeIntoZoneOrder}
        onZoneTransferWaiter={traspasoState.handleZoneTransferWaiter}
      />

      <ModalAlias
        isOpen={!!modalState.aliasOrder}
        order={modalState.aliasOrder}
        aliasValue={modalState.aliasValue}
        isSaving={modalState.isSavingAlias}
        onClose={modalState.closeAliasModal}
        onAliasChange={modalState.setAliasValue}
        onSave={modalState.saveAlias}
      />

      <ModalRechazo
        isOpen={!!modalState.orderToReject}
        order={modalState.orderToReject}
        reason={modalState.rejectionReason}
        isRejecting={modalState.isRejecting}
        onClose={modalState.closeRejectModal}
        onReasonChange={modalState.setRejectionReason}
        onReject={modalState.handleRejectPayment}
      />

      <ModalReset
        isOpen={!!modalState.resetTarget}
        target={modalState.resetTarget}
        pin={modalState.resetPin}
        reason={modalState.resetReason}
        error={modalState.resetError}
        isResetting={modalState.isResetting}
        onClose={modalState.closeResetModal}
        onPinChange={modalState.setResetPin}
        onReasonChange={modalState.setResetReason}
        onReset={modalState.handleResetOrder}
      />
    </div>
  );
}
