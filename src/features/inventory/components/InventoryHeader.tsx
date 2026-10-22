import { Package, PackageOpen, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { Panel } from '@/components/shared/panel/Panel';
import { Warehouse } from '@odin6/types';

interface InventoryHeaderProps {
  warehouses: Warehouse[];
  selectedWarehouseId: string;
  onSelectWarehouse: (id: string) => void;
}

export function InventoryHeader({
  warehouses,
  selectedWarehouseId,
  onSelectWarehouse,
}: InventoryHeaderProps) {
  return (
    <Panel className="p-3.5 mb-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h1 className="text-2xl font-bold text-content flex items-center gap-2">
          <Package className="h-6 w-6 text-accent" />
          Inventario
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href="/private/inventory/insumo-requests"
            className="px-3 py-2 rounded-lg bg-accent/10 text-accent text-sm font-medium hover:bg-accent/20 transition-colors flex items-center gap-2"
          >
            <PackageOpen className="h-4 w-4" />
            Solicitudes
          </Link>
          <Link
            href="/private/inventory/report"
            className="px-3 py-2 rounded-lg bg-accent/10 text-accent text-sm font-medium hover:bg-accent/20 transition-colors flex items-center gap-2"
          >
            <BarChart3 className="h-4 w-4" />
            Informe Semanal
          </Link>
        </div>
      </div>

      {/* Warehouse selector (solo activos; los inactivos siguen en la tab Almacenes) */}
      <div className="flex flex-wrap gap-2">
        {warehouses
          .filter((w) => w.isActive)
          .map((w) => (
            <button
              key={w.id}
              onClick={() => onSelectWarehouse(w.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                selectedWarehouseId === w.id
                  ? 'bg-accent text-on-brand'
                  : 'bg-elevated text-content hover:bg-elevated/80'
              }`}
            >
              {w.name}
            </button>
          ))}
      </div>
    </Panel>
  );
}
