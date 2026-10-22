import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PurchaseAliasDocument = HydratedDocument<PurchaseAlias>;

/**
 * Como escribe un proveedor un producto nuestro.
 *
 * Existe porque el nombre de la factura casi nunca es el del catalogo:
 * Polar factura "SOLERA LIGHT RET 222Mlx36UN" y nosotros lo tenemos como
 * "Cerveza Light Botella". Ningun parecido de texto salva esa distancia.
 *
 * No se administra desde ninguna pantalla a proposito: se aprende solo cuando
 * alguien mapea el renglon a mano al cargar una factura, y desde la siguiente
 * ya se reconoce. Asi el sistema mejora usandolo, sin mantenimiento.
 */
@Schema({ timestamps: true, collection: 'purchase_aliases' })
export class PurchaseAlias {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id: string;

  /** Proveedor (suppliers._id). El mismo texto puede significar cosas distintas segun quien factura. */
  @Prop({ required: true, index: true })
  placeId: string;

  /** Parte estable del renglon, ya normalizada (ver buildAliasKey). */
  @Prop({ required: true })
  aliasKey: string;

  @Prop({ required: true })
  productId: string;

  /**
   * Unidades por bulto confirmadas por un humano. Respalda al OCR: si en la
   * proxima foto no se lee "222Mlx36UN", el sistema igual sabe que son 36.
   */
  @Prop({ type: Number, default: null })
  unitsPerPack: number | null;

  /** Cuantas facturas resolvio. Sirve para ver que aliases estan vivos. */
  @Prop({ default: 0 })
  timesUsed: number;

  @Prop({ type: Date, default: null })
  lastUsedAt: Date | null;

  @Prop({ required: true })
  createdBy: string;
}

export const PurchaseAliasSchema = SchemaFactory.createForClass(PurchaseAlias);

// Un solo alias por (proveedor, texto): reaprender el mismo renglon lo
// actualiza en vez de duplicarlo.
PurchaseAliasSchema.index({ placeId: 1, aliasKey: 1 }, { unique: true });
