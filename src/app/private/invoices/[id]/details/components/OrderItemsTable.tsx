'use client';
import { Package, ShoppingCart } from 'lucide-react';
import { EnrichedOrderItem } from '../types';

interface OrderItemsTableProps {
  items: EnrichedOrderItem[];
}

export const OrderItemsTable: React.FC<OrderItemsTableProps> = ({ items }) => {
  return (
    <div>
      <h3 className="text-lg font-semibold text-content mb-4 flex items-center gap-2">
        <ShoppingCart className="h-5 w-5" />
        Productos de la Orden
      </h3>
      <div className="overflow-x-auto bg-surface/90 backdrop-blur-sm rounded-2xl shadow-lg border border-line/50">
        <table className="min-w-full divide-y divide-brand/10">
          <thead className="bg-gradient-to-r from-page to-elevated">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-dim uppercase tracking-wider">
                Producto
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-dim uppercase tracking-wider">
                Cantidad
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-dim uppercase tracking-wider">
                Precio Unitario
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-dim uppercase tracking-wider">
                Notas
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-dim uppercase tracking-wider">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="bg-surface/80 divide-y divide-brand/5">
            {items.length > 0 ? (
              items.map((item, index) => (
                <tr
                  key={index}
                  className="hover:bg-elevated/50 transition-colors duration-200"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-brand to-brand/80 rounded-lg flex items-center justify-center">
                        <Package className="h-4 w-4 text-brand" />
                      </div>
                      <div>
                        <div className="font-semibold text-content">
                          {item.product?.name ||
                            item.name ||
                            'Producto no encontrado'}
                        </div>
                        {item.product?.sku && (
                          <div className="text-xs text-brand">
                            SKU: {item.product.sku}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-content font-medium text-center">
                    {item.quantity || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-content font-medium">
                    ${(item.unitPrice || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4">
                    {item.notes ? (
                      <div className="text-xs text-dim italic">
                        {item.notes}
                      </div>
                    ) : (
                      <span className="text-dim">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-content font-semibold">
                    ${((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center">
                  <div className="text-brand">
                    No hay productos en esta orden
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
