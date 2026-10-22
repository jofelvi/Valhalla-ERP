import { useState } from 'react';
import { Order } from '@/modelTypes/order';
import { TableStatusEnum, ZoneSectorEnum } from '@/shared';
import { useUpdateTable } from '@/hooks/useTables';
import { useUpdateOrder } from '@/hooks/useOrders';
import { TableWithOrder } from '../types';

interface TranspasoState {
  transferOrder: Order | null;
  transferSourceTable: TableWithOrder | null;
  transferZoneOrder: Order | null;
  isTransferring: boolean;
}

interface TranspasoActions {
  openTransferFromTable: (table: TableWithOrder) => void;
  closeTransfer: () => void;
  openTransferFromZone: (order: Order) => void;
  closeZoneTransfer: () => void;
  handleTransferToTable: (destTable: TableWithOrder) => Promise<void>;
  handleTransferToSector: (sector: ZoneSectorEnum) => Promise<void>;
  handleZoneTransferToTable: (destTable: TableWithOrder) => Promise<void>;
  handleZoneTransferToSector: (sector: ZoneSectorEnum) => Promise<void>;
  handleZoneTransferWaiter: (waiterId: string) => Promise<void>;
}

export const useTraspaso = (
  onRefetch: () => void,
  waiters: Array<{ id: string; name?: string }>,
): TranspasoState & TranspasoActions => {
  const [transferOrder, setTransferOrder] = useState<Order | null>(null);
  const [transferSourceTable, setTransferSourceTable] =
    useState<TableWithOrder | null>(null);
  const [transferZoneOrder, setTransferZoneOrder] = useState<Order | null>(
    null,
  );
  const [isTransferring, setIsTransferring] = useState(false);

  const updateOrder = useUpdateOrder();
  const updateTable = useUpdateTable();

  const openTransferFromTable = (table: TableWithOrder) => {
    if (!table.currentOrder) return;
    setTransferSourceTable(table);
    setTransferOrder(table.currentOrder);
  };

  const closeTransfer = () => {
    setTransferSourceTable(null);
    setTransferOrder(null);
  };

  const openTransferFromZone = (order: Order) => {
    setTransferZoneOrder(order);
  };

  const closeZoneTransfer = () => {
    setTransferZoneOrder(null);
  };

  const handleTransferToTable = async (destTable: TableWithOrder) => {
    if (!transferOrder || !transferSourceTable || isTransferring) return;
    setIsTransferring(true);
    try {
      await Promise.all([
        updateOrder.mutateAsync({
          id: transferOrder.id,
          data: {
            tableId: destTable.id,
            sector: null,
            updatedAt: new Date(),
          },
        }),
        updateTable.mutateAsync({
          id: transferSourceTable.id,
          data: {
            orderId: null,
            status: TableStatusEnum.ISAVAILABLE,
            isAvailable: true,
          },
        }),
        updateTable.mutateAsync({
          id: destTable.id,
          data: {
            orderId: transferOrder.id,
            status: TableStatusEnum.OCCUPIED,
            isAvailable: false,
          },
        }),
      ]);
      closeTransfer();
      onRefetch();
    } catch {
      // silencioso
    } finally {
      setIsTransferring(false);
    }
  };

  const handleTransferToSector = async (sector: ZoneSectorEnum) => {
    if (!transferOrder || !transferSourceTable || isTransferring) return;
    setIsTransferring(true);
    try {
      await Promise.all([
        updateOrder.mutateAsync({
          id: transferOrder.id,
          data: {
            tableId: null,
            sector,
            updatedAt: new Date(),
          },
        }),
        updateTable.mutateAsync({
          id: transferSourceTable.id,
          data: {
            orderId: null,
            status: TableStatusEnum.ISAVAILABLE,
            isAvailable: true,
          },
        }),
      ]);
      closeTransfer();
      onRefetch();
    } catch {
      // silencioso
    } finally {
      setIsTransferring(false);
    }
  };

  const handleZoneTransferToTable = async (destTable: TableWithOrder) => {
    if (!transferZoneOrder || isTransferring) return;
    setIsTransferring(true);
    try {
      await Promise.all([
        updateOrder.mutateAsync({
          id: transferZoneOrder.id,
          data: {
            tableId: destTable.id,
            tableName: destTable.name,
            sector: null,
            updatedAt: new Date(),
          },
        }),
        updateTable.mutateAsync({
          id: destTable.id,
          data: {
            orderId: transferZoneOrder.id,
            status: TableStatusEnum.OCCUPIED,
            isAvailable: false,
          },
        }),
      ]);
      closeZoneTransfer();
      onRefetch();
    } catch {
      // silencioso
    } finally {
      setIsTransferring(false);
    }
  };

  const handleZoneTransferToSector = async (sector: ZoneSectorEnum) => {
    if (!transferZoneOrder || isTransferring) return;
    setIsTransferring(true);
    try {
      await updateOrder.mutateAsync({
        id: transferZoneOrder.id,
        data: {
          sector,
          updatedAt: new Date(),
        },
      });
      closeZoneTransfer();
      onRefetch();
    } catch {
      // silencioso
    } finally {
      setIsTransferring(false);
    }
  };

  const handleZoneTransferWaiter = async (newWaiterId: string) => {
    if (!transferZoneOrder || isTransferring) return;
    setIsTransferring(true);
    try {
      const waiter = waiters.find((w) => w.id === newWaiterId);
      await updateOrder.mutateAsync({
        id: transferZoneOrder.id,
        data: {
          waiterId: newWaiterId,
          waiterName: waiter?.name ?? null,
          updatedAt: new Date(),
        },
      });
      closeZoneTransfer();
      onRefetch();
    } catch {
      // silencioso
    } finally {
      setIsTransferring(false);
    }
  };

  return {
    transferOrder,
    transferSourceTable,
    transferZoneOrder,
    isTransferring,
    openTransferFromTable,
    closeTransfer,
    openTransferFromZone,
    closeZoneTransfer,
    handleTransferToTable,
    handleTransferToSector,
    handleZoneTransferToTable,
    handleZoneTransferToSector,
    handleZoneTransferWaiter,
  };
};
