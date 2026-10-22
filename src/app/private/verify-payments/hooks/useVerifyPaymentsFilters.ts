import { useMemo, useState } from 'react';
import { Order } from '@odin6/types';
import { coincideTexto, prepararBusqueda } from '@/shared/utils/busquedaTexto';

interface UseVerifyPaymentsFiltersProps {
  pendingOrders: Order[];
  allUsers: Array<{ id: string; name: string }>;
}

const shortOrderId = (o: Order): string =>
  o.orderNumber ?? o.id.slice(-8).toUpperCase();

export const useVerifyPaymentsFilters = ({
  pendingOrders,
  allUsers,
}: UseVerifyPaymentsFiltersProps) => {
  const [filterWaiter, setFilterWaiter] = useState('all');
  const [filterMethod, setFilterMethod] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const hasActiveFilter = useMemo(
    () =>
      filterWaiter !== 'all' || filterMethod !== 'all' || !!searchTerm.trim(),
    [filterWaiter, filterMethod, searchTerm],
  );

  const filteredOrders = useMemo(() => {
    // Una sola vez por búsqueda, no una por orden: quitar tildes es lo caro.
    const busqueda = prepararBusqueda(searchTerm);
    return pendingOrders.filter((o) => {
      if (filterWaiter !== 'all' && o.waiterId !== filterWaiter) return false;
      if (filterMethod !== 'all') {
        const methods =
          o.pendingPayments && o.pendingPayments.length > 0
            ? o.pendingPayments.map((p) => p.method)
            : [o.paymentMethod];
        if (!methods.includes(filterMethod as never)) return false;
      }
      if (
        !coincideTexto(
          [
            allUsers.find((w) => w.id === o.waiterId)?.name,
            o.tableName,
            shortOrderId(o),
          ],
          busqueda,
        )
      ) {
        return false;
      }
      return true;
    });
  }, [pendingOrders, filterWaiter, filterMethod, searchTerm, allUsers]);

  const clearFilters = () => {
    setFilterWaiter('all');
    setFilterMethod('all');
    setSearchTerm('');
  };

  return {
    filterWaiter,
    setFilterWaiter,
    filterMethod,
    setFilterMethod,
    searchTerm,
    setSearchTerm,
    hasActiveFilter,
    filteredOrders,
    clearFilters,
  };
};
