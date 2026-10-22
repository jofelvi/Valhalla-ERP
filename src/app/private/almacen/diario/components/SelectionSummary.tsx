'use client';
import { Save, Unlock } from 'lucide-react';
import { Button } from '@/components/shared/button/Button';
import { Card } from '@/components/shared/card/card';

interface SelectionSummaryProps {
  totalProductos: number;
  totalUnidades: number;
  totalValorEstimado: number;
  onSaveTemplate: () => void;
  onOpenCash: () => void;
  isLoadingTemplate: boolean;
  isLoadingOpen: boolean;
  isDisabled: boolean;
}

export const SelectionSummary = ({
  totalProductos,
  totalUnidades,
  totalValorEstimado,
  onSaveTemplate,
  onOpenCash,
  isLoadingTemplate,
  isLoadingOpen,
  isDisabled,
}: SelectionSummaryProps) => {
  return (
    <Card className="bg-elevated border-line">
      <div className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-xs text-brand font-medium">Productos</p>
              <p className="text-2xl font-bold text-content">
                {totalProductos}
              </p>
            </div>
            <div>
              <p className="text-xs text-brand font-medium">Unidades</p>
              <p className="text-2xl font-bold text-content">{totalUnidades}</p>
            </div>
            <div>
              <p className="text-xs text-brand font-medium">Valor Estimado</p>
              <p className="text-2xl font-bold text-content">
                ${totalValorEstimado.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onSaveTemplate}
              disabled={isLoadingTemplate || isDisabled}
              className="flex items-center gap-2"
            >
              {isLoadingTemplate ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-dim" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">Guardar Plantilla</span>
            </Button>
            <Button
              onClick={onOpenCash}
              disabled={isLoadingOpen || isDisabled}
              className="bg-ok hover:bg-ok/80 text-on-brand flex items-center gap-2"
            >
              {isLoadingOpen ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              ) : (
                <Unlock className="w-4 h-4" />
              )}
              <span>Abrir Caja</span>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};
