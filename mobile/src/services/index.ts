export { categoryService } from './categoryService';
export { productService } from './productService';
export { availabilityService } from './availabilityService';
export { orderService } from './orderService';
export {
  kitchenOrderService,
  flattenPendingItems,
} from './kitchenOrderService';
export type { Station, PendingStationItem } from './kitchenOrderService';
export { customerService } from './customerService';
export { notificationService } from './notificationService';
export { tableService } from './tableService';
export { invoiceService } from './invoiceService';
export { paymentService, genPaymentRequestId } from './paymentService';
export { uploadPaymentProofs } from './storageService';
export { locationService } from './locationService';
export { attendanceService } from './attendanceService';
export { chatService } from './chatService';
export { waiterAssignmentService } from './waiterAssignmentService';
export { adminPinService } from './adminPinService';
export { comisionesService } from './comisionesService';
export type { ComisionResumen, PagoComision } from './comisionesService';
export { waiterSalesService } from './waiterSalesService';
export type { WaiterPayment, DailySalesResume } from './waiterSalesService';
export { printQueueService } from './printQueueService';
export { fichaService } from './fichaService';
export type { FichaView, FichaItemView, FichaDelivery } from './fichaService';
export {
  logClientEvent,
  startClientLogFlusher,
  flushClientLogQueue,
} from './clientLogService';
export { kitchenInventoryService } from './kitchenInventoryService';
export {
  PACKAGING,
  computePackaging,
  createPackagingItems,
} from './packagingService';

export { filtrarPorArea, ESTACIONES_DE_DESPACHO } from './areaDeDespacho';
export type { AreaDespacho } from './areaDeDespacho';
