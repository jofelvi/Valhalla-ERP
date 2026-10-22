export interface Tip {
  id: string;
  orderId: string;
  waiterId: string;
  waiterName: string;
  amount: number; // USD
  createdAt: Date;
  userId: string; // Cajero que registró
}
