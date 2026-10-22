'use client';
import { Lock, CheckSquare, Square, Package } from 'lucide-react';
import { Button } from '@/components/shared/button/Button';
import { Card } from '@/components/shared/card/card';

interface ClosedCashPanelProps {
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onLoadAllStock: () => void;
}

export const ClosedCashPanel = ({
  onSelectAll,
  onDeselectAll,
  onLoadAllStock,
}: ClosedCashPanelProps) => {
  return (
    <Card className="bg-accent/10 border-accent/20">
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-accent/20 rounded-full flex items-center justify-center">
            <Lock className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h2 className="font-bold text-content">Caja Cerrada</h2>
            <p className="text-sm text-accent">
              Selecciona los productos con el checkbox y define las cantidades
              para abrir la caja
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onSelectAll}
            className="text-xs"
          >
            <CheckSquare className="w-3 h-3 mr-1" />
            Seleccionar Todos
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDeselectAll}
            className="text-xs"
          >
            <Square className="w-3 h-3 mr-1" />
            Deseleccionar Todos
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onLoadAllStock}
            className="text-xs bg-elevated border-line text-dim hover:bg-elevated"
          >
            <Package className="w-3 h-3 mr-1" />
            Cargar Todo el Stock
          </Button>
        </div>
      </div>
    </Card>
  );
};
