import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MarginAlertDocument = HydratedDocument<MarginAlert>;

/**
 * Producto que hoy se vende con margen bajo, nulo o negativo.
 *
 * Existe para dar AVISO TEMPRANO: cuando sube el precio de un insumo, el costo
 * de todo lo que lo lleva sube con él y el margen puede quedar en nada sin que
 * nadie lo note hasta el cuadre del mes. Antes el costo de un preparado solo se
 * recalculaba al guardar su receta, así que se compraba la carne más cara y la
 * hamburguesa seguía mostrando el margen viejo.
 *
 * Una alerta por producto (upsert): no interesa el historial de cada compra,
 * interesa qué está mal AHORA. Se resuelve sola cuando el margen vuelve a
 * superar el umbral (`configs/margen_minimo`).
 */
@Schema({ timestamps: true, collection: 'margin_alerts' })
export class MarginAlert {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id: string;

  @Prop({ required: true, index: true, unique: true })
  productId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  price: number;

  @Prop({ required: true })
  cost: number;

  /** Margen sobre el precio, en %. Negativo = se pierde en cada venta. */
  @Prop({ required: true })
  marginPct: number;

  @Prop({ type: String, required: true, enum: ['NEGATIVO', 'NULO', 'BAJO'] })
  nivel: string;

  /** Qué la disparó: una compra, un cambio de precio o una receta nueva. */
  @Prop({ type: String, enum: ['compra', 'precio', 'receta', 'revision'] })
  causa?: string;

  /** El insumo que subió, cuando la causa fue una compra. */
  @Prop()
  insumoId?: string;

  @Prop()
  insumoName?: string;

  @Prop({ default: Date.now })
  desde: Date;

  /**
   * Null mientras siga mal. Con fecha, se arregló (se conserva por historial).
   * El `type: Date` es obligatorio: con la union `Date | null` Mongoose no
   * puede inferir el tipo y el modulo entero falla al arrancar.
   */
  @Prop({ type: Date, default: null })
  resueltaEn?: Date | null;
}

export const MarginAlertSchema = SchemaFactory.createForClass(MarginAlert);
