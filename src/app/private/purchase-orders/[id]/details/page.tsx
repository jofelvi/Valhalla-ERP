'use client';
import { useParams } from 'next/navigation';
import { getRouteParam } from '@/shared/utils/routeParams';
import Link from 'next/link';
import { usePurchaseOrder } from '@/hooks/usePurchaseOrders';
import { useSupplier } from '@/hooks/useSuppliers';
import { getStatusVariantPurchaseOrder } from '@/shared/utils/getStatusVariantPurchaseOrder';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/shared/card/card';
import { Badge } from '@/components/shared/badge/badge';
import { formatDate, formatDateTime } from '@/shared/utils/dateHelpers';
import { PRIVATE_ROUTES } from '@/shared/constantsRoutes/routes';
import { Button } from '@/components/shared/button/Button';
import {
  ArrowLeft,
  Edit,
  Package,
  FileText,
  ExternalLink,
  Loader2,
} from 'lucide-react';

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const id = getRouteParam(params.id);

  const { data: orderData, isLoading: isLoadingOrder } = usePurchaseOrder(id);
  const { data: supplier, isLoading: isLoadingSupplier } = useSupplier(
    orderData?.supplierId || '',
  );

  if (isLoadingOrder || isLoadingSupplier) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-brand" />
          <p className="text-content">Cargando orden...</p>
        </div>
      </div>
    );
  }

  if (!orderData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold text-content">
            Orden no encontrada
          </p>
          <Link href={PRIVATE_ROUTES.PURCHASE_ORDERS}>
            <Button className="mt-4">Volver a Órdenes</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Enrich order items with product names (placeholder until we add useProducts hook)
  const enrichedItems = orderData.items.map((item) => {
    return {
      ...item,
      productName: item.productName || 'Producto no encontrado',
    };
  });

  const order = {
    ...orderData,
    items: enrichedItems,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated">
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-brand to-accent bg-clip-text text-transparent">
              Detalle de Orden de Compra
            </h1>
            <p className="text-brand/80 mt-1">
              Información completa de la orden #{order.id.slice(0, 8)}
            </p>
          </div>
          <div className="flex space-x-3">
            {order.status === 'pending' && (
              <Link href={PRIVATE_ROUTES.PURCHASE_ORDERS_RECEIVE(order.id)}>
                <Button>
                  <Package className="w-4 h-4 mr-2" />
                  Recibir Pedido
                </Button>
              </Link>
            )}
            <Link href={PRIVATE_ROUTES.PURCHASE_ORDERS_EDIT(order.id)}>
              <Button variant="outline">
                <Edit className="w-4 h-4 mr-2" />
                Editar
              </Button>
            </Link>
            <Link href={PRIVATE_ROUTES.PURCHASE_ORDERS}>
              <Button variant="ghost">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver
              </Button>
            </Link>
          </div>
        </div>

        <Card className="bg-surface/90 backdrop-blur-sm shadow-xl border border-line/50">
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span className="text-content">
                Orden #{order.id.slice(0, 8)}
              </span>
              <Badge variant={getStatusVariantPurchaseOrder(order.status)}>
                {order.status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-page to-elevated p-4 rounded-xl border border-line">
                <p className="text-sm font-semibold text-brand mb-1">
                  Proveedor
                </p>
                <p className="font-bold text-content">
                  {supplier?.name || order.supplierId}
                </p>
              </div>
              <div className="bg-gradient-to-br from-surface to-elevated p-4 rounded-xl border border-ok/20">
                <p className="text-sm font-semibold text-brand mb-1">Total</p>
                <p className="font-bold text-ok text-lg">
                  {order.currency} {order.totalAmount.toFixed(2)}
                </p>
              </div>
              <div className="bg-gradient-to-br from-page to-elevated p-4 rounded-xl border border-brand/20">
                <p className="text-sm font-semibold text-brand mb-1">
                  Fecha de Creación
                </p>
                <p className="font-bold text-brand">
                  {orderData.createdAt
                    ? formatDateTime(orderData.createdAt)
                    : 'N/A'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {orderData.expectedDeliveryDate && (
                <div className="bg-gradient-to-br from-accent/10 to-accent/5 p-4 rounded-xl border border-accent/20">
                  <p className="text-sm font-semibold text-accent mb-1">
                    Fecha Esperada de Entrega
                  </p>
                  <p className="font-bold text-accent">
                    {formatDate(orderData.expectedDeliveryDate)}
                  </p>
                </div>
              )}

              {orderData.receivedAt && (
                <div className="bg-gradient-to-br from-ok/10 to-ok/5 p-4 rounded-xl border border-ok/20">
                  <p className="text-sm font-semibold text-ok mb-1">
                    Fecha de Recepción
                  </p>
                  <p className="font-bold text-ok">
                    {formatDateTime(orderData.receivedAt)}
                  </p>
                </div>
              )}
            </div>

            {/* Adjunto — Orden de compra / Factura */}
            {orderData.imageUrl && (
              <div className="bg-gradient-to-br from-brand/10 to-brand/5 p-4 rounded-xl border border-brand">
                <p className="text-sm font-semibold text-brand mb-3 flex items-center gap-1.5">
                  <FileText className="w-4 h-4" />
                  Orden / Factura Adjunta
                </p>
                {/\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(orderData.imageUrl) ? (
                  <a
                    href={orderData.imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <img
                      src={orderData.imageUrl}
                      alt="Adjunto de orden"
                      className="max-h-64 rounded-lg border border-brand object-contain hover:opacity-90 transition-opacity"
                    />
                    <span className="mt-2 inline-flex items-center gap-1 text-xs text-brand hover:underline">
                      <ExternalLink className="w-3 h-3" /> Abrir en pantalla
                      completa
                    </span>
                  </a>
                ) : (
                  <a
                    href={orderData.imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-surface border border-brand rounded-lg text-sm font-medium text-brand hover:bg-brand/15 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    Ver documento adjunto
                    <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                  </a>
                )}
              </div>
            )}

            <div className="mt-8">
              <h3 className="text-xl font-bold text-content mb-4">
                Productos de la Orden
              </h3>
              <div className="overflow-x-auto bg-surface/90 backdrop-blur-sm rounded-2xl shadow-lg border border-line/50">
                <table className="min-w-full divide-y divide-brand">
                  <thead className="bg-gradient-to-r from-page to-elevated">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-dim uppercase tracking-wider">
                        Producto
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-dim uppercase tracking-wider">
                        Cantidad
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-dim uppercase tracking-wider">
                        Costo Unitario
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-dim uppercase tracking-wider">
                        Subtotal
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-surface/80 divide-y divide-brand">
                    {order.items.map((item, index) => (
                      <tr
                        key={index}
                        className="hover:bg-elevated/50 transition-colors duration-200"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-semibold text-content">
                            {item.productName || 'Producto sin nombre'}
                          </div>
                          {item.productId && (
                            <div className="text-xs text-brand mt-1">
                              ID: {item.productId}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-content font-medium">
                          {item.quantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-content font-medium">
                          {order.currency} {item.unitCost.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-content font-semibold">
                          {order.currency} {item.subtotal.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
