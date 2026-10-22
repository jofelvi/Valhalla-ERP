import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WhatsappMessageStatus =
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'unknown';

@Schema({ timestamps: true, collection: 'whatsappMessageLogs' })
export class WhatsappMessageLog {
  @Prop({ required: true, index: true })
  messageId!: string;

  @Prop({ required: true })
  to!: string;

  @Prop()
  template?: string;

  @Prop({ required: true, default: 'sent', index: true })
  status!: WhatsappMessageStatus;

  @Prop({ index: true })
  accountReceivableId?: string;

  @Prop()
  customerName?: string;

  @Prop()
  orderCode?: string;

  @Prop()
  amount?: string;

  @Prop({ required: true, default: () => new Date() })
  sentAt!: Date;

  @Prop()
  deliveredAt?: Date;

  @Prop()
  readAt?: Date;

  @Prop()
  failedAt?: Date;

  @Prop()
  errorCode?: number;

  @Prop()
  errorTitle?: string;

  @Prop()
  errorMessage?: string;

  @Prop({ type: Object })
  lastWebhookRaw?: Record<string, unknown>;
}

export type WhatsappMessageLogDocument = WhatsappMessageLog & Document;
export const WhatsappMessageLogSchema =
  SchemaFactory.createForClass(WhatsappMessageLog);
