'use client';
export const dynamic = 'force-dynamic';
import { useMemo } from 'react';
import { useUserStore } from '@/shared/store/useUserStore';
import { useCustomerCartStore } from '@/shared/store/useCustomerCartStore';
import { CheckCircle, Clock, ShoppingBag, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { CUSTOMER_ROUTES } from '@/shared';
import { useOrders } from '@/hooks';

export default function CustomerDashboard() {
  const { user } = useUserStore();
  const { items, getTotalPrice, getTotalItems } = useCustomerCartStore();
  const { data: allOrders = [], isLoading } = useOrders();

  const orders = useMemo(
    () =>
      user?.id ? allOrders.filter((order) => order.customerId === user.id) : [],
    [user?.id, allOrders],
  );

  // Calculate real order statistics
  const pendingOrders = orders.filter(
    (order) => order.status === 'PENDING',
  ).length;

  const completedOrders = orders.filter(
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    (order) => order.status === 'COMPLETED' || order.paymentStatus === 'paid',
  ).length;

  const stats = [
    {
      name: 'Carrito Actual',
      value: getTotalItems(),
      icon: ShoppingBag,
      color: 'bg-gradient-to-r from-teal-500 to-cyan-500',
      href: CUSTOMER_ROUTES.CATALOG,
    },
    {
      name: 'Total en Carrito',
      value: `$${getTotalPrice().toFixed(2)}`,
      icon: TrendingUp,
      color: 'bg-gradient-to-r from-emerald-500 to-teal-500',
      href: CUSTOMER_ROUTES.CATALOG,
    },
    {
      name: 'Pedidos Pendientes',
      value: isLoading ? '...' : pendingOrders.toString(),
      icon: Clock,
      color: 'bg-gradient-to-r from-amber-500 to-orange-500',
      href: CUSTOMER_ROUTES.CURRENT_ORDER,
    },
    {
      name: 'Pedidos Completados',
      value: isLoading ? '...' : completedOrders.toString(),
      icon: CheckCircle,
      color: 'bg-gradient-to-r from-cyan-500 to-teal-600',
      href: CUSTOMER_ROUTES.HISTORY,
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-teal-900">
          ¡Hola, {user?.name}!
        </h1>
        <p className="mt-2 text-brand">
          Aquí puedes ver tu actividad y realizar nuevos pedidos.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.name}
              href={stat.href}
              className="bg-surface/80 backdrop-blur-sm rounded-xl shadow-sm border border-teal-200 p-6 hover:shadow-lg hover:border-teal-300 transition-all duration-200"
            >
              <div className="flex items-center">
                <div className={`${stat.color} rounded-xl p-3 shadow-lg`}>
                  <Icon className="h-6 w-6 text-on-brand" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-brand">{stat.name}</p>
                  <p className="text-2xl font-bold text-teal-900">
                    {stat.value}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface/80 backdrop-blur-sm rounded-xl shadow-sm border border-teal-200 p-6">
          <h2 className="text-lg font-semibold text-teal-900 mb-4">
            Acciones Rápidas
          </h2>
          <div className="space-y-3">
            <Link
              href={CUSTOMER_ROUTES.CATALOG}
              className="flex items-center justify-between p-3 border border-teal-200 rounded-xl hover:bg-teal-50 transition-all duration-200"
            >
              <div className="flex items-center">
                <ShoppingBag className="h-5 w-5 text-brand mr-3" />
                <span className="font-medium text-teal-900">Ver Productos</span>
              </div>
              <span className="text-brand">→</span>
            </Link>

            <Link
              href={CUSTOMER_ROUTES.HISTORY}
              className="flex items-center justify-between p-3 border border-teal-200 rounded-xl hover:bg-teal-50 transition-all duration-200"
            >
              <div className="flex items-center">
                <Clock className="h-5 w-5 text-brand mr-3" />
                <span className="font-medium text-teal-900">
                  Historial de Pedidos
                </span>
              </div>
              <span className="text-brand">→</span>
            </Link>
          </div>
        </div>

        {items.length > 0 && (
          <div className="bg-surface/80 backdrop-blur-sm rounded-xl shadow-sm border border-teal-200 p-6">
            <h2 className="text-lg font-semibold text-teal-900 mb-4">
              Tu Carrito
            </h2>
            <div className="space-y-3">
              {items.slice(0, 3).map((item) => (
                <div
                  key={item.product.id}
                  className="flex justify-between items-center p-2 bg-teal-50 rounded-lg border border-teal-100"
                >
                  <span className="text-sm font-medium text-teal-900">
                    {item.product.name}
                  </span>
                  <div className="text-sm text-brand">
                    {item.quantity}x ${item.product.price.toFixed(2)}
                  </div>
                </div>
              ))}
              {items.length > 3 && (
                <p className="text-sm text-brand">
                  +{items.length - 3} productos más
                </p>
              )}
              <Link
                href={CUSTOMER_ROUTES.CATALOG}
                className="block w-full text-center bg-gradient-to-r from-teal-500 to-cyan-500 text-on-brand py-2 rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all duration-200 mt-4 shadow-md shadow-teal-500/20"
              >
                Ver Carrito Completo
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
