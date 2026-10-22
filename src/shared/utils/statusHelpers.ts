import { BadgeVariant } from '@/components/shared/badge/badge';
import {
  OrderStatusEnum,
  PaymentStatusEnum,
  PurchaseOrderStatusEnum,
} from '@/shared/types/enumShared';

/**
 * SOLID: Single Responsibility - Status variant mapping for Purchase Orders
 * Maps purchase order statuses to appropriate badge variants
 */
export function getStatusVariantPurchaseOrder(
  status: PurchaseOrderStatusEnum,
): BadgeVariant {
  switch (status) {
    case PurchaseOrderStatusEnum.PENDING:
      return 'warning';
    case PurchaseOrderStatusEnum.APPROVED:
      return 'info';
    case PurchaseOrderStatusEnum.RECEIVED:
      return 'success';
    case PurchaseOrderStatusEnum.CANCELED:
      return 'destructive';
    case PurchaseOrderStatusEnum.PARTIALLY_RECEIVED:
      return 'secondary';
    default:
      return 'default';
  }
}

/**
 * Maps order statuses to appropriate badge variants
 */
export function getStatusVariantOrder(status: OrderStatusEnum): BadgeVariant {
  switch (status) {
    case OrderStatusEnum.PENDING:
      return 'warning';
    case OrderStatusEnum.IN_PROGRESS:
      return 'info';
    case OrderStatusEnum.READY:
      return 'info';
    case OrderStatusEnum.DELIVERED:
      return 'success';
    case OrderStatusEnum.PAID:
      return 'success';
    case OrderStatusEnum.CREDIT:
      return 'info';
    case OrderStatusEnum.CANCELLED:
      return 'destructive';
    default:
      return 'default';
  }
}

/**
 * Maps payment statuses to appropriate badge variants
 */
export function getStatusVariantPayment(
  status: PaymentStatusEnum,
): BadgeVariant {
  switch (status) {
    case PaymentStatusEnum.PENDING:
      return 'warning';
    case PaymentStatusEnum.PARTIAL:
      return 'info';
    case PaymentStatusEnum.PAID:
      return 'success';
    case PaymentStatusEnum.REFUNDED:
      return 'secondary';
    default:
      return 'default';
  }
}
