'use client';
import {
  Unlock,
  Lock,
  Package,
  ShoppingCart,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/shared/button/Button';
import { Card } from '@/components/shared/card/card';
import { formatTime } from '@/shared/utils/dateHelpers';
import { AlmacenDiario } from '@odin6/types';
import { StockDayTable } from './StockDayTable';
import { Product } from '@odin6/types';

interface CashDashboardProps {
  diaActivo: AlmacenDiario;
  onCloseCash: () => void;
  productos: Product[];
}

export const CashDashboard = ({
  diaActivo,
  onCloseCash,
  productos,
}: CashDashboardProps) => {
  const totalUnidades = diaActivo.stockInicial.reduce(
    (sum, s) => sum + s.cantidad,
    0,
  );

  const totalOrdenes = diaActivo.ventasRef.length;

  const totalVentas = diaActivo.ventasRef.reduce((sum, v) => sum + v.total, 0);

  const totalMovimientos = diaActivo.movimientos.length;

  return (
    <>
      {/* Dashboard del día */}
      <Card className="bg-ok/10 border-ok/20">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-ok/20 rounded-full flex items-center justify-center">
                <Unlock className="w-6 h-6 text-ok" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-content">Caja Abierta</h2>
                <p className="text-sm text-ok">
                  Apertura: {formatTime(diaActivo.horaApertura)}
                  {diaActivo.usuarioApertura &&
                    ` por ${diaActivo.usuarioApertura}`}
                </p>
              </div>
            </div>
            <Button
              onClick={onCloseCash}
              className="bg-danger hover:bg-danger/80 text-on-brand flex items-center gap-2"
            >
              <Lock className="w-4 h-4" />
              <span>Cerrar Caja</span>
            </Button>
          </div>

          {/* Estadísticas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-surface rounded-lg p-3 border border-ok/20">
              <div className="flex items-center gap-2 mb-1">
                <Package className="w-4 h-4 text-ok" />
                <span className="text-xs text-dim">Stock Inicial</span>
              </div>
              <p className="text-xl font-bold text-content">{totalUnidades}</p>
              <p className="text-xs text-dim">
                {diaActivo.stockInicial.length} productos
              </p>
            </div>

            <div className="bg-surface rounded-lg p-3 border border-ok/20">
              <div className="flex items-center gap-2 mb-1">
                <ShoppingCart className="w-4 h-4 text-brand" />
                <span className="text-xs text-dim">Órdenes</span>
              </div>
              <p className="text-xl font-bold text-content">{totalOrdenes}</p>
              <p className="text-xs text-dim">ventas realizadas</p>
            </div>

            <div className="bg-surface rounded-lg p-3 border border-ok/20">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-ok" />
                <span className="text-xs text-dim">Total Ventas</span>
              </div>
              <p className="text-xl font-bold text-ok">
                ${totalVentas.toFixed(2)}
              </p>
              <p className="text-xs text-dim">del día</p>
            </div>

            <div className="bg-surface rounded-lg p-3 border border-ok/20">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-brand" />
                <span className="text-xs text-dim">Movimientos</span>
              </div>
              <p className="text-xl font-bold text-content">
                {totalMovimientos}
              </p>
              <p className="text-xs text-dim">ajustes</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Stock del día */}
      <StockDayTable diaActivo={diaActivo} productos={productos} />
    </>
  );
};
