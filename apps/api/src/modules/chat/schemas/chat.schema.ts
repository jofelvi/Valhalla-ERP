import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type ChatDocument = HydratedDocument<Chat>;

export interface ChatMessage {
  senderId: string;
  senderName: string;
  senderRole: 'customer' | 'waiter';
  text: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  } | null;
  timestamp: Date;
}

@Schema({ timestamps: true, collection: 'chats' })
export class Chat {
  // _id es el orderId (un chat por orden)
  @Prop({ type: String })
  _id: string;

  @Prop({ required: true, index: true })
  orderId: string;

  @Prop({ required: true })
  customerId: string;

  @Prop({ required: true })
  customerName: string;

  @Prop({ required: true })
  waiterId: string;

  @Prop({ required: true })
  waiterName: string;

  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] })
  messages: ChatMessage[];

  @Prop({ required: true, enum: ['active', 'closed'], default: 'active' })
  status: 'active' | 'closed';
}

export const ChatSchema = SchemaFactory.createForClass(Chat);
