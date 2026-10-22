'use client';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { OrderStatusEnum, UserRoleEnum } from '@/shared/types/enumShared';
import { EmptyState } from '@/components/shared/EmptyState/EmptyState';
import { useToast } from '@/shared/hooks/useToast';
import { Loader } from '@/shared';
import { useOrders } from '@/hooks';
import { Order } from '@odin6/types';

export default function SalesPage() {
  const { data: session, status } = useSession();
  const { data: orders = [], isLoading } = useOrders();
  const [filteredOrdersCount, _setFilteredOrdersCount] = useState(0);
  const { error: _error } = useToast();
  // Verificar autenticación
  if (status === 'loading') {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader />
      </div>
    );
  }

  if (!session?.user) {
    return (
      <EmptyState
        title="Acceso denegado"
        description="Debes iniciar sesión para ver esta página"
        icon="🔒"
        actionLabel={''}
        actionHref={''}
      />
    );
  }

  const userRole = session.user.role as UserRoleEnum;

  // Filtrar órdenes según el rol
  const getOrdersForRole = (role: UserRoleEnum, allOrders: Order[]) => {
    switch (role) {
      case UserRoleEnum.KITCHEN:
        // Para cocina: solo órdenes pendientes, en progreso y listas
        return allOrders.filter((order) =>
          [
            OrderStatusEnum.PENDING,
            OrderStatusEnum.IN_PROGRESS,
            OrderStatusEnum.READY,
          ].includes(order.status),
        );
      case UserRoleEnum.ADMIN:
      case UserRoleEnum.CASHIER:
      case UserRoleEnum.MANAGER:
        // Para admin/cajero: todas las órdenes
        return allOrders;
      default:
        return [];
    }
  };

  const filteredOrders = getOrdersForRole(userRole, orders);

  // Renderizar vista según el rol
  const renderOrdersView = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center p-8">
          <Loader />
        </div>
      );
    }

    if (filteredOrders.length === 0 && !isLoading) {
      return (
        <EmptyState
          title="No hay órdenes"
          description="No se encontraron órdenes para mostrar"
          icon="📋"
          actionLabel={''}
          actionHref={''}
        />
      );
    }

    switch (userRole) {
      case UserRoleEnum.KITCHEN:
        return null; /* (
          //TODO:
          <KitchenOrdersView
            orders={filteredOrders}
            onOrderAction={handleKitchenOrderAction}
            loading={loading}
          />
        );*/

      case UserRoleEnum.ADMIN:
      case UserRoleEnum.CASHIER:
      case UserRoleEnum.MANAGER:
        return null;

      default:
        return (
          <EmptyState
            title="Acceso no autorizado"
            description="Tu rol no tiene permisos para ver las órdenes"
            icon="⚠️"
            actionLabel={''}
            actionHref={''}
          />
        );
    }
  };

  const getPageTitle = () => {
    switch (userRole) {
      case UserRoleEnum.KITCHEN:
        return 'Órdenes de Cocina';
      case UserRoleEnum.ADMIN:
      case UserRoleEnum.CASHIER:
      case UserRoleEnum.MANAGER:
        return 'Gestión de Ventas';
      default:
        return 'Ventas';
    }
  };

  return (
    <div className="min-h-screen bg-elevated">
      {/* Header */}
      <div className="bg-surface shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-content">
                {getPageTitle()}
              </h1>
              <p className="text-dim">
                {userRole === UserRoleEnum.KITCHEN
                  ? 'Gestiona las órdenes de la cocina'
                  : 'Vista general de todas las órdenes'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-dim">
                {userRole === UserRoleEnum.KITCHEN
                  ? filteredOrders.length
                  : filteredOrdersCount || filteredOrders.length}{' '}
                orden
                {(userRole === UserRoleEnum.KITCHEN
                  ? filteredOrders.length
                  : filteredOrdersCount || filteredOrders.length) !== 1
                  ? 'es'
                  : ''}
              </span>
              <button
                className="px-3 py-1 text-sm bg-brand/15 text-brand rounded hover:bg-brand/25 transition-colors"
                disabled={isLoading}
              >
                {isLoading ? 'Actualizando...' : 'Actualizar'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <main className="max-w-7xl mx-auto">{renderOrdersView()}</main>
    </div>
  );
}
