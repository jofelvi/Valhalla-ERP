export interface CreditRequest {
  status: 'REQUESTED' | 'APPROVED' | 'REJECTED';
  requestedBy: string; // waiterId
  requestedByName?: string;
  requestedAt: Date | string;
  approvedAt?: Date | string | null;
  approvedBy?: string | null; // userId del cajero
  rejectedAt?: Date | string | null;
  rejectedBy?: string | null; // userId del que rechazó
  rejectionReason?: string | null;
  note?: string | null;
}

export interface OrderWithCreditRequest {
  id: string;
  _id?: string; // Normalizar a id
  orderNumber?: string | null;
  tableName?: string | null;
  sector?: string | null;
  customerId: string;
  customerName: string;
  waiterId: string;
  waiterName: string;
  items: Array<{
    name?: string;
    productName?: string;
    quantity: number;
    total?: number;
    totalPrice?: number;
  }>;
  total: number;
  createdAt: Date | string;
  creditRequest: CreditRequest;
  /**
   * Como esta el cobro de la orden HOY. Una solicitud puede quedar colgada
   * semanas mientras la orden se cobra por otra via: al 26/09/2026, 12 de las
   * 25 solicitudes pendientes de PRE eran de ordenes ya pagadas.
   */
  paymentStatus?: string | null;
  paidAmount?: number | null;
  status?: string | null;
}

export interface WaiterShare {
  waiterId: string;
  waiterName?: string;
  pct: number; // Porcentaje de la comisión que recibe este mesero
  comisionPagada?: boolean;
}
