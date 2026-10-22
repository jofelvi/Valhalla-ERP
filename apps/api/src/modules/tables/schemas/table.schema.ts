import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { TableStatusEnum } from '@odin6/types';

export type TableDocument = HydratedDocument<Table>;

@Schema({ timestamps: true, collection: 'tables' })
export class Table {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  number: number;

  @Prop()
  capacity: number;

  @Prop({
    required: true,
    enum: Object.values(TableStatusEnum),
    default: TableStatusEnum.ISAVAILABLE,
  })
  status: string;

  @Prop({ default: true })
  isAvailable: boolean;

  @Prop({ type: String, default: null })
  orderId: string | null;

  // Reserva temporal: un mesonero "toma" la mesa antes de armar el pedido.
  // Si no crea orden y no envia heartbeat en AUTO_RELEASE_MS, el cron la libera.
  @Prop({ type: String, default: null })
  claimedBy: string | null;

  @Prop({ type: String, default: null })
  claimedByName: string | null;

  @Prop({ type: Date, default: null })
  claimedAt: Date | null;

  // Último heartbeat del cliente mientras arma el pedido. claimedAt queda
  // fijo como inicio del claim (para el tope absoluto de 30 min del cron).
  @Prop({ type: Date, default: null })
  lastHeartbeatAt: Date | null;
}

export const TableSchema = SchemaFactory.createForClass(Table);
