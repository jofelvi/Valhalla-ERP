import { useMemo } from 'react';
import {
  aFecha,
  getDateRange,
  getStartOfDay,
  getEndOfDay,
} from '@/shared/utils/dateHelpers';
import { Order } from '@/modelTypes/order';
import { OrderStatusEnum, DateFilterEnum, UserRoleEnum } from '@/shared';
import { useUserStore } from '@/shared/store/useUserStore';
import { coincideTexto, prepararBusqueda } from '@/shared/utils/busquedaTexto';

interface FilteredOrdersResult {
  orders: Order[];
  statusFilteredOrders: Order[];
  filteredOrders: Order[];
}

export function useOrdersFiltering(
  allOrders: Order[],
  statusFilter: OrderStatusEnum | 'ALL',
  dateFilter: DateFilterEnum,
  customDate: string,
  searchTerm: string,
  getTableName: (tableId: string) => string,
  customerById: Map<string, string>,
): FilteredOrdersResult {
  const { user } = useUserStore();

  // Filtrar por rango de fechas
  const orders = useMemo(() => {
    let startDate: Date;
    let endDate: Date;

    if (dateFilter === DateFilterEnum.CUSTOM) {
      const selectedDate = new Date(customDate + 'T00:00:00');
      startDate = getStartOfDay(selectedDate);
      endDate = getEndOfDay(selectedDate);
    } else {
      const range = getDateRange(dateFilter);
      startDate = range.startDate;
      endDate = range.endDate;
    }

    let filtered = allOrders.filter((o) => {
      if (!o.createdAt) return false;
      const date = aFecha(o.createdAt);
      return date >= startDate && date <= endDate;
    });

    // Filtrar por rol
    if (user?.role === UserRoleEnum.CUSTOMER) {
      filtered = filtered.filter((o) => o.customerId === user.id);
    }

    return filtered.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [allOrders, dateFilter, customDate, user]);

  // Filtrar por estado
  const statusFilteredOrders = useMemo(() => {
    return orders.filter(
      (order) => statusFilter === 'ALL' || order.status === statusFilter,
    );
  }, [orders, statusFilter]);

  // Filtro final: búsqueda activa ignora estado
  const filteredOrders = useMemo(() => {
    if (!searchTerm.trim()) {
      return statusFilteredOrders;
    }

    // Una sola vez por búsqueda, no una por orden: preparar el texto quita
    // tildes y eso es lo caro.
    const busqueda = prepararBusqueda(searchTerm);

    const matchesSearch = (order: Order): boolean =>
      coincideTexto(
        [
          order.id,
          order.orderNumber,
          order.tableId ? getTableName(order.tableId) : '',
          order.customerAlias,
          order.customerId ? (customerById.get(order.customerId) ?? '') : '',
          order.notes,
          ...order.items.map((item) => item.name),
        ],
        busqueda,
      );

    return orders.filter(matchesSearch);
  }, [searchTerm, orders, statusFilteredOrders, getTableName, customerById]);

  return {
    orders,
    statusFilteredOrders,
    filteredOrders,
  };
}
