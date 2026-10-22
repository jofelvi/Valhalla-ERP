import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomUUID } from 'crypto';

export type PurchaseDocument = HydratedDocument<Purchase>;

@Schema({ _id: false })
export class PurchaseItem {
  @Prop({ type: String, required: true })
  productId: string;

  @Prop({ type: String, required: true })
  productName: string; // snapshot para reportes

  @Prop({ type: Number, required: true })
  quantity: number; // en la unidad ingresada

  @Prop({ type: String, required: true })
  unit: string; // 'kg'|'gr'|'l'|'ml'|'und'|'unidad-compra'

  @Prop({ type: Number, required: true })
  unitCost: number; // USD por unidad ingresada

  @Prop({ type: Number, required: true })
  subtotal: number; // quantity × unitCost (roundMoney)

  @Prop({ type: Number, required: true })
  baseQty: number; // convertido a unidad base

  @Prop({ type: String, required: true })
  baseUnit: string; // GR|ML|UND

  @Prop({ type: Number, required: true })
  costPerBaseUnit: number; // roundUnitCost

  @Prop({ type: Number })
  unitCostBs?: number; // Bs por unidad ingresada (solo cuando currency='BS')

  @Prop({ type: Number })
  subtotalBs?: number; // quantity × unitCostBs (solo cuando currency='BS')
}
const PurchaseItemSchema = SchemaFactory.createForClass(PurchaseItem);

@Schema({ _id: false })
export class PriceAlert {
  @Prop({ type: String, required: true })
  productId: string;

  @Prop({ type: String, required: true })
  productName: string;

  @Prop({ type: Number, required: true })
  prevCostPerBase: number;

  @Prop({ type: Number, required: true })
  newCostPerBase: number;

  @Prop({ type: Number, required: true })
  variationPct: number; // + sube, − baja
}
const PriceAlertSchema = SchemaFactory.createForClass(PriceAlert);

@Schema({ collection: 'purchases' })
export class Purchase {
  @Prop({ type: String, default: () => randomUUID() })
  _id: string;

  @Prop({ type: String, required: true, index: true })
  placeId: string;

  @Prop({ type: String, required: true })
  placeName: string; // snapshot

  /**
   * Categoria del GASTO (insumos de cocina, bebidas, limpieza, mantenimiento...).
   * Es texto libre a proposito: la lista se arma con las categorias ya usadas,
   * asi que escribir una nueva la crea, sin un ABM aparte que mantener ni
   * categorias huerfanas que nadie borra.
   */
  @Prop({ type: String, index: true })
  category?: string;

  @Prop({ type: Date, required: true, index: true })
  date: Date;

  @Prop({ type: [PurchaseItemSchema], required: true })
  items: PurchaseItem[];

  @Prop({ type: [String], default: [] })
  invoiceUrls: string[];

  @Prop({ type: Number, required: true })
  total: number; // siempre en USD

  @Prop({ type: String, default: 'USD' })
  currency: string; // 'USD' | 'BS'

  @Prop({ type: Number })
  exchangeRate?: number; // tasa BCV si currency='BS'

  @Prop({ type: Number })
  totalBs?: number; // Σ subtotalBs (solo cuando currency='BS')

  @Prop({ type: String })
  shoppingListId?: string;

  @Prop({ type: String, required: true })
  warehouseId: string;

  @Prop({ type: [PriceAlertSchema], default: [] })
  alerts: PriceAlert[];

  @Prop({ type: String, required: true })
  createdBy: string;

  @Prop({ type: Date, default: () => new Date() })
  createdAt: Date;

  // Idempotencia de creacion: el cliente genera un id por intento de compra
  // y lo reusa en reintentos (mala red). Mismo id => misma compra, no duplica.
  @Prop()
  clientRequestId?: string;
}
export const PurchaseSchema = SchemaFactory.createForClass(Purchase);

/**
 * Idempotencia de creacion por `clientRequestId` (mismo patron que
 * `order.schema.ts` y `payment.schema.ts`). Sparse: las compras que no
 * mandan la clave (todas, hoy) no chocan entre si.
 *
 * OJO antes de desplegar: si ya hay `clientRequestId` duplicados historicos
 * (no deberia, porque nada lo escribe todavia) el indice no se construye.
 * Dedupe en mongosh, mismo patron que en payment.schema.ts (conservando la mas vieja):
 *
 *   db.purchases.aggregate([
 *     { $match: { clientRequestId: { $type: "string", $ne: "" } } },
 *     { $sort: { createdAt: 1 } },
 *     { $group: { _id: "$clientRequestId", ids: { $push: "$_id" }, count: { $sum: 1 } } },
 *     { $match: { count: { $gt: 1 } } },
 *   ]).forEach(g => {
 *     const ids = g.ids.slice(1);
 *     db.purchases.deleteMany({ _id: { $in: ids } });
 *   });
 */
PurchaseSchema.index(
  { clientRequestId: 1 },
  { unique: true, sparse: true, name: 'uniq_client_request_id' },
);
