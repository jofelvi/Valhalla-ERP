import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PrintJobDocument = HydratedDocument<PrintJob>;

export enum PrintJobType {
  COMANDA = 'comanda',
  PRECUENTA = 'precuenta',
  RECEIPT = 'receipt',
  REPRINT = 'reprint',
  RONDA = 'ronda',
  FICHA = 'ficha',
}

export enum PrintJobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  DONE = 'done',
  FAILED = 'failed',
}

export enum PrintStation {
  KITCHEN = 'KITCHEN',
  BAR = 'BAR',
  CAJA = 'CAJA',
  // PIZZA es estacion propia desde el Plan 4: tiene su impresora y su ficha.
  PIZZA = 'PIZZA',
}

@Schema({ timestamps: true, collection: 'print_queue', strict: false })
export class PrintJob {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id: string;

  @Prop()
  orderId?: string;

  @Prop()
  orderNumber?: string;

  @Prop({ required: true, enum: PrintJobType })
  type: PrintJobType;

  // Payload completo para que el print-service construya el recibo/comanda/precuenta
  // sin necesidad de re-fetchear la orden. Shape depende del tipo (receipt/comanda/precuenta).
  @Prop({ type: Object })
  payload?: Record<string, unknown>;

  @Prop({
    type: [
      {
        productId: String,
        name: String,
        qty: Number,
        station: String,
        notes: String,
      },
    ],
  })
  items?: Array<{
    productId: string;
    name: string;
    qty: number;
    station?: string;
    notes?: string;
  }>;

  @Prop({ enum: PrintStation })
  station?: PrintStation;

  @Prop({ enum: PrintJobStatus, default: PrintJobStatus.PENDING })
  status: PrintJobStatus;

  @Prop()
  errorMessage?: string;

  @Prop()
  userId?: string;

  @Prop()
  waiterId?: string;

  @Prop()
  waiterName?: string;

  @Prop()
  tableId?: string;

  @Prop()
  tableName?: string;

  @Prop()
  sector?: string;

  @Prop({ type: Date })
  processedAt?: Date;
}

export const PrintJobSchema = SchemaFactory.createForClass(PrintJob);
