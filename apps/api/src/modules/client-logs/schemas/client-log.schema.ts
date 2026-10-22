import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ClientLogDocument = HydratedDocument<ClientLog>;

@Schema({ timestamps: true, collection: 'client_logs' })
export class ClientLog {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id: string;

  @Prop({ required: true, enum: ['info', 'warn', 'error'], index: true })
  level: 'info' | 'warn' | 'error';

  @Prop({ required: true, index: true })
  source: string;

  @Prop({ required: true })
  message: string;

  @Prop({ type: Object, default: null })
  context: Record<string, unknown> | null;

  @Prop({ type: String, default: null })
  stack: string | null;

  @Prop({ type: String, default: null, index: true })
  userId: string | null;

  @Prop({ type: String, default: null })
  userEmail: string | null;

  @Prop({ type: String, default: null, index: true })
  platform: string | null;

  @Prop({ type: String, default: null, index: true })
  appVersion: string | null;

  // ISO capturado CUANDO ocurrió el evento en el cliente, no cuando se envió
  // al servidor. Critico para medir cortes de internet sin queue-distortion.
  @Prop({
    type: String,
    default: () => new Date().toISOString(),
    index: true,
  })
  clientTime: string;

  // TTL: mongo borra el documento a los 30 dias del createdAt. Evita que la
  // coleccion crezca sin limite con logs de produccion.
  @Prop({ type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 })
  createdAt: Date;
}

export const ClientLogSchema = SchemaFactory.createForClass(ClientLog);
ClientLogSchema.index({ level: 1, createdAt: -1 });
ClientLogSchema.index({ source: 1, createdAt: -1 });
