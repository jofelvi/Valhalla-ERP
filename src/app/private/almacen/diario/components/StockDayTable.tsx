'use client';
import { Card } from '@/components/shared/card/card';
import { AlmacenDiario } from '@odin6/types';
import { Product } from '@odin6/types';

interface StockDayTableProps {
  diaActivo: AlmacenDiario;
  productos: Product[];
}

export const StockDayTable = ({ diaActivo, productos }: StockDayTableProps) => {
  const productoMap = new Map(productos.map((p) => [p.id, p]));
  const stockActualMap = new Map(
    (diaActivo.stockActual || []).map((s) => [s.productId, s]),
  );
  const stockInicialIds = new Set(
    diaActivo.stockInicial.map((i) => i.productId),
  );

  return (
    <Card>
      <div className="p-4">
        <h3 className="text-lg font-semibold text-content mb-3">
          Stock del Día
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-line">
                <th className="text-left py-2 px-3 text-sm font-semibold text-dim">
                  Producto
                </th>
                <th className="text-right py-2 px-3 text-sm font-semibold text-dim">
                  Inicial
                </th>
                <th className="text-right py-2 px-3 text-sm font-semibold text-dim">
                  Actual
                </th>
                <th className="text-right py-2 px-3 text-sm font-semibold text-dim">
                  Vendido
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Productos del stock inicial */}
              {diaActivo.stockInicial.map((item) => {
                const producto = productoMap.get(item.productId);
                const stockActualItem = stockActualMap.get(item.productId);
                const cantidadActual =
                  stockActualItem?.cantidad ?? item.cantidad;
                const cantidadVendida = item.cantidad - cantidadActual;

                return (
                  <tr key={item.productId} className="border-b border-line">
                    <td className="py-2 px-3 text-sm text-dim">
                      {producto?.name || item.productId}
                    </td>
                    <td className="py-2 px-3 text-sm text-dim text-right">
                      {item.cantidad}
                    </td>
                    <td
                      className={`py-2 px-3 text-sm font-medium text-right ${
                        cantidadActual < 0
                          ? 'text-danger'
                          : cantidadActual === 0
                            ? 'text-accent'
                            : 'text-ok'
                      }`}
                    >
                      {cantidadActual}
                    </td>
                    <td className="py-2 px-3 text-sm font-medium text-brand text-right">
                      {cantidadVendida > 0 ? `-${cantidadVendida}` : '0'}
                    </td>
                  </tr>
                );
              })}

              {/* Productos vendidos que no estaban en stock inicial */}
              {(diaActivo.stockActual || [])
                .filter((s) => !stockInicialIds.has(s.productId))
                .map((item) => {
                  const producto = productoMap.get(item.productId);
                  return (
                    <tr
                      key={item.productId}
                      className="border-b border-line bg-danger/5"
                    >
                      <td className="py-2 px-3 text-sm text-dim">
                        {producto?.name || item.productId}
                        <span className="ml-2 text-xs text-danger">
                          (sin stock inicial)
                        </span>
                      </td>
                      <td className="py-2 px-3 text-sm text-dim text-right">
                        0
                      </td>
                      <td className="py-2 px-3 text-sm font-medium text-danger text-right">
                        {item.cantidad}
                      </td>
                      <td className="py-2 px-3 text-sm font-medium text-brand text-right">
                        {Math.abs(item.cantidad)}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
};
