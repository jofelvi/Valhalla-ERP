'use client';
import { useState } from 'react';
import { Package } from 'lucide-react';
import Loader from '@/components/shared/Loader/Loader';
import { formatearUsd } from '@/shared/utils/dinero';
import {
  useWarehouses,
  useWarehouseStock,
  useInventoryMovements,
  useInventoryCounts,
  useAnnulMovement,
  usePurchases,
  useShoppingListCurrent,
  useCatalogAudit,
  useBuildAiPlan,
} from '@/hooks/useInventory';
import { useProducts } from '@/hooks/useProducts';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/shared/ui/tabs/tabs';
import WasteModal from '@/features/inventory/WasteModal';
import TransferModal from '@/features/inventory/TransferModal';
import CountModal from '@/features/inventory/CountModal';
import WarehouseModal from '@/features/inventory/WarehouseModal';
import PurchaseModal from '@/features/inventory/PurchaseModal';
import PriceHistoryModal from '@/features/inventory/PriceHistoryModal';
import PlacesModal from '@/features/inventory/PlacesModal';
import { Warehouse } from '@odin6/types';
import { useEnrichedInventoryData } from '@/features/inventory/hooks/useEnrichedInventoryData';
import { InventoryHeader } from '@/features/inventory/components/InventoryHeader';
import { StockTab } from '@/features/inventory/components/StockTab';
import { MovementsTab } from '@/features/inventory/components/MovementsTab';
import { CountsTab } from '@/features/inventory/components/CountsTab';
import { PurchasesTab } from '@/features/inventory/components/PurchasesTab';
import { ShoppingListTab } from '@/features/inventory/components/ShoppingListTab';
import { AuditTab } from '@/features/inventory/components/AuditTab';
import { WarehousesTab } from '@/features/inventory/components/WarehousesTab';

