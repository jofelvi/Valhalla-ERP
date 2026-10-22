import { Pencil } from 'lucide-react';
import { Warehouse } from '@odin6/types';

interface WarehousesTabProps {
  warehouses: Warehouse[];
  onCreate: () => void;
  onEdit: (warehouse: Warehouse) => void;
}

const AREA_LABELS: Record<Warehouse['area'], string> = {
  GENERAL: 'General',
  COCINA: 'Cocina',
  PIZZERIA: 'Pizzería',
  BARRA: 'Barra',
};

export function WarehousesTab({
  warehouses,
  onCreate,
  onEdit,
}: WarehousesTabProps) {
  return (
    <div className="space-y-4">
      <button
        onClick={onCreate}
        className="px-4 py-2 rounded-lg bg-accent text-on-brand text-sm font-medium hover:bg-accent/90 transition-colors"
      >
        Crear Almacén
      </button>

      {warehouses.length === 0 ? (
        <div className="bg-surface rounded-xl border border-line p-6 text-center">
          <p className="text-dim">Sin almacenes</p>
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-line overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-elevated/50">
                <tr className="border-b border-line">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-content">
                    Nombre
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-content">
                    Área
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-content">
                    Por Defecto
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-content">
                    Activo
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-content">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {warehouses.map((w) => (
                  <tr
                    key={w.id}
                    className="border-b border-line hover:bg-elevated/30"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-content">
                      {w.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-dim">
                      {AREA_LABELS[w.area]}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {w.isDefault && (
                        <span className="text-ok text-sm font-medium">★</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {w.isActive !== false ? (
                        <span className="text-ok text-sm font-medium">Sí</span>
                      ) : (
                        <span className="text-danger text-sm font-medium">
                          No
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onEdit(w)}
                        className="text-accent hover:bg-accent/10 rounded p-1.5 transition-colors"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
