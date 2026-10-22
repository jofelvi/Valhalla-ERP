import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { CurrencyEnum, PurchaseOrderStatusEnum } from '@odin6/types';

export type PurchaseOrderDocument = HydratedDocument<PurchaseOrder>;

interface PurchaseOrderItem {
  productId: string;
  quantity: number;
  unitCost: number;
  subtotal: number;
  productName?: string;
}

@Schema({ timestamps: true, collection: 'purchaseOrders' })
export class PurchaseOrder {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id: string;

  @Prop({ required: true })
  supplierId: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  supplierName: string;

  @Prop({ type: [Object], required: true })
  items: PurchaseOrderItem[];

  @Prop({ required: true })
  totalAmount: number;

  @Prop({
    enum: Object.values(CurrencyEnum),
    default: CurrencyEnum.USD,
  })
  currency: string;

  @Prop()
  isPaid?: boolean;

  @Prop({
    enum: Object.values(PurchaseOrderStatusEnum),
    default: PurchaseOrderStatusEnum.PENDING,
  })
  status: string;

  @Prop()
  expectedDeliveryDate?: Date;

  @Prop()
  receivedAt?: Date;

  @Prop()
  imageUrl?: string;
}

export const PurchaseOrderSchema = SchemaFactory.createForClass(PurchaseOrder);
