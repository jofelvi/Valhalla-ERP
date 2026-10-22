import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PrintLogDocument = HydratedDocument<PrintLog>;

export enum PrintLogStatus {
  SUCCESS = 'success',
  SKIPPED = 'skipped',
  QUEUED = 'queued',
  SERVICE_DOWN = 'service_down',
  HTTP_500 = 'http_500',
  PRINTER_OFFLINE = 'printer_offline',
  PRINTER_PAPER_OUT = 'printer_paper_out',
  PRINTER_ERROR = 'printer_error',
  NETWORK_ERROR = 'network_error',
  EXCEPTION = 'exception',
  FAILED = 'failed',
  PARTIAL = 'partial',
}

@Schema({ timestamps: true, collection: 'printLogs' })
export class PrintLog {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id: string;

  @Prop({ required: true })
  attemptId: string;

  @Prop({ required: true })
  orderId: string;

  @Prop({ required: true })
  orderNumber: string;

  @Prop({ required: true })
  type: string;

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
  items: Array<{
    productId: string;
    name: string;
    qty: number;
    station?: string;
    notes?: string;
  }>;

  @Prop({ required: true })
  itemsCount: number;

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

  @Prop({ required: true })
  userId: string;

  @Prop({ required: true, enum: PrintLogStatus })
  status: PrintLogStatus;

  @Prop()
  httpStatus?: number;

  @Prop()
  errorMessage?: string;

  @Prop()
  via?: string;

  @Prop({ type: Object })
  serviceResponse?: Record<string, unknown>;

  @Prop({ required: true })
  requestHash: string;

  @Prop({ required: true, type: Date })
  requestAt: Date;

  @Prop({ type: Date })
  responseAt?: Date;

  @Prop()
  durationMs?: number;
}

export const PrintLogSchema = SchemaFactory.createForClass(PrintLog);
