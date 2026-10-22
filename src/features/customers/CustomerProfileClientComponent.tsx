'use client';

import { notFound } from 'next/navigation';
import { useCustomer } from '@/hooks/useCustomers';
import { useOrders } from '@/hooks/useOrders';
import { useAccountsReceivable } from '@/hooks/useAccountsReceivable';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/shared/card/card';
import { Badge } from '@/components/shared/badge/badge';
import { Button } from '@/components/shared/button/Button';
import Link from '@/shared/ui/AppLink/AppLink';
import { InvoiceStatusEnum } from '@/shared';
import { OrderItem } from '@odin6/types';
import { PRIVATE_ROUTES } from '@/shared/constantsRoutes/routes';
import EditCustomerButton from '@/features/customers/EditCustomerButton';
import { formatearUsd } from '@/shared/utils/dinero';

interface CustomerProfileClientComponentProps {
  id: string;
}

export default function CustomerProfileClientComponent({
  id,
}: CustomerProfileClientComponentProps) {
  const { data: customer, isLoading } = useCustomer(id);
  const { data: allOrders = [] } = useOrders();
  const { data: accountsReceivable = [] } = useAccountsReceivable();

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-dim">Cargando cliente...</div>
        </div>
      </div>
    );
  }

  if (!customer) {
    return notFound();
  }

  // Filter orders for this customer
  const customerOrders = allOrders.filter(
    (order) => order.customerId === customer.id,
  );

  // Filter receivables for this customer
  const customerReceivables = accountsReceivable.filter(
    (ar) => ar.customerId === customer.id,
  );

  // Calculate analytics
  const totalSpent = customerOrders.reduce(
    (sum, order) => sum + order.total,
    0,
  );
  const totalPending = customerReceivables.reduce(
    (sum, ar) => sum + (ar.amount - ar.paidAmount),
    0,
  );
  const orderCount = customerOrders.length;

  // Get last order
  const lastOrder =
    customerOrders.length > 0
      ? customerOrders.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )[0]
      : null;

  // Calculate favorite products
  const productCount: Record<
    string,
    { count: number; name: string; lastOrdered: Date }
  > = {};

  customerOrders.forEach((order) => {
    if (order.items) {
      order.items.forEach((item: OrderItem) => {
        if (productCount[item.productId]) {
          productCount[item.productId].count += item.quantity;
          if (
            new Date(order.createdAt) > productCount[item.productId].lastOrdered
          ) {
            productCount[item.productId].lastOrdered = new Date(
              order.createdAt,
            );
          }
        } else {
          productCount[item.productId] = {
            count: item.quantity,
            name: item.name,
            lastOrdered: new Date(order.createdAt),
          };
        }
      });
    }
  });

  const favoriteProducts = Object.entries(productCount)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 5);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('es-VE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: InvoiceStatusEnum) => {
    switch (status) {
      case InvoiceStatusEnum.PAID:
        return <Badge variant="success">Pagado</Badge>;
      case InvoiceStatusEnum.PENDING:
        return <Badge variant="destructive">Pendiente</Badge>;
      case InvoiceStatusEnum.PARTIALLY_PAID:
        return <Badge variant="warning">Parcial</Badge>;
      case InvoiceStatusEnum.OVERDUE:
        return <Badge variant="destructive">Vencido</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold text-content mb-2">
            Perfil de {customer.name}
          </h1>
          <p className="text-dim">Información detallada del cliente</p>
        </div>
        <div className="flex gap-2">
          <Link href={PRIVATE_ROUTES.CUSTOMERS}>
            <Button variant="outline">Volver</Button>
          </Link>
          <EditCustomerButton customerId={id} />
        </div>
      </div>

      {/* Customer Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-page to-elevated border-line">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-dim">Total Gastado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-brand">
              {formatearUsd(totalSpent)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-surface/80 border-ok/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-dim">Órdenes Totales</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-ok">{orderCount}</p>
          </CardContent>
        </Card>

        <Card className="bg-surface/80 border-danger/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-dim">Deuda Pendiente</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-danger">
              {formatearUsd(totalPending)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-surface/80 border-accent/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-dim">
              Promedio por Orden
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-accent">
              {formatearUsd(orderCount > 0 ? totalSpent / orderCount : 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer Basic Info */}
        <div>
          <Card className="bg-surface/95 backdrop-blur-sm border-line shadow-lg mb-6">
            <CardHeader className="bg-gradient-to-r from-page to-elevated border-b border-line">
              <CardTitle className="text-content">Información Básica</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div>
                <label className="text-sm font-medium text-dim">Nombre</label>
                <p className="text-lg font-semibold text-content">
                  {customer.name}
                </p>
              </div>

              {customer.phone && (
                <div>
                  <label className="text-sm font-medium text-dim">
                    Teléfono
                  </label>
                  <p className="text-content">{customer.phone}</p>
                </div>
              )}

              {customer.email && (
                <div>
                  <label className="text-sm font-medium text-dim">Email</label>
                  <p className="text-content">{customer.email}</p>
                </div>
              )}

              {customer.identificationType && customer.identificationId && (
                <div>
                  <label className="text-sm font-medium text-dim">
                    Identificación
                  </label>
                  <p className="text-content">
                    {customer.identificationType}-{customer.identificationId}
                  </p>
                </div>
              )}

              {customer.address && (
                <div>
                  <label className="text-sm font-medium text-dim">
                    Dirección
                  </label>
                  <p className="text-content">{customer.address}</p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-dim">Estado</label>
                <Badge variant={customer.isActive ? 'success' : 'destructive'}>
                  {customer.isActive ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>

              <div>
                <label className="text-sm font-medium text-dim">
                  Cliente desde
                </label>
                <p className="text-content">{formatDate(customer.createdAt)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Favorite Products */}
          <Card className="bg-surface/95 backdrop-blur-sm border-line shadow-lg">
            <CardHeader className="border-b border-accent/20">
              <CardTitle className="text-accent">Productos Favoritos</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {favoriteProducts.length > 0 ? (
                <div className="space-y-3">
                  {favoriteProducts.map(([productId, product], index) => (
                    <div
                      key={productId}
                      className="flex items-center justify-between p-3 bg-elevated rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-content">
                          {product.name}
                        </p>
                        <p className="text-sm text-dim">
                          Última vez: {formatDate(product.lastOrdered)}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant="secondary">#{index + 1}</Badge>
                        <p className="text-sm text-accent font-medium">
                          {product.count} veces
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-dim text-center py-4">
                  No hay productos ordenados aún
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Orders History and Accounts Receivable */}
        <div className="lg:col-span-2 space-y-6">
          {/* Last Order */}
          {lastOrder && (
            <Card className="bg-surface/95 backdrop-blur-sm border-line shadow-lg">
              <CardHeader className="border-b border-ok/20">
                <CardTitle className="text-ok">Última Orden</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-dim">
                      Fecha
                    </label>
                    <p className="text-lg font-semibold text-content">
                      {formatDate(lastOrder.createdAt)}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-dim">
                      Total
                    </label>
                    <p className="text-lg font-semibold text-ok">
                      {formatearUsd(lastOrder.total)}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-dim">
                      Estado
                    </label>
                    <p className="text-lg font-semibold text-content capitalize">
                      {lastOrder.status.replace('_', ' ')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Orders */}
          <Card className="bg-surface/95 backdrop-blur-sm border-line shadow-lg">
            <CardHeader className="bg-gradient-to-r from-page to-elevated border-b border-line">
              <CardTitle className="text-content">
                Historial de Órdenes Recientes
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {customerOrders.length > 0 ? (
                <div className="space-y-3">
                  {customerOrders
                    .sort(
                      (a, b) =>
                        new Date(b.createdAt).getTime() -
                        new Date(a.createdAt).getTime(),
                    )
                    .slice(0, 5)
                    .map((order) => (
                      <div
                        key={order.id}
                        className="flex items-center justify-between p-4 bg-elevated rounded-lg hover:bg-elevated transition-colors"
                      >
                        <div>
                          <p className="font-medium text-content">
                            Orden #{order.id.slice(-8)}
                          </p>
                          <p className="text-sm text-dim">
                            {formatDate(order.createdAt)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-brand">
                            {formatearUsd(order.total)}
                          </p>
                          <Badge variant="secondary" className="text-xs">
                            {order.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-dim text-center py-4">
                  No hay órdenes registradas
                </p>
              )}

              {customerOrders.length > 5 && (
                <div className="mt-4 pt-4 border-t border-line">
                  <Button variant="outline" className="w-full">
                    Ver Todas las Órdenes ({customerOrders.length})
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Accounts Receivable */}
          <Card className="bg-surface/95 backdrop-blur-sm border-line shadow-lg">
            <CardHeader className="border-b border-danger/20">
              <CardTitle className="text-danger">Cuentas por Cobrar</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {customerReceivables.length > 0 ? (
                <div className="space-y-3">
                  {customerReceivables.map((receivable) => (
                    <Link
                      key={receivable.id}
                      href={PRIVATE_ROUTES.ACCOUNTS_RECEIVABLE_DETAILS(
                        receivable.id,
                      )}
                      className="block"
                    >
                      <div className="flex items-center justify-between p-4 bg-elevated rounded-lg hover:bg-elevated transition-colors">
                        <div>
                          <p className="font-medium text-content">
                            Factura #{receivable.invoiceNumber}
                          </p>
                          <p className="text-sm text-dim">
                            Vence: {formatDate(receivable.dueDate)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-danger">
                            {formatearUsd(
                              receivable.amount - receivable.paidAmount,
                            )}
                          </p>
                          {getStatusBadge(receivable.status)}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-dim text-center py-4">
                  No hay cuentas pendientes
                </p>
              )}

              {customerReceivables.length > 0 && (
                <div className="mt-4 pt-4 border-t border-line">
                  <Link
                    href={`${PRIVATE_ROUTES.ACCOUNTS_RECEIVABLE}?query=${customer.name}`}
                  >
                    <Button variant="outline" className="w-full">
                      Ver Todas las Cuentas por Cobrar
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
