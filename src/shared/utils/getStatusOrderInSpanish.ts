import { PurchaseOrderStatusEnum } from '@/shared/types/enumShared';

export function getStatusInSpanish(status: PurchaseOrderStatusEnum): string {
  const statusMap: Record<PurchaseOrderStatusEnum, string> = {
    [PurchaseOrderStatusEnum.PENDING]: 'Pendiente',
    [PurchaseOrderStatusEnum.APPROVED]: 'Aprobado',
    [PurchaseOrderStatusEnum.RECEIVED]: 'Recibido',
    [PurchaseOrderStatusEnum.CANCELED]: 'Cancelado',
    [PurchaseOrderStatusEnum.PARTIALLY_RECEIVED]: 'Recibido Parcialmente',
  };

  return statusMap[status] || status; // Devuelve el estado original si no se encuentra
}
