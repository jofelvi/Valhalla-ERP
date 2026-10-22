import { Table } from '@/modelTypes/table';
import { Order } from '@/modelTypes/order';

/** Mesa enriquecida con su orden activa (forma que consume el POS). */
export interface TableWithOrder extends Table {
  currentOrder?: Order | null;
}
