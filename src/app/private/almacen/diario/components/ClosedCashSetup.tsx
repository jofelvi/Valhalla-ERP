'use client';
import { ClosedCashPanel } from './ClosedCashPanel';
import { SelectionSummary } from './SelectionSummary';
import { ProductsList } from './ProductsList';

interface ProductoTabla {
  id: string;
  nombre: string;
  categoria: string;
  stockGeneral: number;
  cantidadSeleccionada: number;
  seleccionado: boolean;
  precio: number;
}

interface ClosedCashSetupProps {
  productos: ProductoTabla[];
  totales: {
    productos: number;
    unidades: number;
    valorEstimado: number;
  };
  onToggleSelection: (productId: string) => void;
  onUpdateQuantity: (productId: string, cantidad: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onLoadAllStock: () => void;
  onSaveTemplate: () => void;
  onOpenCash: () => void;
  isLoadingTemplate: boolean;
  isLoadingOpen: boolean;
}

export const ClosedCashSetup = ({
  productos,
  totales,
  onToggleSelection,
  onUpdateQuantity,
  onSelectAll,
  onDeselectAll,
  onLoadAllStock,
  onSaveTemplate,
  onOpenCash,
  isLoadingTemplate,
  isLoadingOpen,
}: ClosedCashSetupProps) => {
  const isActionsDisabled = totales.productos === 0;

  return (
    <>
      {/* Instrucciones */}
      <ClosedCashPanel
        onSelectAll={onSelectAll}
        onDeselectAll={onDeselectAll}
        onLoadAllStock={onLoadAllStock}
      />

      {/* Resumen de selección */}
      <SelectionSummary
        totalProductos={totales.productos}
        totalUnidades={totales.unidades}
        totalValorEstimado={totales.valorEstimado}
        onSaveTemplate={onSaveTemplate}
        onOpenCash={onOpenCash}
        isLoadingTemplate={isLoadingTemplate}
        isLoadingOpen={isLoadingOpen}
        isDisabled={isActionsDisabled}
      />

      {/* Tabla de productos */}
      <ProductsList
        productos={productos}
        onToggleSelection={onToggleSelection}
        onUpdateQuantity={onUpdateQuantity}
      />
    </>
  );
};