export default function InventoryPage() {
  const { data: warehouses = [], isLoading: warehousesLoading } =
    useWarehouses();
  const { data: products = [] } = useProducts();

  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [activeTab, setActiveTab] = useState('stock');
  const [showWasteModal, setShowWasteModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showCountModal, setShowCountModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showPlacesModal, setShowPlacesModal] = useState(false);
  const [showPriceHistoryModal, setShowPriceHistoryModal] = useState(false);
  const [selectedProductForHistory, setSelectedProductForHistory] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [editingWarehouse, setEditingWarehouse] = useState<
    Warehouse | null | undefined
  >(undefined);
  const [auditDays, setAuditDays] = useState<number>(30);

  // Set default warehouse
  const defaultWarehouse = warehouses.find((w) => w.isDefault);
  const selectedWarehouse =
    warehouses.find((w) => w.id === selectedWarehouseId) ||
    defaultWarehouse ||
    warehouses[0];

  if (selectedWarehouse && !selectedWarehouseId) {
    setSelectedWarehouseId(selectedWarehouse.id);
  }

  const { data: stock = [], isLoading: stockLoading } = useWarehouseStock(
    selectedWarehouse?.id,
  );
  const { data: movements = [], isLoading: movementsLoading } =
    useInventoryMovements({
      warehouseId: selectedWarehouse?.id,
    });
  const { data: counts = [], isLoading: countsLoading } = useInventoryCounts(
    selectedWarehouse?.id,
  );
  const { data: purchases = [], isLoading: purchasesLoading } = usePurchases({
    limit: 20,
  });
  const { data: shoppingList, isLoading: shoppingListLoading } =
    useShoppingListCurrent();
  const { data: audit, isLoading: auditLoading } = useCatalogAudit(auditDays);
  const buildAiPlan = useBuildAiPlan(shoppingList?.id || '');

  const annulMovement = useAnnulMovement();

  const { enrichedStock, enrichedMovements, enrichedCounts } =
    useEnrichedInventoryData(stock, movements, counts, products);

  const handleAnnulMovement = async (movementId: string) => {
    if (!window.confirm('¿Anular este movimiento?')) return;

    try {
      await annulMovement.mutateAsync({
        id: movementId,
        data: {},
      });
      alert('Movimiento anulado exitosamente');
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Error al anular'}`);
    }
  };

  const handleViewPriceHistory = (productId: string, productName: string) => {
    setSelectedProductForHistory({ id: productId, name: productName });
    setShowPriceHistoryModal(true);
  };

  const handleCopyAiPlanToWhatsapp = async () => {
    if (
      !shoppingList?.aiPlanByPlace ||
      shoppingList.aiPlanByPlace.length === 0
    ) {
      alert('No hay plan de compra para copiar');
      return;
    }

    let text = '*📋 Plan de Compra Optimizado*\n\n';

    for (const group of shoppingList.aiPlanByPlace) {
      text += `*${group.placeName}*\n`;
      for (const item of group.items) {
        text += `• ${item.productName}: ${item.qty} ${item.unit}\n`;
      }
      text += `Total: ${formatearUsd(group.estimatedTotal)}\n`;
      if (group.savingsVsWorst > 0) {
        text += `Ahorro: ${formatearUsd(group.savingsVsWorst)}\n`;
      }
      text += '\n';
    }

    if (shoppingList.aiSummary) {
      text += `*Narrativa IA*\n${shoppingList.aiSummary}`;
    }

    try {
      await navigator.clipboard.writeText(text);
      alert('Plan copiado al portapapeles');
    } catch {
      alert('Error al copiar al portapapeles');
    }
  };

  if (warehousesLoading) {
    return <Loader size="lg" text="Cargando inventario..." />;
  }

  if (warehouses.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-surface rounded-2xl border border-line shadow-sm p-8 text-center">
            <Package className="h-12 w-12 mx-auto mb-4 text-dim" />
            <h1 className="text-2xl font-bold text-content mb-2">
              Sin Almacenes
            </h1>
            <p className="text-content mb-6">
              No hay almacenes configurados. Crea uno para comenzar.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated">
      <div className="w-full px-3 sm:px-4 lg:px-6 xl:px-8 py-4">
        <InventoryHeader
          warehouses={warehouses}
          selectedWarehouseId={selectedWarehouseId}
          onSelectWarehouse={setSelectedWarehouseId}
        />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-surface/90 border border-line/50 rounded-xl p-1 w-full mb-4">
            <TabsTrigger value="stock" className="flex-1 text-sm">
              Stock
            </TabsTrigger>
            <TabsTrigger value="movements" className="flex-1 text-sm">
              Movimientos
            </TabsTrigger>
            <TabsTrigger value="counts" className="flex-1 text-sm">
              Conteos
            </TabsTrigger>
            <TabsTrigger value="purchases" className="flex-1 text-sm">
              Compras
            </TabsTrigger>
            <TabsTrigger value="shopping-list" className="flex-1 text-sm">
              Lista
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex-1 text-sm">
              Auditoría
            </TabsTrigger>
            <TabsTrigger value="warehouses" className="flex-1 text-sm">
              Almacenes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stock" className="space-y-4">
            <StockTab
              items={enrichedStock}
              isLoading={stockLoading}
              onTransfer={() => setShowTransferModal(true)}
              onWaste={() => setShowWasteModal(true)}
              onViewPriceHistory={handleViewPriceHistory}
            />
          </TabsContent>

          <TabsContent value="movements" className="space-y-4">
            <MovementsTab
              movements={enrichedMovements}
              isLoading={movementsLoading}
              onAnnul={handleAnnulMovement}
              isAnnulling={annulMovement.isPending}
            />
          </TabsContent>

          <TabsContent value="counts" className="space-y-4">
            <CountsTab
              counts={enrichedCounts}
              isLoading={countsLoading}
              onNewCount={() => setShowCountModal(true)}
            />
          </TabsContent>

          <TabsContent value="purchases" className="space-y-4">
            <PurchasesTab
              purchases={purchases}
              isLoading={purchasesLoading}
              onNewPurchase={() => setShowPurchaseModal(true)}
              onPlaces={() => setShowPlacesModal(true)}
            />
          </TabsContent>

          <TabsContent value="shopping-list" className="space-y-4">
            <ShoppingListTab
              shoppingList={shoppingList}
              isLoading={shoppingListLoading}
              isBuildingAiPlan={buildAiPlan.isPending}
              onBuildAiPlan={() => buildAiPlan.mutate()}
              onCopyAiPlanToWhatsapp={handleCopyAiPlanToWhatsapp}
            />
          </TabsContent>

          <TabsContent value="audit" className="space-y-4">
            <AuditTab
              audit={audit}
              isLoading={auditLoading}
              auditDays={auditDays}
              onAuditDaysChange={setAuditDays}
            />
          </TabsContent>

          <TabsContent value="warehouses" className="space-y-4">
            <WarehousesTab
              warehouses={warehouses}
              onCreate={() => setEditingWarehouse(null)}
              onEdit={setEditingWarehouse}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      {showWasteModal && selectedWarehouse && (
        <WasteModal
          warehouse={selectedWarehouse}
          onClose={() => setShowWasteModal(false)}
          onSuccess={() => alert('Merma registrada exitosamente')}
        />
      )}

      {showTransferModal && selectedWarehouse && (
        <TransferModal
          warehouse={selectedWarehouse}
          onClose={() => setShowTransferModal(false)}
          onSuccess={() => alert('Traslado registrado exitosamente')}
        />
      )}

      {showCountModal && selectedWarehouse && (
        <CountModal
          warehouse={selectedWarehouse}
          onClose={() => setShowCountModal(false)}
          onSuccess={() => alert('Conteo registrado exitosamente')}
        />
      )}

      {showPurchaseModal && (
        <PurchaseModal
          warehouse={selectedWarehouse}
          onClose={() => setShowPurchaseModal(false)}
          onSuccess={() => alert('Compra registrada exitosamente')}
        />
      )}

      {showPlacesModal && (
        <PlacesModal onClose={() => setShowPlacesModal(false)} />
      )}

      {showPriceHistoryModal && selectedProductForHistory && (
        <PriceHistoryModal
          productId={selectedProductForHistory.id}
          productName={selectedProductForHistory.name}
          onClose={() => {
            setShowPriceHistoryModal(false);
            setSelectedProductForHistory(null);
          }}
        />
      )}

      {editingWarehouse !== undefined && (
        <WarehouseModal
          warehouse={editingWarehouse}
          onClose={() => setEditingWarehouse(undefined)}
          onSuccess={() => alert('Almacén guardado exitosamente')}
        />
      )}
    </div>
  );
}
